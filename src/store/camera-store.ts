/**
 * Camera Store
 *
 * Manages RTSP video stream connection and ONVIF PTZ control.
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { useStorage } from '@vueuse/core';
import { ipcRenderer } from 'electron';
import {
  CAMERA_IPC_CHANNELS,
  DEFAULT_CAMERA_CONFIG,
} from '@/services/camera/types';
import type {
  CameraConfig,
  CameraIPCRequest,
  CameraIPCResponse,
} from '@/services/camera/types';

export const useCameraStore = defineStore('camera', () => {
  // ============================================================
  // PERSISTED CONFIGURATION
  // ============================================================

  const rtspUrl = useStorage<string>('camera-rtsp-url', DEFAULT_CAMERA_CONFIG.rtspUrl);
  const onvifHost = useStorage<string>('camera-onvif-host', DEFAULT_CAMERA_CONFIG.onvifHost);
  const onvifPort = useStorage<number>('camera-onvif-port', DEFAULT_CAMERA_CONFIG.onvifPort);
  const username = useStorage<string>('camera-username', DEFAULT_CAMERA_CONFIG.username);
  const password = useStorage<string>('camera-password', DEFAULT_CAMERA_CONFIG.password);
  const wsPort = useStorage<number>('camera-ws-port', DEFAULT_CAMERA_CONFIG.wsPort);
  const width = useStorage<number>('camera-width', DEFAULT_CAMERA_CONFIG.width);
  const height = useStorage<number>('camera-height', DEFAULT_CAMERA_CONFIG.height);
  const fps = useStorage<number>('camera-fps', DEFAULT_CAMERA_CONFIG.fps);

  // ============================================================
  // RUNTIME STATE
  // ============================================================

  const streaming = ref(false);
  const connecting = ref(false);
  const error = ref<string | null>(null);
  const activeWsPort = ref(0);
  const onvifConnected = ref(false);
  const hasPtz = ref(false);

  // ============================================================
  // IPC
  // ============================================================

  function sendRequest(request: CameraIPCRequest): void {
    ipcRenderer.invoke(CAMERA_IPC_CHANNELS.REQUEST, request);
  }

  function handleResponse(response: CameraIPCResponse): void {
    switch (response.type) {
      case 'stream-started':
        streaming.value = true;
        connecting.value = false;
        activeWsPort.value = response.wsPort;
        error.value = null;
        console.log(`[Camera Store] Stream started on ws://localhost:${response.wsPort}`);
        break;

      case 'stream-stopped':
        streaming.value = false;
        connecting.value = false;
        activeWsPort.value = 0;
        onvifConnected.value = false;
        hasPtz.value = false;
        break;

      case 'stream-error':
        error.value = response.message;
        connecting.value = false;
        console.error('[Camera Store] Stream error:', response.message);
        break;

      case 'onvif-connected':
        onvifConnected.value = true;
        hasPtz.value = response.hasPtr;
        console.log(`[Camera Store] ONVIF connected, PTZ: ${response.hasPtr}`);
        break;

      case 'onvif-error':
        console.warn('[Camera Store] ONVIF error:', response.message);
        break;

      case 'error':
        error.value = response.message;
        connecting.value = false;
        break;
    }
  }

  // ============================================================
  // ACTIONS
  // ============================================================

  function startStream(): void {
    if (streaming.value || connecting.value) return;
    connecting.value = true;
    error.value = null;

    const config: CameraConfig = {
      rtspUrl: rtspUrl.value,
      onvifHost: onvifHost.value,
      onvifPort: onvifPort.value,
      username: username.value,
      password: password.value,
      wsPort: wsPort.value,
      width: width.value,
      height: height.value,
      fps: fps.value,
    };
    sendRequest({ type: 'start-stream', config });
  }

  function stopStream(): void {
    sendRequest({ type: 'stop-stream' });
    streaming.value = false;
    connecting.value = false;
  }

  function changeResolution(w: number, h: number): void {
    width.value = w;
    height.value = h;
    if (streaming.value) {
      sendRequest({ type: 'change-resolution', width: w, height: h });
    }
  }

  function ptzMove(pan: number, tilt: number, zoom: number): void {
    sendRequest({ type: 'ptz-move', pan, tilt, zoom });
  }

  function ptzStop(): void {
    sendRequest({ type: 'ptz-stop' });
  }

  function ptzHome(): void {
    sendRequest({ type: 'ptz-home' });
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  try {
    if (ipcRenderer) {
      ipcRenderer.on(CAMERA_IPC_CHANNELS.RESPONSE, (_, response: CameraIPCResponse) => {
        handleResponse(response);
      });
      console.log('[Camera Store] IPC listener registered');
    }
  } catch (e) {
    console.error('[Camera Store] Failed to setup IPC:', e);
  }

  return {
    // Config (persisted)
    rtspUrl,
    onvifHost,
    onvifPort,
    username,
    password,
    wsPort,
    width,
    height,
    fps,

    // State
    streaming,
    connecting,
    error,
    activeWsPort,
    onvifConnected,
    hasPtz,

    // Actions
    startStream,
    stopStream,
    changeResolution,
    ptzMove,
    ptzStop,
    ptzHome,
  };
});
