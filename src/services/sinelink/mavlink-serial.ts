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
export const MAVLINK_MSG_ID_SET_MODE = 11;
export const MAVLINK_MSG_ID_GLOBAL_POSITION_INT = 33;
export const MAVLINK_MSG_ID_SERVO_OUTPUT_RAW = 36;
export const MAVLINK_MSG_ID_NAV_CONTROLLER_OUTPUT = 62;
export const MAVLINK_MSG_ID_COMMAND_LONG = 76;
export const MAVLINK_MSG_ID_RC_CHANNELS_OVERRIDE = 70;
export const MAVLINK_MSG_ID_COMMAND_ACK = 77;
export const MAVLINK_MSG_ID_FILE_TRANSFER_PROTOCOL = 110;

// CRC extras for each message type (from MAVLink spec)
const CRC_EXTRAS: Record<number, number> = {
  [MAVLINK_MSG_ID_HEARTBEAT]: 50,
  [MAVLINK_MSG_ID_SET_MODE]: 89,
  [MAVLINK_MSG_ID_GLOBAL_POSITION_INT]: 104,
  [MAVLINK_MSG_ID_SERVO_OUTPUT_RAW]: 222,
  [MAVLINK_MSG_ID_NAV_CONTROLLER_OUTPUT]: 183,
  [MAVLINK_MSG_ID_RC_CHANNELS_OVERRIDE]: 124,
  [MAVLINK_MSG_ID_COMMAND_LONG]: 152,
  [MAVLINK_MSG_ID_COMMAND_ACK]: 143,
  [MAVLINK_MSG_ID_FILE_TRANSFER_PROTOCOL]: 84,
};

// MAVLink commands
export const MAV_CMD_DO_SET_MODE = 176;
export const MAV_CMD_DO_SET_HOME = 179;
export const MAV_CMD_DO_SET_SERVO = 183;

// ArduPilot AntennaTracker modes
export const TRACKER_MODE = {
  MANUAL: 0,
  STOP: 1,
  SCAN: 2,
  SERVO_TEST: 3,
  AUTO: 10,
  INITIALISING: 16,
} as const;

export type TrackerModeName = keyof typeof TRACKER_MODE;

export const TRACKER_MODE_NAMES: Record<number, TrackerModeName> = {
  0: 'MANUAL',
  1: 'STOP',
  2: 'SCAN',
  3: 'SERVO_TEST',
  10: 'AUTO',
  16: 'INITIALISING',
};

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
   * Build a MAVLink v2 frame (0xFD)
   * v2 header: [0xFD] [len] [incompat_flags] [compat_flags] [seq] [sysid] [compid] [msgid_lo] [msgid_mid] [msgid_hi]
   */
  buildFrame(msgId: number, payload: Uint8Array): Buffer {
    const frame = Buffer.alloc(MAVLINK_V2_HEADER_LEN + payload.length + 2);

    // v2 Header
    frame[0] = MAVLINK_STX_V2;
    frame[1] = payload.length;
    frame[2] = 0; // incompat_flags
    frame[3] = 0; // compat_flags
    frame[4] = this.seq++ & 0xFF;
    frame[5] = this.systemId;
    frame[6] = this.componentId;
    frame[7] = msgId & 0xFF;        // msgid low
    frame[8] = (msgId >> 8) & 0xFF;  // msgid mid
    frame[9] = (msgId >> 16) & 0xFF; // msgid high

    // Payload
    payload.forEach((b, i) => { frame[MAVLINK_V2_HEADER_LEN + i] = b; });

    // CRC (over header[1..9] + payload)
    const crcExtra = CRC_EXTRAS[msgId] ?? 0;
    const crcData = frame.subarray(1, MAVLINK_V2_HEADER_LEN + payload.length);
    const crc = crcCalculate(crcData, crcExtra);
    frame[MAVLINK_V2_HEADER_LEN + payload.length] = crc & 0xFF;
    frame[MAVLINK_V2_HEADER_LEN + payload.length + 1] = (crc >> 8) & 0xFF;

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
   * Used to control antenna servos in SERVO_TEST mode
   */
  buildSetServo(targetSystem: number, targetComponent: number, servoChannel: number, pwmValue: number): Buffer {
    return this.buildCommandLong(targetSystem, targetComponent, MAV_CMD_DO_SET_SERVO, servoChannel, pwmValue);
  }

  /**
   * Build ARM/DISARM command (MAV_CMD_COMPONENT_ARM_DISARM = 400)
   * param1: 1=arm, 0=disarm
   */
  buildArm(targetSystem: number, targetComponent: number, arm: boolean): Buffer {
    return this.buildCommandLong(targetSystem, targetComponent, 400, arm ? 1 : 0);
  }

  /**
   * Build RC_CHANNELS_OVERRIDE (msgId=70) — override RC inputs for MANUAL mode
   * Allows controlling antenna from GCS in MANUAL mode (overrides physical RC)
   * Payload: [chan1-8 (u16 each)] [target_system(u8)] [target_component(u8)]
   * chan value 0 = no override (keep current), 65535 = release override
   */
  buildRcOverride(targetSystem: number, targetComponent: number, yawPwm: number, pitchPwm: number): Buffer {
    const payload = Buffer.alloc(18);
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

    // ArduPilot AntennaTracker: CH1=yaw(azimuth), CH2=pitch(elevation)
    view.setUint16(0, yawPwm, true);     // ch1 - yaw (azimuth)
    view.setUint16(2, pitchPwm, true);   // ch2 - pitch (elevation)
    view.setUint16(4, 0, true);          // ch3 - no override
    view.setUint16(6, 0, true);          // ch4 - no override
    view.setUint16(8, 0, true);          // ch5 - no override
    view.setUint16(10, 0, true);         // ch6
    view.setUint16(12, 0, true);         // ch7
    view.setUint16(14, 0, true);         // ch8
    // target_system
    payload[16] = targetSystem;
    // target_component
    payload[17] = targetComponent;

    return this.buildFrame(MAVLINK_MSG_ID_RC_CHANNELS_OVERRIDE, payload);
  }

  /**
   * Build SET_MODE message (msgId=11) — switch AntennaTracker mode
   * Uses dedicated SET_MODE message instead of COMMAND_LONG(176) which ArduPilot may reject.
   * Payload: [custom_mode(u32)] [target_system(u8)] [base_mode(u8)]
   * Modes: MANUAL=0, STOP=1, SCAN=2, SERVO_TEST=3, AUTO=10, INITIALISING=16
   */
  buildSetMode(targetSystem: number, _targetComponent: number, mode: number): Buffer {
    const payload = Buffer.alloc(6);
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

    // custom_mode (uint32 LE) — ArduPilot mode number
    view.setUint32(0, mode, true);
    // target_system (uint8)
    payload[4] = targetSystem;
    // base_mode (uint8) — MAV_MODE_FLAG_CUSTOM_MODE_ENABLED = 1
    payload[5] = 1;

    return this.buildFrame(MAVLINK_MSG_ID_SET_MODE, payload);
  }

  /**
   * Build COMMAND_LONG for DO_SET_HOME — set tracker home position (where antenna is)
   */
  buildSetHome(targetSystem: number, targetComponent: number, lat: number, lon: number, altM: number): Buffer {
    return this.buildCommandLong(targetSystem, targetComponent, MAV_CMD_DO_SET_HOME, 0, 0, 0, 0, lat, lon, altM);
  }

  /**
   * Build GLOBAL_POSITION_INT message (msgId=33) — forward drone position to tracker
   * In AUTO mode the tracker uses this to calculate bearing/elevation
   */
  buildGlobalPositionInt(lat: number, lon: number, altMsl: number, relativeAlt: number, hdg: number): Buffer {
    const payload = Buffer.alloc(28);
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

    view.setUint32(0, Date.now() & 0xFFFFFFFF, true); // time_boot_ms
    view.setInt32(4, Math.round(lat * 1e7), true);     // lat (degE7)
    view.setInt32(8, Math.round(lon * 1e7), true);     // lon (degE7)
    view.setInt32(12, Math.round(altMsl * 1000), true); // alt MSL (mm)
    view.setInt32(16, Math.round(relativeAlt * 1000), true); // relative_alt (mm)
    view.setInt16(20, 0, true);  // vx (cm/s)
    view.setInt16(22, 0, true);  // vy
    view.setInt16(24, 0, true);  // vz
    view.setUint16(26, Math.round(hdg * 100) & 0xFFFF, true); // hdg (cdeg)

    return this.buildFrame(MAVLINK_MSG_ID_GLOBAL_POSITION_INT, payload);
  }

  /**
   * Generic COMMAND_LONG builder
   */
  private buildCommandLong(
    targetSystem: number, targetComponent: number, command: number,
    p1 = 0, p2 = 0, p3 = 0, p4 = 0, p5 = 0, p6 = 0, p7 = 0,
  ): Buffer {
    const payload = Buffer.alloc(33);
    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);

    view.setFloat32(0, p1, true);
    view.setFloat32(4, p2, true);
    view.setFloat32(8, p3, true);
    view.setFloat32(12, p4, true);
    view.setFloat32(16, p5, true);
    view.setFloat32(20, p6, true);
    view.setFloat32(24, p7, true);
    view.setUint16(28, command, true);
    payload[30] = targetSystem;
    payload[31] = targetComponent;
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
