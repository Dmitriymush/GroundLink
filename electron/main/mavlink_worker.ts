/**
 * MAVLink UDP Worker
 *
 * Connects to a remote MAVLink endpoint (drone/RPanion/mavlink-router)
 * via UDP. Sends GCS heartbeats so the remote knows we exist and
 * starts streaming telemetry back to us.
 *
 * Flow: RPanion/FC → UDP → this worker → IPC → mavlink-store → tracking math → antenna
 */

import * as dgram from 'dgram';
import { ipcMain, BrowserWindow } from 'electron';
import { MavlinkParser } from '../../src/services/mavlink/mavlink-parser';
import { MavlinkSerialBuilder } from '../../src/services/sinelink/mavlink-serial';
import {
  MAVLINK_IPC_CHANNELS,
  type MavlinkConfig,
  type MavlinkIPCRequest,
  type MavlinkIPCResponse,
} from '../../src/services/mavlink/types';

interface MavlinkWorkerState {
  socket: dgram.Socket | null;
  parser: MavlinkParser;
  mavBuilder: MavlinkSerialBuilder;
  config: MavlinkConfig | null;
  childWindows: Set<BrowserWindow>;
  started: boolean;
  connected: boolean;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
}

const state: MavlinkWorkerState = {
  socket: null,
  parser: new MavlinkParser(),
  mavBuilder: new MavlinkSerialBuilder(255, 190),
  config: null,
  childWindows: new Set(),
  started: false,
  connected: false,
  heartbeatTimer: null,
};

function sendToRenderer(response: MavlinkIPCResponse): void {
  for (const win of state.childWindows) {
    if (win.isDestroyed()) {
      state.childWindows.delete(win);
      continue;
    }
    try {
      win.webContents.send(MAVLINK_IPC_CHANNELS.RESPONSE, response);
    } catch (e) {
      console.error('[MAVLink] Failed to send to renderer:', e);
    }
  }
}

function sendHeartbeat(): void {
  if (!state.socket || !state.config) return;
  const frame = state.mavBuilder.buildHeartbeat();
  try {
    state.socket.send(frame, state.config.port, state.config.bindAddress);
  } catch (_) {}
}

function connect(config: MavlinkConfig): void {
  if (state.socket) {
    disconnect();
  }

  state.config = config;
  state.parser.reset();

  try {
    state.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    state.socket.on('message', (msg: Buffer) => {
      const messages = state.parser.feed(msg);
      for (const m of messages) {
        if (m.msgId === 0) {
          sendToRenderer({
            type: 'heartbeat',
            systemId: m.systemId,
            autopilot: m.autopilot,
            mavType: m.type,
          });
        } else if (m.msgId === 33) {
          sendToRenderer({
            type: 'position',
            lat: m.lat,
            lon: m.lon,
            alt: m.alt,
            relativeAlt: m.relativeAlt,
            hdg: m.hdg,
          });
        }
      }
    });

    state.socket.on('error', (err: Error) => {
      console.error('[MAVLink] Socket error:', err);
      sendToRenderer({ type: 'error', code: 'SOCKET_ERROR', message: err.message });
      state.connected = false;
    });

    state.socket.on('close', () => {
      console.log('[MAVLink] Socket closed');
      state.connected = false;
      if (state.heartbeatTimer) {
        clearInterval(state.heartbeatTimer);
        state.heartbeatTimer = null;
      }
      sendToRenderer({ type: 'disconnected' });
    });

    // Bind to any available local port, then send heartbeats to remote
    state.socket.bind(0, () => {
      const addr = state.socket?.address();
      console.log(`[MAVLink] Connected → ${config.bindAddress}:${config.port} (local port ${addr?.port})`);
      state.connected = true;
      sendToRenderer({ type: 'connected', port: config.port });

      // Send heartbeats every 1s so remote knows we exist and starts streaming
      sendHeartbeat();
      state.heartbeatTimer = setInterval(sendHeartbeat, 1000);
    });
  } catch (e) {
    const error = e as Error;
    console.error('[MAVLink] Failed to create socket:', error);
    sendToRenderer({ type: 'error', code: 'CONNECT_FAILED', message: error.message });
  }
}

function disconnect(): void {
  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }
  if (state.socket) {
    try { state.socket.close(); } catch (_) {}
    state.socket = null;
  }
  state.connected = false;
  state.config = null;
  state.parser.reset();
  sendToRenderer({ type: 'disconnected' });
}

function handleRequest(request: MavlinkIPCRequest): void {
  console.log('[MAVLink] Received request:', request.type);
  switch (request.type) {
    case 'connect': connect(request.config); break;
    case 'disconnect': disconnect(); break;
  }
}

export function setMavlinkChildWindow(childWindow: BrowserWindow | null): void {
  if (childWindow) {
    state.childWindows.add(childWindow);
    childWindow.on('closed', () => {
      state.childWindows.delete(childWindow);
    });
  }
}

export function mavlinkWorker({ ipcMain: ipc }: { ipcMain: typeof ipcMain }): void {
  if (state.started) return;
  state.started = true;
  console.log('[MAVLink] Worker starting...');

  ipc.handle(MAVLINK_IPC_CHANNELS.REQUEST, async (_, request: MavlinkIPCRequest) => {
    if (!request) return;
    handleRequest(request);
  });

  console.log('[MAVLink] Worker started');
}

export function stopMavlinkWorker(): void {
  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }
  if (state.socket) {
    try { state.socket.close(); } catch (_) {}
    state.socket = null;
  }
  state.connected = false;
  state.config = null;
  state.childWindows.clear();
  state.started = false;
}
