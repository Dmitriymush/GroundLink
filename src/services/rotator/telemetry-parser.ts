/**
 * Rotator Telemetry Parser
 *
 * Parses telemetry frames received from the rotator.
 *
 * Telemetry format:
 *   T:<val>;R:<val>;COM:<degrees>;V:<voltage>;CH:<checksum>;\r\n
 *   COM: current compass position (degrees)
 *   V: battery voltage (float)
 *   CH: checksum = raw string concat of T + R + COM + V
 */

import { ROTATOR_CONSTANTS } from './types';
import type { RotatorTelemetryFrame } from './types';

export class RotatorTelemetryParser {
  private buffer: string = '';
  private partialData: {
    T?: string;
    R?: string;
    COM?: string;
    V?: string;
    CH?: string;
  } = {};

  parse(data: string): RotatorTelemetryFrame | null {
    this.buffer += data;
    return this.extractFrame();
  }

  private extractFrame(): RotatorTelemetryFrame | null {
    const lines = this.buffer.split(/[\n\r;]+/).filter((l) => l.trim());

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const colonPos = trimmed.indexOf(':');
      if (colonPos === -1) continue;

      const key = trimmed.substring(0, colonPos).toUpperCase().trim();
      const value = trimmed.substring(colonPos + 1).trim();

      switch (key) {
        case 'T': this.partialData.T = value; break;
        case 'R': this.partialData.R = value; break;
        case 'COM': this.partialData.COM = value; break;
        case 'V': this.partialData.V = value; break;
        case 'CH': this.partialData.CH = value; break;
      }
    }

    if (this.isComplete()) {
      const frame = this.buildFrame();
      this.clear();
      return frame;
    }

    if (this.buffer.length > 1000) {
      this.buffer = this.buffer.slice(-500);
    }

    return null;
  }

  private isComplete(): boolean {
    const { T, R, COM, V, CH } = this.partialData;
    return !!(T && R && COM && V && CH);
  }

  private buildFrame(): RotatorTelemetryFrame {
    const { T, R, COM, V, CH } = this.partialData;

    const transmitterId = parseInt(T!, 10) || 0;
    const receiverId = parseInt(R!, 10) || 0;
    const compassDegrees = this.parseFloatVal(COM!);
    const voltage = this.parseFloatVal(V!);
    const checksum = CH!;

    const expected = `${T}${R}${COM}${V}`;
    const checksumValid = expected === checksum;

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

  private parseFloatVal(value: string): number {
    const normalized = value.replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  }

  clear(): void {
    this.buffer = '';
    this.partialData = {};
  }

  reset(): void {
    this.clear();
  }

  getBuffer(): string {
    return this.buffer;
  }

  getPartialData(): typeof this.partialData {
    return { ...this.partialData };
  }
}

export const defaultTelemetryParser = new RotatorTelemetryParser();
