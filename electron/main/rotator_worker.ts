/**
 * Rotator UDP Worker
 *
 * Handles UDP communication with the WIFI232-B2 module for rotator control.
 * Runs in the Electron main process.
 *
 * Communication flow:
 * GroundLink (UDP Client) → WIFI232-B2 (UDP Server) → UART → MCU → Rotator
 */

import * as dgram from 'dgram';
import { ipcMain, BrowserWindow } from 'electron';
import {
  ROTATOR_IPC_CHANNELS,
  RotatorConfig,
  RotatorIPCRequest,
  RotatorIPCResponse,
  RotatorConnectionError,
} from '../../src/services/rotator/types';

interface RotatorWorkerState {
  socket: dgram.Socket | null;
  config: RotatorConfig | null;
  childWindow: BrowserWindow | null;
  started: boolean;
  connected: boolean;
  lastSendTime: number;
}

const state: RotatorWorkerState = {
  socket: null,
  config: null,
  childWindow: null,
  started: false,
  connected: false,
  lastSendTime: 0,
};

/**
 * Send response to renderer process
 */
function sendToRenderer(response: RotatorIPCResponse): void {
  if (state.childWindow && !state.childWindow.isDestroyed()) {
    try {
      state.childWindow.webContents.send(ROTATOR_IPC_CHANNELS.RESPONSE, response);
    } catch (e) {
      console.error('[Rotator] Failed to send to renderer:', e);
    }
  }
}

/**
 * Send error to renderer
 */
function sendError(code: string, message: string): void {
  const error: RotatorConnectionError = {
    code,
    message,
    timestamp: Date.now(),
  };
  sendToRenderer({ type: 'error', error });
}

/**
 * Connect to rotator via UDP
 */
function connect(config: RotatorConfig): void {
  // Disconnect existing connection first
  if (state.socket) {
    disconnect();
  }

  state.config = config;

  try {
    // Create UDP socket
    state.socket = dgram.createSocket('udp4');

    // Handle incoming messages (telemetry)
    state.socket.on('message', (msg: Buffer, rinfo: dgram.RemoteInfo) => {
      const data = msg.toString('utf8');
      console.log(`[Rotator] Received ${msg.length} bytes from ${rinfo.address}:${rinfo.port}`);
      sendToRenderer({ type: 'telemetry', data });
    });

    // Handle errors
    state.socket.on('error', (err: Error) => {
      console.error('[Rotator] Socket error:', err);
      sendError('SOCKET_ERROR', err.message);
      state.connected = false;
    });

    // Handle socket close
    state.socket.on('close', () => {
      console.log('[Rotator] Socket closed');
      state.connected = false;
      sendToRenderer({ type: 'disconnected' });
    });

    // Bind to local port for receiving telemetry
    state.socket.bind(config.localPort, () => {
      const address = state.socket?.address();
      console.log(`[Rotator] Socket bound to ${address?.address}:${address?.port}`);
      state.connected = true;
      sendToRenderer({ type: 'connected' });
    });
  } catch (e) {
    const error = e as Error;
    console.error('[Rotator] Failed to create socket:', error);
    sendError('CONNECT_FAILED', error.message);
  }
}

/**
 * Disconnect from rotator
 */
function disconnect(): void {
  if (state.socket) {
    try {
      state.socket.close();
    } catch (e) {
      // Ignore close errors
    }
    state.socket = null;
  }
  state.connected = false;
  state.config = null;
  sendToRenderer({ type: 'disconnected' });
}

/**
 * Send frame to rotator
 */
function sendFrame(frame: string): void {
  if (!state.socket || !state.config) {
    sendError('NOT_CONNECTED', 'Socket not connected');
    return;
  }

  const buffer = Buffer.from(frame, 'utf8');

  state.socket.send(
    buffer,
    0,
    buffer.length,
    state.config.port,
    state.config.host,
    (err) => {
      if (err) {
        console.error('[Rotator] Send error:', err);
        sendError('SEND_FAILED', err.message);
      } else {
        state.lastSendTime = Date.now();
        console.log(`[Rotator] Sent ${buffer.length} bytes to ${state.config?.host}:${state.config?.port}`);
      }
    }
  );
}

/**
 * Handle IPC request from renderer
 */
function handleRequest(request: RotatorIPCRequest): void {
  console.log('[Rotator] Received request:', request.type);

  switch (request.type) {
    case 'connect':
      connect(request.config);
      break;
    case 'disconnect':
      disconnect();
      break;
    case 'send':
      sendFrame(request.frame);
      break;
    default:
      console.error('[Rotator] Unknown request type:', (request as any).type);
  }
}

/**
 * Set the child window reference for sending IPC messages
 */
export function setRotatorChildWindow(childWindow: BrowserWindow | null): void {
  state.childWindow = childWindow;
}

/**
 * Initialize the rotator worker
 */
export function rotatorWorker({ ipcMain: ipc }: { ipcMain: typeof ipcMain }): void {
  if (state.started) {
    console.log('[Rotator] Worker already started');
    return;
  }

  state.started = true;
  console.log('[Rotator] Worker starting...');

  // Register IPC handler
  ipc.handle(ROTATOR_IPC_CHANNELS.REQUEST, async (_, request: RotatorIPCRequest) => {
    if (!request) {
      console.error('[Rotator] Received empty request');
      return;
    }
    handleRequest(request);
  });

  console.log('[Rotator] Worker started');
}

/**
 * Stop the rotator worker and clean up resources
 */
export function stopRotatorWorker(): void {
  console.log('[Rotator] Stopping worker...');

  // Disconnect socket
  if (state.socket) {
    try {
      state.socket.close();
    } catch (e) {
      // Ignore
    }
    state.socket = null;
  }

  state.connected = false;
  state.config = null;
  state.childWindow = null;
  state.started = false;

  console.log('[Rotator] Worker stopped');
}

/**
 * Get current connection status
 */
export function isRotatorConnected(): boolean {
  return state.connected;
}
