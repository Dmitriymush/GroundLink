/**
 * MAVLink Auto-Tracking — Types
 */

import type { GeoPosition } from './tracking-math';

// ============================================================
// CONFIGURATION
// ============================================================

export interface MavlinkConfig {
  /** UDP port to listen on for MAVLink telemetry (default 14550) */
  port: number;
  /** Bind address (default 0.0.0.0 — all interfaces) */
  bindAddress: string;
}

export const DEFAULT_MAVLINK_CONFIG: MavlinkConfig = {
  port: 14550,
  bindAddress: '0.0.0.0',
};

// ============================================================
// IPC TYPES
// ============================================================

export type MavlinkIPCRequest =
  | { type: 'connect'; config: MavlinkConfig }
  | { type: 'disconnect' };

export type MavlinkIPCResponse =
  | { type: 'connected'; port: number }
  | { type: 'disconnected' }
  | { type: 'heartbeat'; systemId: number; autopilot: number; mavType: number }
  | { type: 'position'; lat: number; lon: number; alt: number; relativeAlt: number; hdg: number }
  | { type: 'error'; code: string; message: string };

export const MAVLINK_IPC_CHANNELS = {
  REQUEST: 'mavlink-request',
  RESPONSE: 'mavlink-response',
} as const;
