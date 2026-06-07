/**
 * Camera Worker
 *
 * Handles RTSP video streaming via ffmpeg → WebSocket → jsmpeg (renderer)
 * and ONVIF PTZ camera control.
 *
 * Flow:
 *   RTSP Camera → ffmpeg (MPEG1 transcode) → WebSocket (port 9999) → jsmpeg (canvas)
 *   PTZ commands → ONVIF protocol → Camera
 */

import { ipcMain, BrowserWindow } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import {
  CAMERA_IPC_CHANNELS,
} from '../../src/services/camera/types';
import type {
  CameraConfig,
  CameraIPCRequest,
  CameraIPCResponse,
} from '../../src/services/camera/types';

// WebSocket server for streaming
let wss: any = null;
let ffmpegProcess: ChildProcess | null = null;
let onvifDevice: any = null;
let currentConfig: CameraConfig | null = null;
const childWindows = new Set<BrowserWindow>();
let started = false;

function sendToRenderer(response: CameraIPCResponse): void {
  for (const win of childWindows) {
    if (win.isDestroyed()) {
      childWindows.delete(win);
      continue;
    }
    try {
      win.webContents.send(CAMERA_IPC_CHANNELS.RESPONSE, response);
    } catch (e) {
      console.error('[Camera] Failed to send to renderer:', e);
    }
  }
}

/**
 * Get ffmpeg binary path (bundled via ffmpeg-static)
 */
function getFfmpegPath(): string {
  try {
    return require('ffmpeg-static');
  } catch {
    return 'ffmpeg'; // fallback to system ffmpeg
  }
}

/**
 * Start RTSP stream: ffmpeg → WebSocket
 */
async function startStream(config: CameraConfig): Promise<void> {
  await stopStream();
  currentConfig = config;

  const ffmpegPath = getFfmpegPath();
  console.log(`[Camera] ffmpeg path: ${ffmpegPath}`);
  console.log(`[Camera] RTSP URL: ${config.rtspUrl}`);
  console.log(`[Camera] Resolution: ${config.width}x${config.height} @ ${config.fps}fps`);
  console.log(`[Camera] WebSocket port: ${config.wsPort}`);

  try {
    // Start WebSocket server
    const WebSocket = require('ws');
    wss = new WebSocket.Server({ port: config.wsPort });

    const clients = new Set<any>();
    wss.on('connection', (ws: any) => {
      clients.add(ws);
      console.log(`[Camera] WebSocket client connected (${clients.size} total)`);
      ws.on('close', () => {
        clients.delete(ws);
        console.log(`[Camera] WebSocket client disconnected (${clients.size} total)`);
      });
    });

    // Start ffmpeg: RTSP → MPEG1 → stdout
    const args = [
      '-rtsp_transport', 'tcp',
      '-i', config.rtspUrl,
      '-f', 'mpegts',
      '-codec:v', 'mpeg1video',
      '-s', `${config.width}x${config.height}`,
      '-b:v', '1000k',
      '-r', String(config.fps),
      '-bf', '0',
      '-an', // no audio
      '-q:v', '5',
      'pipe:1',
    ];

    ffmpegProcess = spawn(ffmpegPath, args);

    ffmpegProcess.stdout?.on('data', (data: Buffer) => {
      // Broadcast to all WebSocket clients
      for (const client of clients) {
        if (client.readyState === 1) { // WebSocket.OPEN
          try { client.send(data); } catch (_) {}
        }
      }
    });

    ffmpegProcess.stderr?.on('data', (data: Buffer) => {
      const msg = data.toString().trim();
      if (msg && !msg.includes('frame=')) {
        console.log(`[Camera] ffmpeg: ${msg.substring(0, 200)}`);
      }
    });

    ffmpegProcess.on('close', (code) => {
      console.log(`[Camera] ffmpeg exited with code ${code}`);
      if (code !== 0 && code !== null) {
        sendToRenderer({ type: 'stream-error', message: `ffmpeg exited with code ${code}` });
      }
    });

    ffmpegProcess.on('error', (err) => {
      console.error('[Camera] ffmpeg error:', err);
      sendToRenderer({ type: 'stream-error', message: err.message });
    });

    sendToRenderer({ type: 'stream-started', wsPort: config.wsPort });
    console.log(`[Camera] Stream started on ws://localhost:${config.wsPort}`);

    // Connect ONVIF for PTZ
    connectOnvif(config);

  } catch (e) {
    const error = e as Error;
    console.error('[Camera] Start stream failed:', error);
    sendToRenderer({ type: 'error', code: 'START_FAILED', message: error.message });
  }
}

/**
 * Stop RTSP stream
 */
async function stopStream(): Promise<void> {
  if (ffmpegProcess) {
    try { ffmpegProcess.kill('SIGTERM'); } catch (_) {}
    ffmpegProcess = null;
  }

  if (wss) {
    try {
      wss.clients?.forEach((client: any) => {
        try { client.close(); } catch (_) {}
      });
      wss.close();
    } catch (_) {}
    wss = null;
  }

  onvifDevice = null;
  currentConfig = null;
  sendToRenderer({ type: 'stream-stopped' });
  console.log('[Camera] Stream stopped');
}

/**
 * Change resolution: restart ffmpeg with new size
 */
async function changeResolution(width: number, height: number): Promise<void> {
  if (!currentConfig) return;
  currentConfig.width = width;
  currentConfig.height = height;
  console.log(`[Camera] Changing resolution to ${width}x${height}`);
  await startStream(currentConfig);
}

/**
 * Connect to camera ONVIF service for PTZ control
 */
function connectOnvif(config: CameraConfig): void {
  try {
    const onvif = require('onvif');
    const Cam = onvif.Cam;

    new Cam({
      hostname: config.onvifHost,
      port: config.onvifPort,
      username: config.username,
      password: config.password,
    }, function(this: any, err: Error | null) {
      if (err) {
        console.error('[Camera] ONVIF connection failed:', err.message);
        sendToRenderer({ type: 'onvif-error', message: err.message });
        return;
      }

      onvifDevice = this;
      const hasPtz = !!this.ptzService;
      console.log(`[Camera] ONVIF connected, PTZ: ${hasPtz}`);
      sendToRenderer({ type: 'onvif-connected', hasPtr: hasPtz });
    });
  } catch (e) {
    const error = e as Error;
    console.error('[Camera] ONVIF init failed:', error.message);
    sendToRenderer({ type: 'onvif-error', message: error.message });
  }
}

/**
 * PTZ continuous move
 * pan/tilt/zoom: -1.0 to 1.0 (0 = stop)
 */
function ptzMove(pan: number, tilt: number, zoom: number): void {
  if (!onvifDevice) {
    console.warn('[Camera] PTZ: no ONVIF device');
    return;
  }

  try {
    onvifDevice.continuousMove({
      x: pan,
      y: tilt,
      zoom: zoom,
    }, (err: Error | null) => {
      if (err) console.error('[Camera] PTZ move error:', err.message);
    });
  } catch (e) {
    console.error('[Camera] PTZ move failed:', e);
  }
}

/**
 * PTZ stop
 */
function ptzStop(): void {
  if (!onvifDevice) return;
  try {
    onvifDevice.stop({}, (err: Error | null) => {
      if (err) console.error('[Camera] PTZ stop error:', err.message);
    });
  } catch (e) {
    console.error('[Camera] PTZ stop failed:', e);
  }
}

/**
 * PTZ go to home position
 */
function ptzHome(): void {
  if (!onvifDevice) return;
  try {
    onvifDevice.gotoHomePosition({}, (err: Error | null) => {
      if (err) console.error('[Camera] PTZ home error:', err.message);
    });
  } catch (e) {
    console.error('[Camera] PTZ home failed:', e);
  }
}

async function handleRequest(request: CameraIPCRequest): Promise<void> {
  console.log('[Camera] Received request:', request.type);
  switch (request.type) {
    case 'start-stream':
      await startStream(request.config);
      break;
    case 'stop-stream':
      await stopStream();
      break;
    case 'change-resolution':
      await changeResolution(request.width, request.height);
      break;
    case 'ptz-move':
      ptzMove(request.pan, request.tilt, request.zoom);
      break;
    case 'ptz-stop':
      ptzStop();
      break;
    case 'ptz-home':
      ptzHome();
      break;
  }
}

export function setCameraChildWindow(childWindow: BrowserWindow | null): void {
  if (childWindow) {
    childWindows.add(childWindow);
    childWindow.on('closed', () => {
      childWindows.delete(childWindow);
    });
  }
}

export function cameraWorker({ ipcMain: ipc }: { ipcMain: typeof ipcMain }): void {
  if (started) return;
  started = true;
  console.log('[Camera] Worker starting...');

  ipc.handle(CAMERA_IPC_CHANNELS.REQUEST, async (_, request: CameraIPCRequest) => {
    if (!request) return;
    await handleRequest(request);
  });

  console.log('[Camera] Worker started');
}

export function stopCameraWorker(): void {
  if (ffmpegProcess) {
    try { ffmpegProcess.kill('SIGTERM'); } catch (_) {}
    ffmpegProcess = null;
  }
  if (wss) {
    try { wss.close(); } catch (_) {}
    wss = null;
  }
  onvifDevice = null;
  childWindows.clear();
  started = false;
}
