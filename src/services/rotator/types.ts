/**
 * Rotator Control System - TypeScript Types
 *
 * Protocol based on Pascal implementation from:
 * https://github.com/SkopasGit/rotation
 */

// ============================================================
// CONFIGURATION TYPES
// ============================================================

/**
 * Rotator connection configuration
 */
export interface RotatorConfig {
  /** WIFI232-B2 IP address */
  host: string;
  /** UDP port (default 24448) */
  port: number;
  /** Local port for receiving telemetry (default 24449) */
  localPort: number;
  /** Transmitter ID (default 101) */
  transmitterId: number;
  /** Receiver ID (default 102) */
  receiverId: number;
  /** Command send interval in ms (default 500) */
  sendIntervalMs: number;
}

/**
 * Default configuration values
 */
export const DEFAULT_ROTATOR_CONFIG: RotatorConfig = {
  host: '127.0.0.1',  // Use localhost for simulator testing, change to 192.168.1.200 for real device
  port: 24448,
  localPort: 24449,
  transmitterId: 101,
  receiverId: 102,
  sendIntervalMs: 500,
};

// ============================================================
// PROTOCOL CONSTANTS
// ============================================================

export const ROTATOR_CONSTANTS = {
  // Azimuth limits (protocol degrees)
  AZIMUTH_MIN_DEG: -164,
  AZIMUTH_MAX_DEG: 164,

  // Azimuth PWM range
  AZIMUTH_PWM_MIN: 540,
  AZIMUTH_PWM_MAX: 2400,
  AZIMUTH_PWM_CENTER: 1470,

  // Elevation limits (protocol degrees)
  ELEVATION_MIN_DEG: -10,
  ELEVATION_MAX_DEG: 85,

  // Elevation command range
  ELEVATION_CMD_MIN: 0,
  ELEVATION_CMD_MAX: 95,

  // Dead zone (in UI coordinates 0-359)
  DEAD_ZONE_START: 164,
  DEAD_ZONE_END: 196,

  // Default IDs
  DEFAULT_TRANSMITTER_ID: 101,
  DEFAULT_RECEIVER_ID: 102,

  // Frame delimiters
  FRAME_DELIMITERS: ['\n', '\r', ';'],
} as const;

// ============================================================
// COMMAND TYPES
// ============================================================

/**
 * Command frame sent to rotator
 * Format: T:<T>;R:<R>;X:<PWM>;Y:<CMD>;CH:<CHECKSUM>;
 */
export interface RotatorCommandFrame {
  /** Transmitter ID */
  transmitterId: number;
  /** Receiver ID */
  receiverId: number;
  /** Azimuth PWM value (540-2400) */
  azimuthPWM: number;
  /** Elevation command value (0-95) */
  elevationCmd: number;
  /** Checksum (concatenation of values) */
  checksum: string;
}

// ============================================================
// TELEMETRY TYPES
// ============================================================

/**
 * Telemetry frame received from rotator
 * Format:
 * T:<val>
 * R:<val>
 * COM:<degrees>
 * V:<voltage>
 * CH:<checksum>
 */
export interface RotatorTelemetryFrame {
  /** Transmitter ID */
  transmitterId: number;
  /** Receiver ID */
  receiverId: number;
  /** Current compass position in degrees */
  compassDegrees: number;
  /** Battery voltage */
  voltage: number;
  /** Received checksum */
  checksum: string;
  /** Whether checksum verification passed */
  checksumValid: boolean;
  /** Timestamp when received */
  timestamp: number;
}

// ============================================================
// CONNECTION TYPES
// ============================================================

/**
 * Connection state enumeration
 */
export type RotatorConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

/**
 * Connection error information
 */
export interface RotatorConnectionError {
  code: string;
  message: string;
  timestamp: number;
}

// ============================================================
// STORE STATE TYPES
// ============================================================

/**
 * Complete rotator store state
 */
export interface RotatorState {
  /** Connection configuration */
  config: RotatorConfig;
  /** Current connection state */
  connectionState: RotatorConnectionState;
  /** Last connection error */
  lastError: RotatorConnectionError | null;
  /** Latest telemetry frame */
  telemetry: RotatorTelemetryFrame | null;
  /** Whether rotator control is enabled */
  enabled: boolean;
  /** Number of commands sent */
  commandsSent: number;
  /** Number of telemetry frames received */
  telemetryReceived: number;
}

// ============================================================
// IPC MESSAGE TYPES
// ============================================================

/**
 * Messages sent from renderer to main process
 */
export type RotatorIPCRequest =
  | { type: 'connect'; config: RotatorConfig }
  | { type: 'disconnect' }
  | { type: 'send'; frame: string };

/**
 * Messages sent from main process to renderer
 */
export type RotatorIPCResponse =
  | { type: 'connected' }
  | { type: 'disconnected' }
  | { type: 'telemetry'; data: string }
  | { type: 'error'; error: RotatorConnectionError };

// ============================================================
// IPC CHANNEL NAMES
// ============================================================

export const ROTATOR_IPC_CHANNELS = {
  /** Channel for sending commands to main process */
  REQUEST: 'rotator-request',
  /** Channel for receiving responses from main process */
  RESPONSE: 'rotator-response',
} as const;
