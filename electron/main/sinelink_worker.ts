/**
 * Sine.link Serial Worker
 *
 * Connects to Sine.link modem via serial port (MAVLink FTP protocol).
 * Periodically polls viGetPose to get drone coordinates.
 *
 * Flow: Serial port → MAVLink FTP → Wire SDK (WASM) → protobuf → IPC → sinelink-store
 */

import { ipcMain, BrowserWindow } from 'electron';
import {
  SINELINK_IPC_CHANNELS,
  SINE_MAVLINK_SYS_ID,
  SINE_MAVLINK_COMP_ID,
  SINE_MAVLINK_NET,
} from '../../src/services/sinelink/types';
import type {
  SinelinkConfig,
  SinelinkIPCRequest,
  SinelinkIPCResponse,
} from '../../src/services/sinelink/types';
import { WireBridge } from '../../src/services/sinelink/wire-bridge';
import {
  MavlinkSerialBuilder,
  MavlinkSerialParser,
  extractFtpPayload,
  MAVLINK_MSG_ID_FILE_TRANSFER_PROTOCOL,
} from '../../src/services/sinelink/mavlink-serial';

// Protobuf stubs — import encode/decode
import {
  Object as LinkObject,
  Header,
  Type,
  viPose,
} from '../../wire/build/sine.wire/stubs/link_v1';

interface WorkerState {
  port: any; // SerialPort instance (dynamic import)
  wireBridge: WireBridge;
  mavBuilder: MavlinkSerialBuilder;
  mavParser: MavlinkSerialParser;
  config: SinelinkConfig | null;
  childWindows: Set<BrowserWindow>;
  started: boolean;
  connected: boolean;
  pollTimer: ReturnType<typeof setInterval> | null;
  waitingResponse: boolean;
}

const state: WorkerState = {
  port: null,
  wireBridge: new WireBridge(),
  mavBuilder: new MavlinkSerialBuilder(255, 190), // GCS sys=255, comp=190
  mavParser: new MavlinkSerialParser(),
  config: null,
  childWindows: new Set(),
  started: false,
  connected: false,
  pollTimer: null,
  waitingResponse: false,
};

function sendToRenderer(response: SinelinkIPCResponse): void {
  for (const win of state.childWindows) {
    if (win.isDestroyed()) {
      state.childWindows.delete(win);
      continue;
    }
    try {
      win.webContents.send(SINELINK_IPC_CHANNELS.RESPONSE, response);
    } catch (e) {
      console.error('[Sinelink] Failed to send to renderer:', e);
    }
  }
}

/**
 * Build viGetPose request as MAVLink FTP frame
 */
function buildPoseRequest(): Buffer | null {
  try {
    // 1. Create protobuf request
    const req: LinkObject = {
      header: { type: Type.viGetPose, size: 0, isRemote: false, objIndex: 0 },
    };
    const protoBytes = LinkObject.encode(req).finish();

    // 2. Convert proto → wire binary
    const wireBytes = state.wireBridge.protoToLink(protoBytes);

    // 3. Wrap in MAVLink FTP payload
    const ftpPayload = state.wireBridge.rawToMavlink(
      wireBytes,
      SINE_MAVLINK_SYS_ID,
      SINE_MAVLINK_COMP_ID,
      0, // UUID = 0 (any device)
    );

    // 4. Build MAVLink v1 FTP frame
    return state.mavBuilder.buildFtpMessage(
      SINE_MAVLINK_NET,
      SINE_MAVLINK_SYS_ID,
      SINE_MAVLINK_COMP_ID,
      ftpPayload,
    );
  } catch (e) {
    console.error('[Sinelink] Failed to build pose request:', e);
    return null;
  }
}

/**
 * Parse FTP response into viPose
 */
function parsePoseResponse(ftpPayloadBytes: Buffer): void {
  try {
    // 1. Extract raw from MAVLink FTP payload
    const { raw } = state.wireBridge.mavlinkToRaw(ftpPayloadBytes);

    // 2. Convert wire binary → proto
    const protoBytes = state.wireBridge.linkToProto(raw);

    // 3. Decode protobuf
    const resp = LinkObject.decode(protoBytes);

    if (resp.pose) {
      sendToRenderer({
        type: 'position',
        lat: resp.pose.lat,
        lon: resp.pose.lon,
        alt: resp.pose.alt,
        valid: resp.pose.valid,
        confidence: resp.pose.confidence,
        ts: resp.pose.ts,
      });
    } else if (resp.header && resp.header.type !== Type.viGetPose) {
      console.warn('[Sinelink] Unexpected response type:', resp.header.type);
    }
  } catch (e) {
    console.error('[Sinelink] Failed to parse response:', e);
  }
}

/**
 * Poll viGetPose
 */
function pollPose(): void {
  if (!state.port || !state.connected || state.waitingResponse) return;

  const frame = buildPoseRequest();
  if (!frame) return;

  state.waitingResponse = true;

  try {
    state.port.write(frame);
  } catch (e) {
    console.error('[Sinelink] Write failed:', e);
    state.waitingResponse = false;
  }

  // Timeout — reset waiting flag after 1s
  setTimeout(() => { state.waitingResponse = false; }, 1000);
}

async function connect(config: SinelinkConfig): Promise<void> {
  if (state.port) {
    await disconnect();
  }

  state.config = config;
  state.mavParser.reset();

  // Initialize Wire bridge if needed
  if (!state.wireBridge.isInitialized) {
    try {
      await state.wireBridge.init();
      console.log('[Sinelink] Wire SDK initialized');
    } catch (e) {
      const error = e as Error;
      console.error('[Sinelink] Wire SDK init failed:', error);
      sendToRenderer({ type: 'error', code: 'WIRE_INIT_FAILED', message: error.message });
      return;
    }
  }

  try {
    // Dynamic import to avoid issues if serialport is not installed
    const { SerialPort } = await import('serialport');

    state.port = new SerialPort({
      path: config.portPath,
      baudRate: config.baudRate,
      autoOpen: false,
    });

    state.port.on('data', (data: Buffer) => {
      const frames = state.mavParser.feed(data);
      for (const frame of frames) {
        if (frame.msgId === MAVLINK_MSG_ID_FILE_TRANSFER_PROTOCOL) {
          const ftp = extractFtpPayload(frame);
          if (ftp) {
            state.waitingResponse = false;
            parsePoseResponse(ftp.payload);
          }
        }
      }
    });

    state.port.on('error', (err: Error) => {
      console.error('[Sinelink] Serial error:', err);
      sendToRenderer({ type: 'error', code: 'SERIAL_ERROR', message: err.message });
    });

    state.port.on('close', () => {
      console.log('[Sinelink] Serial port closed');
      stopPolling();
      state.connected = false;
      sendToRenderer({ type: 'disconnected' });
    });

    state.port.open((err: Error | null) => {
      if (err) {
        console.error('[Sinelink] Failed to open port:', err);
        sendToRenderer({ type: 'error', code: 'OPEN_FAILED', message: err.message });
        return;
      }

      console.log(`[Sinelink] Connected to ${config.portPath} at ${config.baudRate}`);
      state.connected = true;
      sendToRenderer({ type: 'connected', portPath: config.portPath });

      // Start polling
      startPolling(config.pollIntervalMs);
    });
  } catch (e) {
    const error = e as Error;
    console.error('[Sinelink] Failed to create serial port:', error);
    sendToRenderer({ type: 'error', code: 'CONNECT_FAILED', message: error.message });
  }
}

function startPolling(intervalMs: number): void {
  stopPolling();
  state.pollTimer = setInterval(pollPose, intervalMs);
}

function stopPolling(): void {
  if (state.pollTimer) {
    clearInterval(state.pollTimer);
    state.pollTimer = null;
  }
}

async function disconnect(): Promise<void> {
  stopPolling();
  if (state.port) {
    try {
      if (state.port.isOpen) {
        state.port.close();
      }
    } catch (_) {}
    state.port = null;
  }
  state.connected = false;
  state.waitingResponse = false;
  state.config = null;
  state.mavParser.reset();
  sendToRenderer({ type: 'disconnected' });
}

async function listPorts(): Promise<void> {
  try {
    const { SerialPort } = await import('serialport');
    const ports = await SerialPort.list();
    sendToRenderer({
      type: 'ports',
      ports: ports.map(p => ({
        path: p.path,
        manufacturer: p.manufacturer,
        serialNumber: p.serialNumber,
        vendorId: p.vendorId,
        productId: p.productId,
      })),
    });
  } catch (e) {
    const error = e as Error;
    sendToRenderer({ type: 'error', code: 'LIST_PORTS_FAILED', message: error.message });
  }
}

async function handleRequest(request: SinelinkIPCRequest): Promise<void> {
  console.log('[Sinelink] Received request:', request.type);
  switch (request.type) {
    case 'connect': await connect(request.config); break;
    case 'disconnect': await disconnect(); break;
    case 'list-ports': await listPorts(); break;
  }
}

export function setSinelinkChildWindow(childWindow: BrowserWindow | null): void {
  if (childWindow) {
    state.childWindows.add(childWindow);
    childWindow.on('closed', () => {
      state.childWindows.delete(childWindow);
    });
  }
}

export function sinelinkWorker({ ipcMain: ipc }: { ipcMain: typeof ipcMain }): void {
  if (state.started) return;
  state.started = true;
  console.log('[Sinelink] Worker starting...');

  ipc.handle(SINELINK_IPC_CHANNELS.REQUEST, async (_, request: SinelinkIPCRequest) => {
    if (!request) return;
    await handleRequest(request);
  });

  console.log('[Sinelink] Worker started');
}

export function stopSinelinkWorker(): void {
  stopPolling();
  if (state.port) {
    try { if (state.port.isOpen) state.port.close(); } catch (_) {}
    state.port = null;
  }
  state.connected = false;
  state.childWindows.clear();
  state.started = false;
}
