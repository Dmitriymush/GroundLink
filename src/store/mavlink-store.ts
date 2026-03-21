/**
 * MAVLink Auto-Tracking Store
 *
 * Manages MAVLink UDP connection, drone position tracking,
 * and auto-tracking angle calculations.
 */

import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useStorage } from '@vueuse/core';
import { ipcRenderer } from 'electron';
import {
  MAVLINK_IPC_CHANNELS,
  DEFAULT_MAVLINK_CONFIG,
} from '@/services/mavlink/types';
import type {
  MavlinkConfig,
  MavlinkIPCRequest,
  MavlinkIPCResponse,
} from '@/services/mavlink/types';
import { calculateTrackingAngles } from '@/services/mavlink/tracking-math';
import type { GeoPosition, TrackingAngles } from '@/services/mavlink/tracking-math';

export const useMavlinkStore = defineStore('mavlink', () => {
  // ============================================================
  // PERSISTED CONFIGURATION
  // ============================================================

  const mavlinkPort = useStorage<number>('mavlink-port', DEFAULT_MAVLINK_CONFIG.port);
  const mavlinkBindAddress = useStorage<string>('mavlink-bind-address', DEFAULT_MAVLINK_CONFIG.bindAddress);

  // Ground station position (operator enters once, persisted)
  const gcsLat = useStorage<number>('mavlink-gcs-lat', 0);
  const gcsLon = useStorage<number>('mavlink-gcs-lon', 0);
  const gcsAlt = useStorage<number>('mavlink-gcs-alt', 0);

  // Auto-tracking enabled
  const trackingEnabled = useStorage<boolean>('mavlink-tracking-enabled', true);

  // ============================================================
  // RUNTIME STATE
  // ============================================================

  const connected = ref(false);
  const connecting = ref(false);
  const lastError = ref<string | null>(null);

  // Drone telemetry
  const dronePosition = ref<GeoPosition | null>(null);
  const droneHdg = ref(0);
  const droneSystemId = ref(0);
  const droneAutopilot = ref(0);
  const droneMavType = ref(0);
  const heartbeatReceived = ref(false);
  const positionReceived = ref(false);
  const lastPositionTime = ref(0);

  // Tracking output
  const trackingAngles = ref<TrackingAngles | null>(null);

  // ============================================================
  // COMPUTED
  // ============================================================

  const config = computed<MavlinkConfig>(() => ({
    port: mavlinkPort.value,
    bindAddress: mavlinkBindAddress.value,
  }));

  const gcsPosition = computed<GeoPosition>(() => ({
    lat: gcsLat.value,
    lon: gcsLon.value,
    alt: gcsAlt.value,
  }));

  const hasGcsPosition = computed(() =>
    gcsLat.value !== 0 || gcsLon.value !== 0
  );

  const isTracking = computed(() =>
    trackingEnabled.value && connected.value && positionReceived.value && hasGcsPosition.value
  );

  // ============================================================
  // IPC COMMUNICATION
  // ============================================================

  function sendRequest(request: MavlinkIPCRequest): void {
    ipcRenderer.invoke(MAVLINK_IPC_CHANNELS.REQUEST, request);
  }

  function handleResponse(response: MavlinkIPCResponse): void {
    switch (response.type) {
      case 'connected':
        connected.value = true;
        connecting.value = false;
        lastError.value = null;
        console.log(`[MAVLink Store] Listening on port ${response.port}`);
        break;

      case 'disconnected':
        connected.value = false;
        connecting.value = false;
        heartbeatReceived.value = false;
        positionReceived.value = false;
        dronePosition.value = null;
        trackingAngles.value = null;
        break;

      case 'heartbeat':
        heartbeatReceived.value = true;
        droneSystemId.value = response.systemId;
        droneAutopilot.value = response.autopilot;
        droneMavType.value = response.mavType;
        break;

      case 'position':
        positionReceived.value = true;
        lastPositionTime.value = Date.now();
        dronePosition.value = {
          lat: response.lat,
          lon: response.lon,
          alt: response.alt,
        };
        droneHdg.value = response.hdg;
        updateTracking();
        break;

      case 'error':
        lastError.value = response.message;
        connecting.value = false;
        console.error('[MAVLink Store] Error:', response.message);
        break;
    }
  }

  // ============================================================
  // TRACKING
  // ============================================================

  function updateTracking(): void {
    if (!dronePosition.value || !hasGcsPosition.value) {
      trackingAngles.value = null;
      return;
    }
    trackingAngles.value = calculateTrackingAngles(gcsPosition.value, dronePosition.value);
  }

  // Recalculate when GCS position changes
  watch([gcsLat, gcsLon, gcsAlt], () => {
    if (dronePosition.value) updateTracking();
  });

  // ============================================================
  // ACTIONS
  // ============================================================

  function connect(): void {
    if (connected.value || connecting.value) return;
    connecting.value = true;
    lastError.value = null;
    heartbeatReceived.value = false;
    positionReceived.value = false;
    sendRequest({ type: 'connect', config: config.value });
  }

  function disconnect(): void {
    sendRequest({ type: 'disconnect' });
    connected.value = false;
    connecting.value = false;
  }

  function setGcsPosition(lat: number, lon: number, alt: number): void {
    gcsLat.value = lat;
    gcsLon.value = lon;
    gcsAlt.value = alt;
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  try {
    if (ipcRenderer) {
      ipcRenderer.on(MAVLINK_IPC_CHANNELS.RESPONSE, (_, response: MavlinkIPCResponse) => {
        handleResponse(response);
      });
      console.log('[MAVLink Store] IPC listener registered');
    }
  } catch (e) {
    console.error('[MAVLink Store] Failed to setup IPC:', e);
  }

  return {
    // Config (persisted)
    mavlinkPort,
    mavlinkBindAddress,
    gcsLat,
    gcsLon,
    gcsAlt,
    trackingEnabled,

    // State
    connected,
    connecting,
    lastError,
    dronePosition,
    droneHdg,
    droneSystemId,
    droneAutopilot,
    droneMavType,
    heartbeatReceived,
    positionReceived,
    lastPositionTime,
    trackingAngles,

    // Computed
    config,
    gcsPosition,
    hasGcsPosition,
    isTracking,

    // Actions
    connect,
    disconnect,
    setGcsPosition,
  };
});
