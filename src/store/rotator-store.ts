/**
 * Rotator Control Store
 *
 * Pinia store for managing rotator state and communication.
 * Handles IPC with main process UDP worker.
 */

import { defineStore } from 'pinia';
import { ref, computed, watch, onUnmounted } from 'vue';
import { useStorage } from '@vueuse/core';
import { ipcRenderer } from 'electron';
import {
  DEFAULT_ROTATOR_CONFIG,
  ROTATOR_IPC_CHANNELS,
} from '@/services/rotator/types';
import type {
  RotatorConfig,
  RotatorConnectionState,
  RotatorConnectionError,
  RotatorTelemetryFrame,
  RotatorIPCRequest,
  RotatorIPCResponse,
} from '@/services/rotator/types';
import {
  RotatorFrameBuilder,
  RotatorTelemetryParser,
} from '@/services/rotator';

export const useRotatorStore = defineStore('rotator', () => {
  // ============================================================
  // PERSISTED CONFIGURATION
  // ============================================================

  const configHost = useStorage<string>('rotator-host', DEFAULT_ROTATOR_CONFIG.host);
  const configPort = useStorage<number>('rotator-port', DEFAULT_ROTATOR_CONFIG.port);
  const configLocalPort = useStorage<number>('rotator-local-port', DEFAULT_ROTATOR_CONFIG.localPort);
  const configTransmitterId = useStorage<number>('rotator-transmitter-id', DEFAULT_ROTATOR_CONFIG.transmitterId);
  const configReceiverId = useStorage<number>('rotator-receiver-id', DEFAULT_ROTATOR_CONFIG.receiverId);
  const configSendIntervalMs = useStorage<number>('rotator-send-interval', DEFAULT_ROTATOR_CONFIG.sendIntervalMs);
  const rotatorEnabled = useStorage<boolean>('rotator-enabled', false);

  /** Control mode: 'udp' = current WIFI232-B2 protocol, 'mavlink' = auto-tracking via MAVLink */
  const controlMode = useStorage<'udp' | 'mavlink'>('rotator-control-mode', 'udp');

  // ============================================================
  // RUNTIME STATE
  // ============================================================

  const connectionState = ref<RotatorConnectionState>('disconnected');
  const lastError = ref<RotatorConnectionError | null>(null);
  const telemetry = ref<RotatorTelemetryFrame | null>(null);
  const commandsSent = ref<number>(0);
  const telemetryReceived = ref<number>(0);
  const telemetryConnected = ref<boolean>(false);

  // Telemetry timeout — if no response within this time, warn user
  const TELEMETRY_TIMEOUT_MS = 5000;
  const telemetryTimedOut = ref<boolean>(false);

  // Internal state
  const frameBuilder = new RotatorFrameBuilder();
  const telemetryParser = new RotatorTelemetryParser();
  let sendInterval: ReturnType<typeof setInterval> | null = null;
  let telemetryTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  let currentAzimuth = 0;
  let currentElevation = 0;

  // ============================================================
  // COMPUTED
  // ============================================================

  const config = computed<RotatorConfig>(() => ({
    host: configHost.value,
    port: configPort.value,
    localPort: configLocalPort.value,
    transmitterId: configTransmitterId.value,
    receiverId: configReceiverId.value,
    sendIntervalMs: configSendIntervalMs.value,
  }));

  const isConnected = computed(() => connectionState.value === 'connected');
  const isConnecting = computed(() => connectionState.value === 'connecting');
  const hasError = computed(() => connectionState.value === 'error');

  // ============================================================
  // IPC COMMUNICATION
  // ============================================================

  /**
   * Send request to main process
   */
  function sendRequest(request: RotatorIPCRequest): void {
    ipcRenderer.invoke(ROTATOR_IPC_CHANNELS.REQUEST, request);
  }

  /**
   * Handle response from main process
   */
  function handleResponse(response: RotatorIPCResponse): void {
    switch (response.type) {
      case 'connected':
        connectionState.value = 'connected';
        lastError.value = null;
        telemetryTimedOut.value = false;
        startSendLoop();
        startTelemetryTimeout();
        break;

      case 'disconnected':
        connectionState.value = 'disconnected';
        stopSendLoop();
        break;

      case 'telemetry':
        handleTelemetry(response.data);
        break;

      case 'error':
        lastError.value = response.error;
        connectionState.value = 'error';
        console.error('[Rotator Store] Error:', response.error);
        break;
    }
  }

  /**
   * Parse and store telemetry data
   */
  function handleTelemetry(data: string): void {
    const frame = telemetryParser.parse(data);
    if (frame) {
      telemetry.value = frame;
      telemetryReceived.value++;

      // Mark as telemetry-connected on first frame
      if (!telemetryConnected.value) {
        telemetryConnected.value = true;
        telemetryTimedOut.value = false;
        clearTelemetryTimeout();
        console.log('[Rotator Store] First telemetry received — device confirmed connected');
      }

      // Update frame builder IDs from telemetry
      if (frame.transmitterId && frame.receiverId) {
        frameBuilder.setIds(frame.receiverId, frame.transmitterId);
      }
    }
  }

  // ============================================================
  // SEND LOOP
  // ============================================================

  /**
   * Start periodic command sending
   */
  function startSendLoop(): void {
    stopSendLoop();

    sendInterval = setInterval(() => {
      sendPosition(currentAzimuth, currentElevation);
    }, configSendIntervalMs.value);
  }

  /**
   * Stop periodic command sending
   */
  function stopSendLoop(): void {
    if (sendInterval) {
      clearInterval(sendInterval);
      sendInterval = null;
    }
  }

  /**
   * Start timeout — if no telemetry arrives, mark as timed out
   */
  function startTelemetryTimeout(): void {
    clearTelemetryTimeout();
    telemetryTimeoutTimer = setTimeout(() => {
      if (isConnected.value && !telemetryConnected.value) {
        telemetryTimedOut.value = true;
        console.warn('[Rotator Store] No telemetry received within timeout — device not responding');
      }
    }, TELEMETRY_TIMEOUT_MS);
  }

  function clearTelemetryTimeout(): void {
    if (telemetryTimeoutTimer) {
      clearTimeout(telemetryTimeoutTimer);
      telemetryTimeoutTimer = null;
    }
  }

  /**
   * Send current position to rotator
   */
  function sendPosition(azimuth: number, elevation: number): void {
    if (!isConnected.value) {
      console.log('[Rotator Store] Not connected, skipping send');
      return;
    }

    const frame = frameBuilder.buildSerializedFrame(azimuth, elevation);
    if (frame) {
      console.log('[Rotator Store] Sending frame:', frame.trim());
      sendRequest({ type: 'send', frame });
      commandsSent.value++;
    } else {
      console.log('[Rotator Store] Dead zone, skipping send');
    }
  }

  // ============================================================
  // ACTIONS
  // ============================================================

  /**
   * Connect to rotator
   */
  function connect(): void {
    console.log('[Rotator Store] Connect called, state:', connectionState.value);
    if (isConnected.value || isConnecting.value) {
      console.log('[Rotator Store] Already connected or connecting');
      return;
    }

    connectionState.value = 'connecting';
    lastError.value = null;
    telemetryConnected.value = false;
    console.log('[Rotator Store] Sending connect request to main process...');

    // Initialize at 0 azimuth, 0 pitch
    currentAzimuth = 0;
    currentElevation = 0;

    // Update frame builder with current IDs
    frameBuilder.setIds(configTransmitterId.value, configReceiverId.value);

    sendRequest({ type: 'connect', config: config.value });
  }

  /**
   * Disconnect from rotator
   */
  function disconnect(): void {
    stopSendLoop();
    clearTelemetryTimeout();
    sendRequest({ type: 'disconnect' });
    connectionState.value = 'disconnected';
    telemetryConnected.value = false;
    telemetryTimedOut.value = false;
    telemetry.value = null;
    telemetryParser.reset();
  }

  /**
   * Update target position
   * Called by AzimuthController when position changes
   * Note: Does NOT send immediately - waits for next interval (like Pascal app)
   */
  function setTargetPosition(azimuth: number, elevation: number): void {
    currentAzimuth = azimuth;
    currentElevation = elevation;
    // Position will be sent on next interval tick
  }

  /**
   * Update configuration
   */
  function updateConfig(newConfig: Partial<RotatorConfig>): void {
    if (newConfig.host !== undefined) configHost.value = newConfig.host;
    if (newConfig.port !== undefined) configPort.value = newConfig.port;
    if (newConfig.localPort !== undefined) configLocalPort.value = newConfig.localPort;
    if (newConfig.transmitterId !== undefined) configTransmitterId.value = newConfig.transmitterId;
    if (newConfig.receiverId !== undefined) configReceiverId.value = newConfig.receiverId;
    if (newConfig.sendIntervalMs !== undefined) configSendIntervalMs.value = newConfig.sendIntervalMs;

    // Restart send loop with new interval if connected
    if (isConnected.value && newConfig.sendIntervalMs !== undefined) {
      startSendLoop();
    }
  }

  /**
   * Reset configuration to defaults
   */
  function resetConfig(): void {
    updateConfig(DEFAULT_ROTATOR_CONFIG);
  }

  /**
   * Enable/disable rotator
   */
  function setEnabled(enabled: boolean): void {
    rotatorEnabled.value = enabled;
    if (enabled && !isConnected.value) {
      connect();
    } else if (!enabled && isConnected.value) {
      disconnect();
    }
  }

  /**
   * Clear error state
   */
  function clearError(): void {
    lastError.value = null;
    if (connectionState.value === 'error') {
      connectionState.value = 'disconnected';
    }
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  // Set up IPC listener with error handling
  try {
    if (ipcRenderer) {
      ipcRenderer.on(ROTATOR_IPC_CHANNELS.RESPONSE, (_, response: RotatorIPCResponse) => {
        handleResponse(response);
      });
      console.log('[Rotator Store] IPC listener registered');
    } else {
      console.warn('[Rotator Store] ipcRenderer not available');
    }
  } catch (e) {
    console.error('[Rotator Store] Failed to setup IPC:', e);
  }

  // Auto-connect if enabled
  if (rotatorEnabled.value) {
    // Delay connection to allow app to fully initialize
    setTimeout(() => {
      if (rotatorEnabled.value && !isConnected.value) {
        connect();
      }
    }, 1000);
  }

  // ============================================================
  // CLEANUP
  // ============================================================

  // Note: In Pinia stores, cleanup happens when the store is disposed
  // For component-level cleanup, use onUnmounted in the component

  return {
    // Configuration (persisted)
    config,
    configHost,
    configPort,
    configLocalPort,
    configTransmitterId,
    configReceiverId,
    configSendIntervalMs,
    rotatorEnabled,
    controlMode,

    // State
    connectionState,
    lastError,
    telemetry,
    commandsSent,
    telemetryReceived,
    telemetryConnected,
    telemetryTimedOut,

    // Computed
    isConnected,
    isConnecting,
    hasError,

    // Actions
    connect,
    disconnect,
    setTargetPosition,
    updateConfig,
    resetConfig,
    setEnabled,
    clearError,
  };
});
