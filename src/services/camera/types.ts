/**
 * Camera Service Types
 *
 * IPC types for RTSP video streaming and ONVIF PTZ control.
 */

export interface CameraConfig {
  /** RTSP stream URL (e.g., rtsp://192.168.1.100:8554/stream) */
  rtspUrl: string;
  /** ONVIF device host for PTZ control */
  onvifHost: string;
  /** ONVIF port (default 80) */
  onvifPort: number;
  /** Camera username */
  username: string;
  /** Camera password */
  password: string;
  /** WebSocket port for jsmpeg (default 9999) */
  wsPort: number;
  /** Video resolution width */
  width: number;
  /** Video resolution height */
  height: number;
  /** Frames per second */
  fps: number;
}

export const DEFAULT_CAMERA_CONFIG: CameraConfig = {
  rtspUrl: 'rtsp://127.0.0.1:8554/stream',
  onvifHost: '127.0.0.1',
  onvifPort: 80,
  username: 'admin',
  password: 'admin',
  wsPort: 9999,
  width: 640,
  height: 480,
  fps: 25,
};

export const CAMERA_RESOLUTIONS = [
  { label: '320x240', width: 320, height: 240 },
  { label: '640x480', width: 640, height: 480 },
  { label: '800x600', width: 800, height: 600 },
  { label: '1280x720 (HD)', width: 1280, height: 720 },
  { label: '1920x1080 (Full HD)', width: 1920, height: 1080 },
];

export type CameraIPCRequest =
  | { type: 'start-stream'; config: CameraConfig }
  | { type: 'stop-stream' }
  | { type: 'change-resolution'; width: number; height: number }
  | { type: 'ptz-move'; pan: number; tilt: number; zoom: number }
  | { type: 'ptz-stop' }
  | { type: 'ptz-home' };

export type CameraIPCResponse =
  | { type: 'stream-started'; wsPort: number }
  | { type: 'stream-stopped' }
  | { type: 'stream-error'; message: string }
  | { type: 'onvif-connected'; hasPtr: boolean }
  | { type: 'onvif-error'; message: string }
  | { type: 'error'; code: string; message: string };

export const CAMERA_IPC_CHANNELS = {
  REQUEST: 'camera-request',
  RESPONSE: 'camera-response',
} as const;
