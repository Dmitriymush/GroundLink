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

// Inline protobuf encoding for viGetPose request
// Instead of importing TS stubs (which need @bufbuild/protobuf and cause Rollup issues),
// we build the minimal protobuf bytes manually.
// Object { header { type: viGetPose(0x4C=76) } }
// Protobuf wire format:
//   field 1 (header) = tag 0x0A, length-delimited
//   Header { field 1 (type) = tag 0x08, varint 76 }
const VIGETPOSE_PROTO_REQUEST = new Uint8Array([
  0x0A, 0x02,  // field 1 (header), length 2
  0x08, 0x4C,  // field 1 (type), varint 76 (viGetPose)
]);

const VIGETPOSE_TYPE = 0x4C; // 76

/**
 * Parse viPose from protobuf Object response (minimal parser)
 * Looks for: header.type == 0x4C and pose fields (field 36 in Object)
 */
function parsePoseFromProto(protoBytes: Uint8Array): { lat: number; lon: number; alt: number; valid: boolean; confidence: number; ts: number } | null {
  try {
    // Simple protobuf parser — find pose submessage (field 36, tag = 36<<3|2 = 290 = 0x0122)
    // Then parse viPose fields inside it
    let offset = 0;
    const view = new DataView(protoBytes.buffer, protoBytes.byteOffset, protoBytes.byteLength);

    // First check header type
    // Skip through fields looking for field 36 (pose)
    let poseStart = -1;
    let poseEnd = -1;

    while (offset < protoBytes.length) {
      const tag = readVarint(protoBytes, offset);
      if (tag === null) break;
      offset = tag.newOffset;

      const fieldNum = tag.value >>> 3;
      const wireType = tag.value & 0x07;

      if (wireType === 2) { // length-delimited
        const len = readVarint(protoBytes, offset);
        if (len === null) break;
        offset = len.newOffset;

        if (fieldNum === 36) { // pose field in Object
          poseStart = offset;
          poseEnd = offset + len.value;
        }
        offset += len.value;
      } else if (wireType === 0) { // varint
        const val = readVarint(protoBytes, offset);
        if (val === null) break;
        offset = val.newOffset;
      } else if (wireType === 5) { // 32-bit
        offset += 4;
      } else if (wireType === 1) { // 64-bit
        offset += 8;
      } else {
        break;
      }
    }

    if (poseStart < 0 || poseEnd < 0) return null;

    // Parse viPose fields
    let ts = 0, lat = 0, lon = 0, alt = 0, valid = false, confidence = 0;
    offset = poseStart;

    while (offset < poseEnd) {
      const tag = readVarint(protoBytes, offset);
      if (tag === null) break;
      offset = tag.newOffset;

      const fieldNum = tag.value >>> 3;
      const wireType = tag.value & 0x07;

      if (wireType === 0) { // varint
        const val = readVarint(protoBytes, offset);
        if (val === null) break;
        offset = val.newOffset;
        if (fieldNum === 1) ts = val.value;
        else if (fieldNum === 4) alt = val.value;
        else if (fieldNum === 8) valid = val.value !== 0;
        else if (fieldNum === 10) confidence = val.value;
      } else if (wireType === 5) { // 32-bit (float)
        if (offset + 4 > protoBytes.length) break;
        const f = new DataView(protoBytes.buffer, protoBytes.byteOffset + offset, 4).getFloat32(0, true);
        offset += 4;
        if (fieldNum === 2) lat = f;
        else if (fieldNum === 3) lon = f;
      } else if (wireType === 2) { // length-delimited (skip)
        const len = readVarint(protoBytes, offset);
        if (len === null) break;
        offset = len.newOffset + len.value;
      } else if (wireType === 1) { // 64-bit (skip)
        offset += 8;
      } else {
        break;
      }
    }

    return { lat, lon, alt, valid, confidence, ts };
  } catch {
    return null;
  }
}

function readVarint(buf: Uint8Array, offset: number): { value: number; newOffset: number } | null {
  let value = 0;
  let shift = 0;
  while (offset < buf.length) {
    const byte = buf[offset++];
    value |= (byte & 0x7F) << shift;
    if ((byte & 0x80) === 0) return { value, newOffset: offset };
    shift += 7;
    if (shift > 35) return null;
  }
  return null;
}

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
    // 1. Use pre-built protobuf request bytes
    const protoBytes = VIGETPOSE_PROTO_REQUEST;

    // 2. Convert proto → wire binary
    const wireBytes = state.wireBridge.protoToLink(protoBytes);

    // 3. Wrap in MAVLink FTP payload
    const ftpPayload = state.wireBridge.rawToMavlink(
      wireBytes,
      SINE_MAVLINK_SYS_ID,
      SINE_MAVLINK_COMP_ID,
      0, // UUID = 0 (any device)
    );

    // 4. Build MAVLink FTP frame
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

    // 3. Parse protobuf using inline parser (no external stubs dependency)
    const pose = parsePoseFromProto(protoBytes);

    if (pose) {
      sendToRenderer({
        type: 'position',
        lat: pose.lat,
        lon: pose.lon,
        alt: pose.alt,
        valid: pose.valid,
        confidence: pose.confidence,
        ts: pose.ts,
      });
    } else {
      console.warn('[Sinelink] Could not parse pose from response');
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
