/**
 * Lightweight MAVLink v1/v2 Parser
 *
 * Only parses messages needed for antenna auto-tracking:
 * - HEARTBEAT (msg 0) — connection status
 * - GLOBAL_POSITION_INT (msg 33) — drone GPS position
 */

// MAVLink start bytes
const MAVLINK_V1_START = 0xfe;
const MAVLINK_V2_START = 0xfd;

// CRC extras per message ID (from MAVLink XML definitions)
const CRC_EXTRAS: Record<number, number> = {
  0: 50,   // HEARTBEAT
  33: 104, // GLOBAL_POSITION_INT
};

// ============================================================
// PARSED MESSAGE TYPES
// ============================================================

export interface MavlinkHeartbeat {
  msgId: 0;
  systemId: number;
  componentId: number;
  type: number;        // MAV_TYPE
  autopilot: number;   // MAV_AUTOPILOT
  baseMode: number;
  customMode: number;
  systemStatus: number;
  mavlinkVersion: number;
}

export interface MavlinkGlobalPositionInt {
  msgId: 33;
  systemId: number;
  componentId: number;
  timeBootMs: number;
  lat: number;   // degrees (converted from degE7)
  lon: number;   // degrees (converted from degE7)
  alt: number;   // meters MSL (converted from mm)
  relativeAlt: number; // meters AGL (converted from mm)
  vx: number;    // m/s (converted from cm/s)
  vy: number;    // m/s
  vz: number;    // m/s
  hdg: number;   // degrees (converted from cdeg, 0-360)
}

export type MavlinkMessage = MavlinkHeartbeat | MavlinkGlobalPositionInt;

// ============================================================
// X.25 CRC (MAVLink checksum)
// ============================================================

function crcAccumulate(byte: number, crc: number): number {
  let tmp = byte ^ (crc & 0xff);
  tmp ^= (tmp << 4) & 0xff;
  return ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xffff;
}

function crcCalculate(buffer: Uint8Array, crcExtra: number): number {
  let crc = 0xffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = crcAccumulate(buffer[i], crc);
  }
  crc = crcAccumulate(crcExtra, crc);
  return crc;
}

// ============================================================
// PAYLOAD PARSERS
// ============================================================

function parseHeartbeat(payload: DataView, systemId: number, componentId: number): MavlinkHeartbeat {
  return {
    msgId: 0,
    systemId,
    componentId,
    customMode: payload.getUint32(0, true),
    type: payload.getUint8(4),
    autopilot: payload.getUint8(5),
    baseMode: payload.getUint8(6),
    systemStatus: payload.getUint8(7),
    mavlinkVersion: payload.getUint8(8),
  };
}

function safeGetInt32(view: DataView, offset: number): number {
  return offset + 4 <= view.byteLength ? view.getInt32(offset, true) : 0;
}
function safeGetUint32(view: DataView, offset: number): number {
  return offset + 4 <= view.byteLength ? view.getUint32(offset, true) : 0;
}
function safeGetInt16(view: DataView, offset: number): number {
  return offset + 2 <= view.byteLength ? view.getInt16(offset, true) : 0;
}
function safeGetUint16(view: DataView, offset: number): number {
  return offset + 2 <= view.byteLength ? view.getUint16(offset, true) : 0;
}

function parseGlobalPositionInt(payload: DataView, systemId: number, componentId: number): MavlinkGlobalPositionInt {
  return {
    msgId: 33,
    systemId,
    componentId,
    timeBootMs: safeGetUint32(payload, 0),
    lat: safeGetInt32(payload, 4) / 1e7,
    lon: safeGetInt32(payload, 8) / 1e7,
    alt: safeGetInt32(payload, 12) / 1000,
    relativeAlt: safeGetInt32(payload, 16) / 1000,
    vx: safeGetInt16(payload, 20) / 100,
    vy: safeGetInt16(payload, 22) / 100,
    vz: safeGetInt16(payload, 24) / 100,
    hdg: safeGetUint16(payload, 26) / 100,
  };
}

// ============================================================
// MAIN PARSER
// ============================================================

export class MavlinkParser {
  private buffer: Buffer = Buffer.alloc(0);

  /**
   * Feed raw bytes into the parser. Returns parsed messages (if any).
   */
  feed(data: Buffer): MavlinkMessage[] {
    this.buffer = Buffer.concat([this.buffer, data]);
    const messages: MavlinkMessage[] = [];

    while (this.buffer.length > 0) {
      const msg = this.tryParse();
      if (!msg) break;
      messages.push(msg);
    }

    // Prevent buffer from growing indefinitely
    if (this.buffer.length > 4096) {
      this.buffer = this.buffer.subarray(this.buffer.length - 280);
    }

    return messages;
  }

  private tryParse(): MavlinkMessage | null {
    // Find start byte
    let startIdx = -1;
    for (let i = 0; i < this.buffer.length; i++) {
      if (this.buffer[i] === MAVLINK_V1_START || this.buffer[i] === MAVLINK_V2_START) {
        startIdx = i;
        break;
      }
    }

    if (startIdx === -1) {
      this.buffer = Buffer.alloc(0);
      return null;
    }

    // Discard bytes before start
    if (startIdx > 0) {
      this.buffer = this.buffer.subarray(startIdx);
    }

    const isV2 = this.buffer[0] === MAVLINK_V2_START;

    if (isV2) {
      return this.tryParseV2();
    } else {
      return this.tryParseV1();
    }
  }

  private tryParseV1(): MavlinkMessage | null {
    // V1 header: STX(1) + len(1) + seq(1) + sysid(1) + compid(1) + msgid(1) = 6 bytes
    // Then payload(len) + checksum(2)
    if (this.buffer.length < 8) return null; // minimum: 6 header + 0 payload + 2 crc

    const payloadLen = this.buffer[1];
    const totalLen = 6 + payloadLen + 2;

    if (this.buffer.length < totalLen) return null;

    const seq = this.buffer[2];
    const systemId = this.buffer[3];
    const componentId = this.buffer[4];
    const msgId = this.buffer[5];

    // Only parse messages we care about
    const crcExtra = CRC_EXTRAS[msgId];
    if (crcExtra === undefined) {
      // Skip this message
      this.buffer = this.buffer.subarray(totalLen);
      return null;
    }

    // Verify CRC (over bytes 1..5+payloadLen, excluding STX and checksum)
    const crcData = this.buffer.subarray(1, 6 + payloadLen);
    const expectedCrc = crcCalculate(new Uint8Array(crcData), crcExtra);
    const receivedCrc = this.buffer[6 + payloadLen] | (this.buffer[6 + payloadLen + 1] << 8);

    if (expectedCrc !== receivedCrc) {
      // CRC mismatch — skip this byte and try again
      this.buffer = this.buffer.subarray(1);
      return null;
    }

    const payload = new DataView(this.buffer.buffer, this.buffer.byteOffset + 6, payloadLen);
    this.buffer = this.buffer.subarray(totalLen);

    return this.parsePayload(msgId, payload, systemId, componentId);
  }

  private tryParseV2(): MavlinkMessage | null {
    // V2 header: STX(1) + len(1) + incompat(1) + compat(1) + seq(1) + sysid(1) + compid(1) + msgid(3) = 10 bytes
    // Then payload(len) + checksum(2) + optional signature(13)
    if (this.buffer.length < 12) return null; // minimum: 10 header + 0 payload + 2 crc

    const payloadLen = this.buffer[1];
    const incompatFlags = this.buffer[2];
    const hasSigning = (incompatFlags & 0x01) !== 0;
    const totalLen = 10 + payloadLen + 2 + (hasSigning ? 13 : 0);

    if (this.buffer.length < totalLen) return null;

    const systemId = this.buffer[5];
    const componentId = this.buffer[6];
    const msgId = this.buffer[7] | (this.buffer[8] << 8) | (this.buffer[9] << 16);

    const crcExtra = CRC_EXTRAS[msgId];
    if (crcExtra === undefined) {
      this.buffer = this.buffer.subarray(totalLen);
      return null;
    }

    // CRC over bytes 1..9+payloadLen (excluding STX and checksum)
    const crcData = this.buffer.subarray(1, 10 + payloadLen);
    const expectedCrc = crcCalculate(new Uint8Array(crcData), crcExtra);
    const receivedCrc = this.buffer[10 + payloadLen] | (this.buffer[10 + payloadLen + 1] << 8);

    if (expectedCrc !== receivedCrc) {
      this.buffer = this.buffer.subarray(1);
      return null;
    }

    const payload = new DataView(this.buffer.buffer, this.buffer.byteOffset + 10, payloadLen);
    this.buffer = this.buffer.subarray(totalLen);

    return this.parsePayload(msgId, payload, systemId, componentId);
  }

  private parsePayload(msgId: number, payload: DataView, systemId: number, componentId: number): MavlinkMessage | null {
    switch (msgId) {
      case 0: return parseHeartbeat(payload, systemId, componentId);
      case 33: return parseGlobalPositionInt(payload, systemId, componentId);
      default: return null;
    }
  }

  reset(): void {
    this.buffer = Buffer.alloc(0);
  }
}
