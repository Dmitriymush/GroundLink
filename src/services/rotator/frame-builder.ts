/**
 * Rotator Frame Builder
 *
 * Builds command frames for the rotator protocol.
 * Ported from Pascal implementation (uFrameBuilder.pas)
 *
 * Frame format: T:<T>;R:<R>;X:<PWM>;Y:<CMD>;CH:<CHECKSUM>;
 */

import { mapValue } from '@/utils';
import { ROTATOR_CONSTANTS } from './types';
import type { RotatorCommandFrame } from './types';

/**
 * Frame builder for rotator commands
 */
export class RotatorFrameBuilder {
  private transmitterId: number;
  private receiverId: number;

  constructor(
    transmitterId = ROTATOR_CONSTANTS.DEFAULT_TRANSMITTER_ID,
    receiverId = ROTATOR_CONSTANTS.DEFAULT_RECEIVER_ID
  ) {
    this.transmitterId = transmitterId;
    this.receiverId = receiverId;
  }

  /**
   * Set transmitter and receiver IDs
   */
  setIds(transmitterId: number, receiverId: number): void {
    this.transmitterId = transmitterId;
    this.receiverId = receiverId;
  }

  /**
   * Convert UI azimuth (0-359) to protocol azimuth (-164 to +164)
   * Returns null if in dead zone
   *
   * Matches Pascal ButtonSetAzimutClick:
   *   0..164   → 0..164    (right half, stays positive)
   *   165..195 → dead zone (behind antenna)
   *   196..359 → -164..-1  (left half, subtract 360)
   */
  uiToProtocolAzimuth(uiDegrees: number): number | null {
    // Dead zone: 165-195 (behind antenna, ~32° gap)
    if (uiDegrees > 164 && uiDegrees < 196) {
      return null;
    }

    // Left half: 196-359 → subtract 360 to get -164..-1
    if (uiDegrees >= 196) {
      return uiDegrees - 360;
    }

    // Right half: 0-164 stays as-is
    return uiDegrees;
  }

  /**
   * Convert protocol azimuth (-164 to +164) to PWM value (540-2400)
   */
  azimuthToPWM(degrees: number): number {
    const {
      AZIMUTH_MIN_DEG,
      AZIMUTH_MAX_DEG,
      AZIMUTH_PWM_MIN,
      AZIMUTH_PWM_MAX,
    } = ROTATOR_CONSTANTS;

    // Clamp to valid range
    const clamped = Math.max(AZIMUTH_MIN_DEG, Math.min(AZIMUTH_MAX_DEG, degrees));

    // Linear mapping
    return mapValue(
      clamped,
      AZIMUTH_MIN_DEG,
      AZIMUTH_MAX_DEG,
      AZIMUTH_PWM_MIN,
      AZIMUTH_PWM_MAX
    );
  }

  /**
   * Convert UI elevation (0-90) to protocol elevation (-10 to +85)
   */
  uiToProtocolElevation(uiDegrees: number): number {
    const { ELEVATION_MIN_DEG, ELEVATION_MAX_DEG } = ROTATOR_CONSTANTS;

    // UI 0 = Protocol -10, UI 90 = Protocol 80
    // Shift by -10
    const protocolDeg = uiDegrees - 10;

    return Math.max(ELEVATION_MIN_DEG, Math.min(ELEVATION_MAX_DEG, protocolDeg));
  }

  /**
   * Convert protocol elevation (-10 to +85) to command value (0-95)
   */
  elevationToCommand(degrees: number): number {
    const { ELEVATION_CMD_MIN, ELEVATION_CMD_MAX } = ROTATOR_CONSTANTS;

    // Add 10 to shift -10..+85 to 0..95
    const cmd = Math.round(degrees + 10);

    return Math.max(ELEVATION_CMD_MIN, Math.min(ELEVATION_CMD_MAX, cmd));
  }

  /**
   * Check if UI azimuth is in dead zone (164-196 degrees)
   */
  isInDeadZone(uiAzimuth: number): boolean {
    const { DEAD_ZONE_START, DEAD_ZONE_END } = ROTATOR_CONSTANTS;
    return uiAzimuth > DEAD_ZONE_START && uiAzimuth < DEAD_ZONE_END;
  }

  /**
   * Calculate checksum (concatenation of T + R + X + Y as strings)
   */
  calculateChecksum(t: number, r: number, x: number, y: number): string {
    return `${t}${r}${x}${y}`;
  }

  /**
   * Build command frame from UI coordinates
   * Returns null if azimuth is in dead zone
   */
  buildFrame(uiAzimuth: number, uiElevation: number): RotatorCommandFrame | null {
    // Convert azimuth
    const protocolAzimuth = this.uiToProtocolAzimuth(uiAzimuth);
    if (protocolAzimuth === null) {
      return null; // Dead zone
    }

    const azimuthPWM = this.azimuthToPWM(protocolAzimuth);

    // Convert elevation
    const protocolElevation = this.uiToProtocolElevation(uiElevation);
    const elevationCmd = this.elevationToCommand(protocolElevation);

    // Calculate checksum
    const checksum = this.calculateChecksum(
      this.transmitterId,
      this.receiverId,
      azimuthPWM,
      elevationCmd
    );

    return {
      transmitterId: this.transmitterId,
      receiverId: this.receiverId,
      azimuthPWM,
      elevationCmd,
      checksum,
    };
  }

  /**
   * Serialize frame to protocol string
   * Format: T:<T>;R:<R>;X:<PWM>;Y:<CMD>;CH:<CHECKSUM>;\r\n
   */
  serializeFrame(frame: RotatorCommandFrame): string {
    return `T:${frame.transmitterId};R:${frame.receiverId};X:${frame.azimuthPWM};Y:${frame.elevationCmd};CH:${frame.checksum};\r\n`;
  }

  /**
   * Build and serialize frame in one call
   * Returns null if azimuth is in dead zone
   */
  buildSerializedFrame(uiAzimuth: number, uiElevation: number): string | null {
    const frame = this.buildFrame(uiAzimuth, uiElevation);
    if (!frame) {
      return null;
    }
    return this.serializeFrame(frame);
  }
}

/**
 * Singleton instance with default configuration
 */
export const defaultFrameBuilder = new RotatorFrameBuilder();
