/**
 * Antenna MAVLink Serial Worker
 *
 * Sends MAV_CMD_DO_SET_SERVO commands to antenna rotator device
 * via serial port (MAVLink protocol).
 *
 * Uses the SAME PWM values as the existing UDP rotator protocol:
 * - Azimuth: PWM 540-2400 (same as X field in UDP frame)
 * - Elevation: command 0-95 (same as Y field in UDP frame)
 *
 * Flow: rotator-store → IPC → this worker → MAVLink serial → antenna device
 */

import { ipcMain, BrowserWindow } from 'electron';
import {
  ANTENNA_MAVLINK_IPC_CHANNELS,
} from '../../src/services/sinelink/types';
import type {
  AntennaMavlinkConfig,
  AntennaMavlinkIPCRequest,
  AntennaMavlinkIPCResponse,
} from '../../src/services/sinelink/types';
import {
  MavlinkSerialBuilder,
  MavlinkSerialParser,
  MAVLINK_MSG_ID_HEARTBEAT,
} from '../../src/services/sinelink/mavlink-serial';

interface WorkerState {
  port: any; // SerialPort instance
  mavBuilder: MavlinkSerialBuilder;
  mavParser: MavlinkSerialParser;
  config: AntennaMavlinkConfig | null;
  childWindows: Set<BrowserWindow>;
  started: boolean;
  connected: boolean;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
}

const state: WorkerState = {
  port: null,
  mavBuilder: new MavlinkSerialBuilder(255, 190),
  mavParser: new MavlinkSerialParser(),
  config: null,
  childWindows: new Set(),
  started: false,
  connected: false,
  heartbeatTimer: null,
};

function sendToRenderer(response: AntennaMavlinkIPCResponse): void {
  for (const win of state.childWindows) {
    if (win.isDestroyed()) {
      state.childWindows.delete(win);
      continue;
    }
    try {
      win.webContents.send(ANTENNA_MAVLINK_IPC_CHANNELS.RESPONSE, response);
    } catch (e) {
      console.error('[AntennaMavlink] Failed to send to renderer:', e);
    }
  }
}

/**
 * Send servo command for azimuth or elevation
 */
function sendServoCommand(servoChannel: number, pwmValue: number): void {
  if (!state.port || !state.connected || !state.config) return;

  const frame = state.mavBuilder.buildSetServo(
    state.config.targetSystemId,
    state.config.targetComponentId,
    servoChannel,
    pwmValue,
  );

  try {
    state.port.write(frame);
    console.log(`[AntennaMavlink] Servo ch=${servoChannel} pwm=${pwmValue} (${frame.length} bytes)`);
  } catch (e) {
    console.error('[AntennaMavlink] Write failed:', e);
  }
}

/**
 * Send heartbeat to maintain MAVLink connection
 */
function sendHeartbeat(): void {
  if (!state.port || !state.connected) return;

  const frame = state.mavBuilder.buildHeartbeat();
  try {
    state.port.write(frame);
  } catch (_) {}
}

async function connect(config: AntennaMavlinkConfig): Promise<void> {
  if (state.port) {
    await disconnect();
  }

  state.config = config;
  state.mavParser.reset();

  try {
    const { SerialPort } = await import('serialport');

    state.port = new SerialPort({
      path: config.portPath,
      baudRate: config.baudRate,
      autoOpen: false,
    });

    state.port.on('data', (data: Buffer) => {
      const frames = state.mavParser.feed(data);
      for (const frame of frames) {
        if (frame.msgId === MAVLINK_MSG_ID_HEARTBEAT) {
          sendToRenderer({
            type: 'heartbeat-received',
            systemId: frame.systemId,
            componentId: frame.componentId,
          });
        }
      }
    });

    state.port.on('error', (err: Error) => {
      console.error('[AntennaMavlink] Serial error:', err);
      sendToRenderer({ type: 'error', code: 'SERIAL_ERROR', message: err.message });
    });

    state.port.on('close', () => {
      console.log('[AntennaMavlink] Serial port closed');
      stopHeartbeat();
      state.connected = false;
      sendToRenderer({ type: 'disconnected' });
    });

    state.port.open((err: Error | null) => {
      if (err) {
        console.error('[AntennaMavlink] Failed to open port:', err);
        sendToRenderer({ type: 'error', code: 'OPEN_FAILED', message: err.message });
        return;
      }

      console.log(`[AntennaMavlink] Connected to ${config.portPath} at ${config.baudRate}`);
      state.connected = true;
      sendToRenderer({ type: 'connected', portPath: config.portPath });

      // Send heartbeat every 1s to maintain connection
      startHeartbeat();
    });
  } catch (e) {
    const error = e as Error;
    console.error('[AntennaMavlink] Failed to create serial port:', error);
    sendToRenderer({ type: 'error', code: 'CONNECT_FAILED', message: error.message });
  }
}

function startHeartbeat(): void {
  stopHeartbeat();
  sendHeartbeat(); // Send immediately
  state.heartbeatTimer = setInterval(sendHeartbeat, 1000);
}

function stopHeartbeat(): void {
  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }
}

async function disconnect(): Promise<void> {
  stopHeartbeat();
  if (state.port) {
    try { if (state.port.isOpen) state.port.close(); } catch (_) {}
    state.port = null;
  }
  state.connected = false;
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

async function handleRequest(request: AntennaMavlinkIPCRequest): Promise<void> {
  console.log('[AntennaMavlink] Received request:', request.type);
  switch (request.type) {
    case 'connect':
      await connect(request.config);
      break;
    case 'disconnect':
      await disconnect();
      break;
    case 'send-servo':
      if (state.config) {
        sendServoCommand(state.config.azimuthServoChannel, request.azimuthPwm);
        // Convert elevation command (0-95) to PWM (1000-2000)
        const elevationPwm = Math.round(1000 + (request.elevationCmd / 95) * 1000);
        sendServoCommand(state.config.elevationServoChannel, elevationPwm);
      }
      break;
    case 'list-ports':
      await listPorts();
      break;
  }
}

export function setAntennaMavlinkChildWindow(childWindow: BrowserWindow | null): void {
  if (childWindow) {
    state.childWindows.add(childWindow);
    childWindow.on('closed', () => {
      state.childWindows.delete(childWindow);
    });
  }
}

export function antennaMavlinkWorker({ ipcMain: ipc }: { ipcMain: typeof ipcMain }): void {
  if (state.started) return;
  state.started = true;
  console.log('[AntennaMavlink] Worker starting...');

  ipc.handle(ANTENNA_MAVLINK_IPC_CHANNELS.REQUEST, async (_, request: AntennaMavlinkIPCRequest) => {
    if (!request) return;
    await handleRequest(request);
  });

  console.log('[AntennaMavlink] Worker started');
}

export function stopAntennaMavlinkWorker(): void {
  stopHeartbeat();
  if (state.port) {
    try { if (state.port.isOpen) state.port.close(); } catch (_) {}
    state.port = null;
  }
  state.connected = false;
  state.childWindows.clear();
  state.started = false;
}
