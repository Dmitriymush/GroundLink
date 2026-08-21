/**
 * Sine.link Store
 *
 * Manages Sine.link modem connection and drone position tracking.
 * Receives coordinates from sinelink_worker, calculates tracking angles,
 * and provides data for auto-tracking in AzimuthController.
 */

import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { useStorage } from '@vueuse/core';
import { ipcRenderer } from 'electron';
import {
  SINELINK_IPC_CHANNELS,
  ANTENNA_MAVLINK_IPC_CHANNELS,
  DEFAULT_SINELINK_CONFIG,
  DEFAULT_ANTENNA_MAVLINK_CONFIG,
} from '@/services/sinelink/types';
import type {
  SinelinkConfig,
  SinelinkIPCRequest,
  SinelinkIPCResponse,
  AntennaMavlinkConfig,
  AntennaMavlinkIPCRequest,
  AntennaMavlinkIPCResponse,
  SerialPortInfo,
} from '@/services/sinelink/types';
import { calculateTrackingAngles } from '@/services/mavlink/tracking-math';
import type { GeoPosition, TrackingAngles } from '@/services/mavlink/tracking-math';

export const useSinelinkStore = defineStore('sinelink', () => {
  // ============================================================
  // PERSISTED CONFIGURATION
  // ============================================================

  // Sine.link modem (input — drone coordinates)
  const sinelinkPort = useStorage<string>('sinelink-port', DEFAULT_SINELINK_CONFIG.portPath);
  const sinelinkBaud = useStorage<number>('sinelink-baud', DEFAULT_SINELINK_CONFIG.baudRate);
  const sinelinkPollInterval = useStorage<number>('sinelink-poll-interval', DEFAULT_SINELINK_CONFIG.pollIntervalMs);

  // Antenna MAVLink (output — servo commands)
  const antennaTransport = useStorage<'serial' | 'udp'>('antenna-mavlink-transport', DEFAULT_ANTENNA_MAVLINK_CONFIG.transport);
  const antennaPort = useStorage<string>('antenna-mavlink-port', DEFAULT_ANTENNA_MAVLINK_CONFIG.portPath);
  const antennaBaud = useStorage<number>('antenna-mavlink-baud', DEFAULT_ANTENNA_MAVLINK_CONFIG.baudRate);
  const antennaUdpHost = useStorage<string>('antenna-mavlink-udp-host', DEFAULT_ANTENNA_MAVLINK_CONFIG.udpHost);
  const antennaUdpPort = useStorage<number>('antenna-mavlink-udp-port', DEFAULT_ANTENNA_MAVLINK_CONFIG.udpPort);
  const antennaTargetSys = useStorage<number>('antenna-mavlink-target-sys', DEFAULT_ANTENNA_MAVLINK_CONFIG.targetSystemId);
  const antennaTargetComp = useStorage<number>('antenna-mavlink-target-comp', DEFAULT_ANTENNA_MAVLINK_CONFIG.targetComponentId);
  const antennaAzServo = useStorage<number>('antenna-mavlink-az-servo', DEFAULT_ANTENNA_MAVLINK_CONFIG.azimuthServoChannel);
  const antennaElServo = useStorage<number>('antenna-mavlink-el-servo', DEFAULT_ANTENNA_MAVLINK_CONFIG.elevationServoChannel);

  // GCS position (shared — can reuse from mavlink store or set independently)
  const gcsLat = useStorage<number>('sinelink-gcs-lat', 0);
  const gcsLon = useStorage<number>('sinelink-gcs-lon', 0);
  const gcsAlt = useStorage<number>('sinelink-gcs-alt', 0);

  // Tracking
  const trackingEnabled = useStorage<boolean>('sinelink-tracking-enabled', true);

  // ============================================================
  // RUNTIME STATE
  // ============================================================

  // Sine.link connection
  const sinelinkConnected = ref(false);
  const sinelinkConnecting = ref(false);
  const sinelinkError = ref<string | null>(null);

  // Antenna MAVLink connection
  const antennaConnected = ref(false);
  const antennaConnecting = ref(false);
  const antennaError = ref<string | null>(null);
  const antennaHeartbeatReceived = ref(false);
  const antennaParamsLoaded = ref(false); // true when all servo params received

  // AntennaTracker state (from heartbeat)
  const trackerMode = ref<number>(-1); // -1 = unknown
  const trackerArmed = ref(false);
  let modeChangeUntil = 0; // timestamp — ignore heartbeat mode updates until this time
  let lastHeartbeatMode = -1;
  let heartbeatModeCount = 0; // consecutive same-mode heartbeats needed before UI update
  const trackerServo1 = ref(0);
  const trackerServo2 = ref(0);
  const trackerYaw = ref(0);    // compass heading from ATTITUDE (degrees 0-360)
  const trackerPitch = ref(0);  // pitch from ATTITUDE (degrees)
  const lastCommandAck = ref<{ command: number; result: number } | null>(null);

  // Drone position
  const dronePosition = ref<GeoPosition | null>(null);
  const positionValid = ref(false);
  const positionConfidence = ref(0);
  const lastPositionTime = ref(0);

  // Available serial ports
  const availablePorts = ref<SerialPortInfo[]>([]);

  // Tracking output
  const trackingAngles = ref<TrackingAngles | null>(null);

  // ============================================================
  // COMPUTED
  // ============================================================

  const gcsPosition = computed<GeoPosition>(() => ({
    lat: gcsLat.value,
    lon: gcsLon.value,
    alt: gcsAlt.value,
  }));

  const hasGcsPosition = computed(() =>
    gcsLat.value !== 0 || gcsLon.value !== 0
  );

  const isTracking = computed(() =>
    trackingEnabled.value &&
    sinelinkConnected.value &&
    antennaConnected.value &&
    positionValid.value &&
    hasGcsPosition.value
  );

  // ============================================================
  // IPC — SINELINK (input)
  // ============================================================

  function sendSinelinkRequest(request: SinelinkIPCRequest): void {
    ipcRenderer.invoke(SINELINK_IPC_CHANNELS.REQUEST, request);
  }

  function handleSinelinkResponse(response: SinelinkIPCResponse): void {
    switch (response.type) {
      case 'connected':
        sinelinkConnected.value = true;
        sinelinkConnecting.value = false;
        sinelinkError.value = null;
        console.log(`[Sinelink Store] Connected to ${response.portPath}`);
        break;

      case 'disconnected':
        sinelinkConnected.value = false;
        sinelinkConnecting.value = false;
        dronePosition.value = null;
        positionValid.value = false;
        trackingAngles.value = null;
        break;

      case 'position':
        dronePosition.value = { lat: response.lat, lon: response.lon, alt: response.alt };
        positionValid.value = response.valid;
        positionConfidence.value = response.confidence;
        lastPositionTime.value = Date.now();
        updateTracking();
        break;

      case 'ports':
        availablePorts.value = response.ports;
        break;

      case 'error':
        sinelinkError.value = response.message;
        sinelinkConnecting.value = false;
        console.error('[Sinelink Store] Error:', response.message);
        break;
    }
  }

  // ============================================================
  // IPC — ANTENNA MAVLINK (output)
  // ============================================================

  function sendAntennaRequest(request: AntennaMavlinkIPCRequest): void {
    ipcRenderer.invoke(ANTENNA_MAVLINK_IPC_CHANNELS.REQUEST, request);
  }

  function handleAntennaResponse(response: AntennaMavlinkIPCResponse): void {
    switch (response.type) {
      case 'connected':
        antennaConnected.value = true;
        antennaConnecting.value = false;
        antennaError.value = null;
        console.log(`[Sinelink Store] Antenna connected to ${response.portPath}`);
        break;

      case 'disconnected':
        antennaConnected.value = false;
        antennaConnecting.value = false;
        antennaHeartbeatReceived.value = false;
        antennaParamsLoaded.value = false;
        break;

      case 'heartbeat-received':
        antennaHeartbeatReceived.value = true;
        trackerArmed.value = response.armed;
        // Debounced mode update: only update UI after 3 consecutive same-mode heartbeats
        // Prevents flickering during mode transitions
        if (Date.now() > modeChangeUntil) {
          if (response.trackerMode === lastHeartbeatMode) {
            heartbeatModeCount++;
            if (heartbeatModeCount >= 3) {
              trackerMode.value = response.trackerMode;
            }
          } else {
            lastHeartbeatMode = response.trackerMode;
            heartbeatModeCount = 1;
          }
        }
        break;

      case 'servo-output':
        trackerServo1.value = response.servo1;
        trackerServo2.value = response.servo2;
        break;

      case 'attitude':
        trackerYaw.value = response.yaw;
        trackerPitch.value = response.pitch;
        break;

      case 'servo-params':
        antennaParamsLoaded.value = true;
        console.log(`[Sinelink Store] Servo params loaded: S1=${response.servo1Min}-${response.servo1Max}(${response.servo1Trim}) S2=${response.servo2Min}-${response.servo2Max}(${response.servo2Trim})`);
        break;

      case 'command-ack':
        lastCommandAck.value = { command: response.command, result: response.result };
        break;

      case 'ports':
        availablePorts.value = response.ports;
        break;

      case 'error':
        antennaError.value = response.message;
        antennaConnecting.value = false;
        console.error('[Sinelink Store] Antenna error:', response.message);
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

  function connectSinelink(): void {
    if (sinelinkConnected.value || sinelinkConnecting.value) return;
    sinelinkConnecting.value = true;
    sinelinkError.value = null;

    const config: SinelinkConfig = {
      portPath: sinelinkPort.value,
      baudRate: sinelinkBaud.value,
      pollIntervalMs: sinelinkPollInterval.value,
    };
    sendSinelinkRequest({ type: 'connect', config });
  }

  function disconnectSinelink(): void {
    sendSinelinkRequest({ type: 'disconnect' });
    sinelinkConnected.value = false;
    sinelinkConnecting.value = false;
  }

  function connectAntenna(): void {
    if (antennaConnected.value || antennaConnecting.value) return;
    antennaConnecting.value = true;
    antennaError.value = null;

    const config: AntennaMavlinkConfig = {
      transport: antennaTransport.value,
      portPath: antennaPort.value,
      baudRate: antennaBaud.value,
      udpHost: antennaUdpHost.value,
      udpPort: antennaUdpPort.value,
      sendIntervalMs: 500,
      targetSystemId: antennaTargetSys.value,
      targetComponentId: antennaTargetComp.value,
      azimuthServoChannel: antennaAzServo.value,
      elevationServoChannel: antennaElServo.value,
    };
    sendAntennaRequest({ type: 'connect', config });
  }

  function disconnectAntenna(): void {
    sendAntennaRequest({ type: 'disconnect' });
    antennaConnected.value = false;
    antennaConnecting.value = false;
  }

  /**
   * Send servo command to antenna (called from AzimuthController watch)
   * Uses the SAME PWM format as UDP rotator mode
   */
  function sendServoPosition(azimuthPwm: number, elevationCmd: number): void {
    if (!antennaConnected.value) return;
    sendAntennaRequest({ type: 'send-servo', azimuthPwm, elevationCmd });
  }

  /**
   * Send RC override for MANUAL mode (overrides physical RC inputs)
   */
  function sendRcOverride(azimuthPwm: number, elevationPwm: number): void {
    if (!antennaConnected.value) return;
    sendAntennaRequest({ type: 'send-rc-override', azimuthPwm, elevationPwm });
  }

  function refreshPorts(): void {
    sendSinelinkRequest({ type: 'list-ports' });
  }

  function setGcsPosition(lat: number, lon: number, alt: number): void {
    gcsLat.value = lat;
    gcsLon.value = lon;
    gcsAlt.value = alt;
  }

  // AntennaTracker commands
  function setTrackerMode(mode: number): void {
    if (!antennaConnected.value) return;
    // Optimistic update + block heartbeat mode for 5s (prevents flickering during transition)
    trackerMode.value = mode;
    modeChangeUntil = Date.now() + 5000;
    sendAntennaRequest({ type: 'set-mode', mode });
  }

  function setTrackerHome(lat: number, lon: number, alt: number): void {
    if (!antennaConnected.value) return;
    sendAntennaRequest({ type: 'set-home', lat, lon, alt });
  }

  /**
   * Forward drone position to AntennaTracker (for AUTO mode)
   * Tracker will calculate bearing/elevation itself
   */
  function forwardDronePosition(lat: number, lon: number, alt: number, relativeAlt: number, hdg: number): void {
    if (!antennaConnected.value) return;
    sendAntennaRequest({ type: 'forward-position', lat, lon, alt, relativeAlt, hdg });
  }

  // ============================================================
  // INITIALIZATION
  // ============================================================

  try {
    if (ipcRenderer) {
      ipcRenderer.on(SINELINK_IPC_CHANNELS.RESPONSE, (_, response: SinelinkIPCResponse) => {
        handleSinelinkResponse(response);
      });
      ipcRenderer.on(ANTENNA_MAVLINK_IPC_CHANNELS.RESPONSE, (_, response: AntennaMavlinkIPCResponse) => {
        handleAntennaResponse(response);
      });
      console.log('[Sinelink Store] IPC listeners registered');
    }
  } catch (e) {
    console.error('[Sinelink Store] Failed to setup IPC:', e);
  }

  return {
    // Sinelink config (persisted)
    sinelinkPort,
    sinelinkBaud,
    sinelinkPollInterval,

    // Antenna config (persisted)
    antennaTransport,
    antennaPort,
    antennaBaud,
    antennaUdpHost,
    antennaUdpPort,
    antennaTargetSys,
    antennaTargetComp,
    antennaAzServo,
    antennaElServo,

    // GCS config (persisted)
    gcsLat,
    gcsLon,
    gcsAlt,
    trackingEnabled,

    // Sinelink state
    sinelinkConnected,
    sinelinkConnecting,
    sinelinkError,

    // Antenna state
    antennaConnected,
    antennaConnecting,
    antennaError,
    antennaHeartbeatReceived,
    antennaParamsLoaded,

    // AntennaTracker state
    trackerMode,
    trackerArmed,
    trackerServo1,
    trackerServo2,
    trackerYaw,
    trackerPitch,
    lastCommandAck,

    // Drone telemetry
    dronePosition,
    positionValid,
    positionConfidence,
    lastPositionTime,
    trackingAngles,

    // Ports
    availablePorts,

    // Computed
    gcsPosition,
    hasGcsPosition,
    isTracking,

    // Actions
    connectSinelink,
    disconnectSinelink,
    connectAntenna,
    disconnectAntenna,
    sendServoPosition,
    sendRcOverride,
    setTrackerMode,
    setTrackerHome,
    forwardDronePosition,
    refreshPorts,
    setGcsPosition,
  };
});
