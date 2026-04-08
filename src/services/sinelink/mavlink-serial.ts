/**
 * MAVLink v1/v2 Serial Frame Builder/Parser
 *
 * Builds MAVLink v1 frames and parses both v1 and v2 for serial communication.
 * Used by both Sine.link input (FILE_TRANSFER_PROTOCOL) and
 * antenna output (COMMAND_LONG / DO_SET_SERVO).
 *
 * MAVLink v1 frame: [0xFE] [len] [seq] [sysid] [compid] [msgid] [payload...] [crc_lo] [crc_hi]
 * MAVLink v2 frame: [0xFD] [len] [incompat] [compat] [seq] [sysid] [compid] [msgid_lo] [msgid_mid] [msgid_hi] [payload...] [crc_lo] [crc_hi]
 */

// MAVLink constants
const MAVLINK_STX_V1 = 0xFE;
const MAVLINK_STX_V2 = 0xFD;
const MAVLINK_HEADER_LEN = 6; // v1: STX + len + seq + sysid + compid + msgid
const MAVLINK_V2_HEADER_LEN = 10; // v2: STX + len + incompat + compat + seq + sysid + compid + msgid(3)

// Message IDs
export const MAVLINK_MSG_ID_HEARTBEAT = 0;
export const MAVLINK_MSG_ID_COMMAND_LONG = 76;
export const MAVLINK_MSG_ID_FILE_TRANSFER_PROTOCOL = 110;

// CRC extras for each message type (from MAVLink spec)
const CRC_EXTRAS: Record<number, number> = {
  [MAVLINK_MSG_ID_HEARTBEAT]: 50,
  [MAVLINK_MSG_ID_COMMAND_LONG]: 152,
  [MAVLINK_MSG_ID_FILE_TRANSFER_PROTOCOL]: 84,
};

// MAVLink commands
export const MAV_CMD_DO_SET_SERVO = 183;

/**
 * X.25 CRC checksum (used by MAVLink)
 */
function crcAccumulate(byte: number, crc: number): number {
  const tmp = (byte ^ (crc & 0xFF)) & 0xFF;
  const tmp2 = (tmp ^ (tmp << 4)) & 0xFF;
  return ((crc >> 8) ^ (tmp2 << 8) ^ (tmp2 << 3) ^ (tmp2 >> 4)) & 0xFFFF;
}

function crcCalculate(buffer: Uint8Array, crcExtra: number): number {
  let crc = 0xFFFF;
  for (let i = 0; i < buffer.length; i++) {
    crc = crcAccumulate(buffer[i], crc);
  }
  crc = crcAccumulate(crcExtra, crc);
  return crc;
}

/**
 * Stateful MAVLink v1 serial frame builder
 */
export class MavlinkSerialBuilder {
  private seq = 0;
  private systemId: number;
  private componentId: number;

  constructor(systemId = 255, componentId = 190) {
    this.systemId = systemId;
    this.componentId = componentId;
  }

  /**
   * Build a MAVLink v1 frame
   */
  buildFrame(msgId: number, payload: Uint8Array): Buffer {
    const frame = Buffer.alloc(MAVLINK_HEADER_LEN + payload.length + 2);

    // Header
    frame[0] = MAVLINK_STX_V1;
    frame[1] = payload.length;
    frame[2] = this.seq++ & 0xFF;
    frame[3] = this.systemId;
    frame[4] = this.componentId;
    frame[5] = msgId;

    // Payload
    payload.forEach((b, i) => { frame[6 + i] = b; });

    // CRC (over header[1..5] + payload)
    const crcExtra = CRC_EXTRAS[msgId] ?? 0;
    const crcData = frame.subarray(1, 6 + payload.length);
    const crc = crcCalculate(crcData, crcExtra);
    frame[6 + payload.length] = crc & 0xFF;
    frame[7 + payload.length] = (crc >> 8) & 0xFF;

    return frame;
  }

  /**
   * Build FILE_TRANSFER_PROTOCOL message (msgId=110)
   * Payload: [target_network(1)] [target_system(1)] [target_component(1)] [payload(251)]
   */
  buildFtpMessage(targetNet: number, targetSys: number, targetComp: number, ftpPayload: Uint8Array): Buffer {
    const payload = Buffer.alloc(253); // 1+1+1+251 = 254, but MAVLink FTP is 253 bytes
    payload[0] = targetNet;
    payload[1] = targetSys;
    payload[2] = targetComp;
    ftpPayload.forEach((b, i) => {
      if (i < 251) payload[3 + i] = b;
    });
    return this.buildFrame(MAVLINK_MSG_ID_FILE_TRANSFER_PROTOCOL, payload);
  }

  /**
   * Build COMMAND_LONG message for DO_SET_SERVO
   * Used to control antenna servos
   */
  buildSetServo(
    targetSystem: number,
    targetComponent: number,
    servoChannel: number,
    pwmValue: number,
  ): Buffer {
    // COMMAND_LONG payload: 7 floats (param1-7) + command(u16) + target_system(u8) + target_component(u8) + confirmation(u8)
    // Total: 33 bytes
    const payload = Buffer.alloc(33);
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

    // param1: servo number (float32 LE)
    view.setFloat32(0, servoChannel, true);
    // param2: PWM value (float32 LE)
    view.setFloat32(4, pwmValue, true);
    // param3-7: 0
    view.setFloat32(8, 0, true);
    view.setFloat32(12, 0, true);
    view.setFloat32(16, 0, true);
    view.setFloat32(20, 0, true);
    view.setFloat32(24, 0, true);
    // command: MAV_CMD_DO_SET_SERVO (uint16 LE)
    view.setUint16(28, MAV_CMD_DO_SET_SERVO, true);
    // target_system
    payload[30] = targetSystem;
    // target_component
    payload[31] = targetComponent;
    // confirmation
    payload[32] = 0;

    return this.buildFrame(MAVLINK_MSG_ID_COMMAND_LONG, payload);
  }

  /**
   * Build a heartbeat message (used to maintain connection)
   * type=6 (GCS), autopilot=8 (invalid), base_mode=0, custom_mode=0, system_status=0
   */
  buildHeartbeat(): Buffer {
    const payload = Buffer.alloc(9);
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

    // custom_mode (uint32 LE)
    view.setUint32(0, 0, true);
    // type (uint8) - MAV_TYPE_GCS = 6
    payload[4] = 6;
    // autopilot (uint8) - MAV_AUTOPILOT_INVALID = 8
    payload[5] = 8;
    // base_mode
    payload[6] = 0;
    // system_status - MAV_STATE_ACTIVE = 4
    payload[7] = 4;
    // mavlink_version
    payload[8] = 3;

    return this.buildFrame(MAVLINK_MSG_ID_HEARTBEAT, payload);
  }
}

/**
 * Parse incoming MAVLink v1 and v2 frames from serial data
 */
export class MavlinkSerialParser {
  private buffer = Buffer.alloc(0);

  reset(): void {
    this.buffer = Buffer.alloc(0);
  }

  /**
   * Feed raw serial bytes, returns parsed frames
   */
  feed(data: Buffer): ParsedMavlinkFrame[] {
    this.buffer = Buffer.concat([this.buffer, data]);
    const frames: ParsedMavlinkFrame[] = [];

    while (this.buffer.length >= 8) {
      // Find start byte (v1=0xFE or v2=0xFD)
      let startIdx = -1;
      for (let i = 0; i < this.buffer.length; i++) {
        if (this.buffer[i] === MAVLINK_STX_V1 || this.buffer[i] === MAVLINK_STX_V2) {
          startIdx = i;
          break;
        }
      }
      if (startIdx < 0) {
        this.buffer = Buffer.alloc(0);
        break;
      }
      if (startIdx > 0) {
        this.buffer = this.buffer.subarray(startIdx);
      }

      const isV2 = this.buffer[0] === MAVLINK_STX_V2;
      const headerLen = isV2 ? MAVLINK_V2_HEADER_LEN : MAVLINK_HEADER_LEN;

      if (this.buffer.length < headerLen) break;

      const payloadLen = this.buffer[1];
      const frameLen = headerLen + payloadLen + 2;
      if (this.buffer.length < frameLen) break;

      let msgId: number;
      let sysId: number;
      let compId: number;

      if (isV2) {
        sysId = this.buffer[5];
        compId = this.buffer[6];
        msgId = this.buffer[7] | (this.buffer[8] << 8) | (this.buffer[9] << 16);
      } else {
        sysId = this.buffer[3];
        compId = this.buffer[4];
        msgId = this.buffer[5];
      }

      const crcExtra = CRC_EXTRAS[msgId];
      if (crcExtra === undefined) {
        // Unknown message — skip this start byte
        this.buffer = this.buffer.subarray(1);
        continue;
      }

      // Verify CRC (over header[1..] + payload)
      const crcData = this.buffer.subarray(1, headerLen + payloadLen);
      const expectedCrc = crcCalculate(crcData, crcExtra);
      const receivedCrc = this.buffer[headerLen + payloadLen] |
                          (this.buffer[headerLen + payloadLen + 1] << 8);

      if (expectedCrc !== receivedCrc) {
        this.buffer = this.buffer.subarray(1);
        continue;
      }

      const payload = Buffer.from(this.buffer.subarray(headerLen, headerLen + payloadLen));
      frames.push({ systemId: sysId, componentId: compId, msgId, payload });

      this.buffer = this.buffer.subarray(frameLen);
    }

    // Prevent buffer overflow
    if (this.buffer.length > 4096) {
      this.buffer = this.buffer.subarray(this.buffer.length - 280);
    }

    return frames;
  }
}

export interface ParsedMavlinkFrame {
  systemId: number;
  componentId: number;
  msgId: number;
  payload: Buffer;
}

/**
 * Extract FTP payload from FILE_TRANSFER_PROTOCOL message
 * Returns the inner payload (251 bytes after target_network, target_system, target_component)
 */
export function extractFtpPayload(frame: ParsedMavlinkFrame): { targetNet: number; targetSys: number; targetComp: number; payload: Buffer } | null {
  if (frame.msgId !== MAVLINK_MSG_ID_FILE_TRANSFER_PROTOCOL) return null;
  if (frame.payload.length < 4) return null;

  return {
    targetNet: frame.payload[0],
    targetSys: frame.payload[1],
    targetComp: frame.payload[2],
    payload: Buffer.from(frame.payload.subarray(3)),
  };
}
