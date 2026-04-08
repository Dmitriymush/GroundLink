/**
 * Sine.link Integration — Types
 *
 * IPC types for communication between main process workers and renderer.
 */

// ============================================================
// SINELINK INPUT (get drone coordinates from Sine.link modem)
// ============================================================

export interface SinelinkConfig {
  /** Serial port path (e.g. /dev/ttyUSB0, COM3) */
  portPath: string;
  /** Baud rate (default 115200) */
  baudRate: number;
  /** Polling interval for viGetPose in ms (default 500) */
  pollIntervalMs: number;
}

export const DEFAULT_SINELINK_CONFIG: SinelinkConfig = {
  portPath: '',
  baudRate: 115200,
  pollIntervalMs: 500,
};

export type SinelinkIPCRequest =
  | { type: 'connect'; config: SinelinkConfig }
  | { type: 'disconnect' }
  | { type: 'list-ports' };

export type SinelinkIPCResponse =
  | { type: 'connected'; portPath: string }
  | { type: 'disconnected' }
  | { type: 'position'; lat: number; lon: number; alt: number; valid: boolean; confidence: number; ts: number }
  | { type: 'link-stats'; localQuality: number; remoteQuality: number; localVoltage: number; remoteVoltage: number }
  | { type: 'ports'; ports: SerialPortInfo[] }
  | { type: 'error'; code: string; message: string };

export interface SerialPortInfo {
  path: string;
  manufacturer?: string;
  serialNumber?: string;
  vendorId?: string;
  productId?: string;
}

export const SINELINK_IPC_CHANNELS = {
  REQUEST: 'sinelink-request',
  RESPONSE: 'sinelink-response',
} as const;

// ============================================================
// ANTENNA MAVLINK OUTPUT (send servo commands to antenna device)
// ============================================================

export interface AntennaMavlinkConfig {
  /** Serial port path for antenna device */
  portPath: string;
  /** Baud rate (default 115200) */
  baudRate: number;
  /** Send interval in ms (default 500, matches rotator UDP interval) */
  sendIntervalMs: number;
  /** MAVLink target system ID (default 2 — ArduPilot antenna tracker) */
  targetSystemId: number;
  /** MAVLink target component ID (default 0) */
  targetComponentId: number;
  /** Servo channel for azimuth (default 1) */
  azimuthServoChannel: number;
  /** Servo channel for elevation (default 2) */
  elevationServoChannel: number;
}

export const DEFAULT_ANTENNA_MAVLINK_CONFIG: AntennaMavlinkConfig = {
  portPath: '',
  baudRate: 57600,
  sendIntervalMs: 500,
  targetSystemId: 2,
  targetComponentId: 0,
  azimuthServoChannel: 1,
  elevationServoChannel: 2,
};

export type AntennaMavlinkIPCRequest =
  | { type: 'connect'; config: AntennaMavlinkConfig }
  | { type: 'disconnect' }
  | { type: 'send-servo'; azimuthPwm: number; elevationCmd: number }
  | { type: 'list-ports' };

export type AntennaMavlinkIPCResponse =
  | { type: 'connected'; portPath: string }
  | { type: 'disconnected' }
  | { type: 'heartbeat-received'; systemId: number; componentId: number }
  | { type: 'ports'; ports: SerialPortInfo[] }
  | { type: 'error'; code: string; message: string };

export const ANTENNA_MAVLINK_IPC_CHANNELS = {
  REQUEST: 'antenna-mavlink-request',
  RESPONSE: 'antenna-mavlink-response',
} as const;

// ============================================================
// MAVLINK CONSTANTS
// ============================================================

/** Sine.link always uses SYS_ID=83 for MAVLink FTP */
export const SINE_MAVLINK_SYS_ID = 83;
/** Link modem COMP_ID=76 */
export const SINE_MAVLINK_COMP_ID = 76;
/** MAVLink target network (always 0) */
export const SINE_MAVLINK_NET = 0;
