/**
 * Rotator Telemetry Parser
 *
 * Parses telemetry frames received from the rotator.
 * Ported from Pascal implementation (uTelemetry.pas)
 *
 * Telemetry format (multi-line):
 * T:<val>
 * R:<val>
 * COM:<degrees>
 * V:<voltage>
 * CH:<checksum>
 */

import { ROTATOR_CONSTANTS } from './types';
import type { RotatorTelemetryFrame } from './types';

/**
 * Parser for rotator telemetry data
 */
export class RotatorTelemetryParser {
  private buffer: string = '';
  private partialData: {
    T?: string;
    R?: string;
    COM?: string;
    V?: string;
    CH?: string;
  } = {};

  /**
   * Feed raw data into the parser
   * Returns parsed frame if complete, null otherwise
   */
  parse(data: string): RotatorTelemetryFrame | null {
    // Add data to buffer
    this.buffer += data;

    // Try to extract complete frames
    return this.extractFrame();
  }

  /**
   * Extract a complete telemetry frame from buffer
   */
  private extractFrame(): RotatorTelemetryFrame | null {
    // Split buffer by delimiters
    const lines = this.buffer.split(/[\n\r;]+/).filter((l) => l.trim());

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Parse key:value pair
      const colonPos = trimmed.indexOf(':');
      if (colonPos === -1) continue;

      const key = trimmed.substring(0, colonPos).toUpperCase().trim();
      const value = trimmed.substring(colonPos + 1).trim();

      // Store parsed values
      switch (key) {
        case 'T':
          this.partialData.T = value;
          break;
        case 'R':
          this.partialData.R = value;
          break;
        case 'COM':
          this.partialData.COM = value;
          break;
        case 'V':
          this.partialData.V = value;
          break;
        case 'CH':
          this.partialData.CH = value;
          break;
      }
    }

    // Check if we have all required fields
    if (this.isComplete()) {
      const frame = this.buildFrame();

      // Clear buffer and partial data for next frame
      this.clear();

      return frame;
    }

    // Prevent buffer from growing too large
    if (this.buffer.length > 1000) {
      // Keep last 500 chars
      this.buffer = this.buffer.slice(-500);
    }

    return null;
  }

  /**
   * Check if all required fields are present
   */
  private isComplete(): boolean {
    const { T, R, COM, V, CH } = this.partialData;
    return !!(T && R && COM && V && CH);
  }

  /**
   * Build telemetry frame from parsed data
   */
  private buildFrame(): RotatorTelemetryFrame {
    const { T, R, COM, V, CH } = this.partialData;

    const transmitterId = parseInt(T!, 10) || 0;
    const receiverId = parseInt(R!, 10) || 0;
    const compassDegrees = this.parseFloat(COM!);
    const voltage = this.parseFloat(V!);
    const checksum = CH!;

    // Verify checksum
    const checksumValid = this.verifyChecksum(
      transmitterId,
      receiverId,
      compassDegrees,
      voltage,
      checksum
    );

    return {
      transmitterId,
      receiverId,
      compassDegrees,
      voltage,
      checksum,
      checksumValid,
      timestamp: Date.now(),
    };
  }

  /**
   * Parse float value, handling both . and , as decimal separator
   */
  private parseFloat(value: string): number {
    // Replace comma with dot for parsing
    const normalized = value.replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Verify checksum (concatenation of T + R + COM + V)
   *
   * Pascal uTelemetry.pas line 96: tmp := sT + sR + sCOM + sV;
   * Uses raw string values as received, no numeric conversion.
   */
  private verifyChecksum(
    _t: number,
    _r: number,
    _com: number,
    _v: number,
    checksum: string
  ): boolean {
    // Pascal checksum: raw string concatenation of the received values
    const expected = `${this.partialData.T}${this.partialData.R}${this.partialData.COM}${this.partialData.V}`;
    return expected === checksum;
  }

  /**
   * Clear parser state
   */
  clear(): void {
    this.buffer = '';
    this.partialData = {};
  }

  /**
   * Reset parser completely
   */
  reset(): void {
    this.clear();
  }

  /**
   * Get current buffer content (for debugging)
   */
  getBuffer(): string {
    return this.buffer;
  }

  /**
   * Get partial data (for debugging)
   */
  getPartialData(): typeof this.partialData {
    return { ...this.partialData };
  }
}

/**
 * Singleton instance
 */
export const defaultTelemetryParser = new RotatorTelemetryParser();
