/**
 * MAVLink UDP Listener Worker
 *
 * Listens for MAVLink telemetry on a UDP port (default 14550).
 * Parses HEARTBEAT and GLOBAL_POSITION_INT messages and forwards
 * parsed data to the renderer process via IPC.
 *
 * Flow: RPanion/FC → UDP → this worker → IPC → mavlink-store → tracking math → antenna
 */

import * as dgram from 'dgram';
import { ipcMain, BrowserWindow } from 'electron';
import { MavlinkParser } from '../../src/services/mavlink/mavlink-parser';
import {
  MAVLINK_IPC_CHANNELS,
  type MavlinkConfig,
  type MavlinkIPCRequest,
  type MavlinkIPCResponse,
} from '../../src/services/mavlink/types';

interface MavlinkWorkerState {
  socket: dgram.Socket | null;
  parser: MavlinkParser;
  config: MavlinkConfig | null;
  childWindows: Set<BrowserWindow>;
  started: boolean;
  connected: boolean;
}

const state: MavlinkWorkerState = {
  socket: null,
  parser: new MavlinkParser(),
  config: null,
  childWindows: new Set(),
  started: false,
  connected: false,
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
      sendToRenderer({ type: 'disconnected' });
    });

    state.socket.bind(config.port, config.bindAddress, () => {
      const addr = state.socket?.address();
      console.log(`[MAVLink] Listening on ${addr?.address}:${addr?.port}`);
      state.connected = true;
      sendToRenderer({ type: 'connected', port: config.port });
    });
  } catch (e) {
    const error = e as Error;
    console.error('[MAVLink] Failed to create socket:', error);
    sendToRenderer({ type: 'error', code: 'CONNECT_FAILED', message: error.message });
  }
}

function disconnect(): void {
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
  if (state.socket) {
    try { state.socket.close(); } catch (_) {}
    state.socket = null;
  }
  state.connected = false;
  state.config = null;
  state.childWindows.clear();
  state.started = false;
}
