/**
 * Antenna MAVLink Worker
 *
 * Sends MAV_CMD_DO_SET_SERVO commands to antenna rotator device
 * via serial port OR UDP (MAVLink protocol).
 *
 * Supports two transports:
 * - serial: direct USB/RS485 connection
 * - udp: via mavlink-router/mavp2p UDP endpoint
 *
 * Flow: rotator-store → IPC → this worker → MAVLink (serial/UDP) → antenna device
 */

import * as dgram from 'dgram';
import { ipcMain, BrowserWindow } from 'electron';
import {
  ANTENNA_MAVLINK_IPC_CHANNELS,
} from '../../src/services/sinelink/types';
import type {
  AntennaMavlinkConfig,
  AntennaMavlinkIPCRequest,
  AntennaMavlinkIPCResponse,
} from '../../src/services/sinelink/types';
import {
  MavlinkSerialBuilder,
  MavlinkSerialParser,
  MAVLINK_MSG_ID_HEARTBEAT,
  MAVLINK_MSG_ID_PARAM_VALUE,
  MAVLINK_MSG_ID_ATTITUDE,
  MAVLINK_MSG_ID_SERVO_OUTPUT_RAW,
  MAVLINK_MSG_ID_COMMAND_ACK,
} from '../../src/services/sinelink/mavlink-serial';

interface WorkerState {
  port: any; // SerialPort instance (serial mode)
  socket: dgram.Socket | null; // UDP socket (udp mode)
  remoteAddress: string; // UDP remote address for sending
  remotePort: number; // UDP remote port for sending
  mavBuilder: MavlinkSerialBuilder;
  mavParser: MavlinkSerialParser;
  config: AntennaMavlinkConfig | null;
  childWindows: Set<BrowserWindow>;
  started: boolean;
  connected: boolean;
  heartbeatTimer: ReturnType<typeof setInterval> | null;
  // RC override continuous send
  rcOverrideTimer: ReturnType<typeof setInterval> | null;
  rcOverrideAz: number;  // current RC azimuth PWM (1000-2000)
  rcOverrideEl: number;  // current RC elevation PWM (1000-2000)
  rcOverrideActive: boolean;
  // Servo calibration from tracker params
  servoParams: {
    servo1Min: number; servo1Max: number; servo1Trim: number;
    servo2Min: number; servo2Max: number; servo2Trim: number;
    loaded: boolean;
  };
  paramsRequested: boolean;
}

const state: WorkerState = {
  port: null,
  socket: null,
  remoteAddress: '',
  remotePort: 0,
  mavBuilder: new MavlinkSerialBuilder(255, 190),
  mavParser: new MavlinkSerialParser(),
  config: null,
  childWindows: new Set(),
  started: false,
  connected: false,
  heartbeatTimer: null,
  rcOverrideTimer: null,
  rcOverrideAz: 1500,
  rcOverrideEl: 1500,
  rcOverrideActive: false,
  servoParams: {
    servo1Min: 350, servo1Max: 2350, servo1Trim: 1350,
    servo2Min: 900, servo2Max: 2200, servo2Trim: 1420,
    loaded: false,
  },
  paramsRequested: false,
};

function sendToRenderer(response: AntennaMavlinkIPCResponse): void {
  for (const win of state.childWindows) {
    if (win.isDestroyed()) {
      state.childWindows.delete(win);
      continue;
    }
    try {
      win.webContents.send(ANTENNA_MAVLINK_IPC_CHANNELS.RESPONSE, response);
    } catch (e) {
      console.error('[AntennaMavlink] Failed to send to renderer:', e);
    }
  }
}

/**
 * Map elevation degrees to servo PWM using calibrated min/max/trim
 * 0° = trim (horizontal), negative = towards min, positive = towards max
 */
function mapElevationToPwm(deg: number, servoMin: number, servoMax: number, servoTrim: number): number {
  if (deg <= 0) {
    // 0° → trim, -75° → min (linear)
    const range = servoTrim - servoMin;
    return Math.round(servoTrim + (deg / 75) * range);
  } else {
    // 0° → trim, +90° → max (linear)
    const range = servoMax - servoTrim;
    return Math.round(servoTrim + (deg / 90) * range);
  }
}

/**
 * Write MAVLink frame to current transport (serial or UDP)
 */
function writeFrame(frame: Buffer): void {
  const transport = state.config?.transport ?? 'serial';

  if (transport === 'udp' && state.socket) {
    state.socket.send(frame, state.remotePort, state.remoteAddress);
  } else if (transport === 'serial' && state.port) {
    state.port.write(frame);
  }
}

/**
 * Send servo command for azimuth or elevation
 */
function sendServoCommand(servoChannel: number, pwmValue: number): void {
  if (!state.connected || !state.config) return;

  const frame = state.mavBuilder.buildSetServo(
    state.config.targetSystemId,
    state.config.targetComponentId,
    servoChannel,
    pwmValue,
  );

  try {
    writeFrame(frame);
    console.log(`[AntennaMavlink] Servo ch=${servoChannel} pwm=${pwmValue} (${frame.length} bytes)`);
  } catch (e) {
    console.error('[AntennaMavlink] Write failed:', e);
  }
}

/**
 * Send heartbeat to maintain MAVLink connection (required for ARM to stay)
 */
function sendHeartbeat(): void {
  if (!state.connected) return;

  const frame = state.mavBuilder.buildHeartbeat();
  try {
    writeFrame(frame);
  } catch (_) {}
}

/**
 * Send current RC override values (called every 100ms when active)
 */
function sendRcOverrideTick(): void {
  if (!state.connected || !state.config || !state.rcOverrideActive) return;

  const frame = state.mavBuilder.buildRcOverride(
    state.config.targetSystemId, state.config.targetComponentId,
    state.rcOverrideAz, state.rcOverrideEl,
  );
  try { writeFrame(frame); } catch (_) {}
}

function startRcOverride(): void {
  if (state.rcOverrideTimer) return;
  state.rcOverrideActive = true;
  state.rcOverrideTimer = setInterval(sendRcOverrideTick, 100); // 10Hz
  console.log('[AntennaMavlink] RC override started (10Hz)');
}

function stopRcOverride(): void {
  state.rcOverrideActive = false;
  if (state.rcOverrideTimer) {
    clearInterval(state.rcOverrideTimer);
    state.rcOverrideTimer = null;
  }
  // Send release on all channels
  if (state.connected && state.config) {
    const frame = state.mavBuilder.buildRcOverride(
      state.config.targetSystemId, state.config.targetComponentId,
      65535, 65535,
    );
    try { writeFrame(frame); } catch (_) {}
  }
  console.log('[AntennaMavlink] RC override stopped');
}

/**
 * Send ARM command
 */
function sendArm(): void {
  if (!state.connected || !state.config) return;
  const frame = state.mavBuilder.buildArm(
    state.config.targetSystemId, state.config.targetComponentId, true
  );
  try { writeFrame(frame); } catch (_) {}
}

/**
 * Send ARM + SET_MODE once
 */
function sendArmAndModeOnce(targetSystem: number, compId: number, mode: number): void {
  // ARM
  const armFrame = state.mavBuilder.buildArm(targetSystem, compId, true);
  try { writeFrame(armFrame); } catch (_) {}
  // SET_MODE
  const modeFrame = state.mavBuilder.buildSetMode(targetSystem, compId, mode);
  try { writeFrame(modeFrame); } catch (_) {}
}

/**
 * Reliable SET_MODE — ARM + SET_MODE via STOP transition.
 * ArduPilot AntennaTracker requires going through STOP for most transitions.
 * Sends: ARM → STOP → ARM → target_mode (repeated for UDP reliability)
 */
async function setModeReliable(targetSystem: number, mode: number): Promise<void> {
  if (!state.connected || !state.config) return;
  const compId = state.config.targetComponentId;

  console.log(`[AntennaMavlink] Set mode: ${mode}`);

  if (mode === 1) {
    // STOP — direct, always works
    for (let i = 0; i < 5; i++) {
      sendArmAndModeOnce(targetSystem, compId, 1);
      await sleep(100);
    }
    return;
  }

  // For all other modes: STOP first, then target
  // Step 1: STOP
  for (let i = 0; i < 3; i++) {
    sendArmAndModeOnce(targetSystem, compId, 1);
    await sleep(100);
  }
  await sleep(500);

  // Step 2: Target mode
  for (let i = 0; i < 5; i++) {
    sendArmAndModeOnce(targetSystem, compId, mode);
    await sleep(100);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Handle incoming MAVLink data (from serial or UDP)
 */
function handleIncomingData(data: Buffer): void {
  const frames = state.mavParser.feed(data);
  for (const frame of frames) {
    if (frame.msgId === MAVLINK_MSG_ID_HEARTBEAT && frame.payload.length >= 9) {
      const view = new DataView(frame.payload.buffer, frame.payload.byteOffset, frame.payload.byteLength);
      const customMode = view.getUint32(0, true);
      const baseMode = frame.payload[6];
      sendToRenderer({
        type: 'heartbeat-received',
        systemId: frame.systemId,
        componentId: frame.componentId,
        trackerMode: customMode,
        armed: (baseMode & 0x80) !== 0,
      });
      // Request servo params after first heartbeat
      if (!state.paramsRequested) requestServoParams();
    } else if (frame.msgId === MAVLINK_MSG_ID_ATTITUDE && frame.payload.length >= 28) {
      const view = new DataView(frame.payload.buffer, frame.payload.byteOffset, frame.payload.byteLength);
      // ATTITUDE payload: time_boot_ms(u32), roll(f32), pitch(f32), yaw(f32), ...
      const yawRad = view.getFloat32(12, true);
      const pitchRad = view.getFloat32(8, true);
      const yawDeg = (yawRad * 180 / Math.PI + 360) % 360; // 0-360
      const pitchDeg = pitchRad * 180 / Math.PI;
      sendToRenderer({
        type: 'attitude',
        yaw: yawDeg,
        pitch: pitchDeg,
      });
    } else if (frame.msgId === MAVLINK_MSG_ID_SERVO_OUTPUT_RAW && frame.payload.length >= 8) {
      const view = new DataView(frame.payload.buffer, frame.payload.byteOffset, frame.payload.byteLength);
      sendToRenderer({
        type: 'servo-output',
        servo1: view.getUint16(4, true),  // offset 4 after time_usec(u32)
        servo2: view.getUint16(6, true),
        servo3: frame.payload.length >= 10 ? view.getUint16(8, true) : 0,
        servo4: frame.payload.length >= 12 ? view.getUint16(10, true) : 0,
      });
    } else if (frame.msgId === MAVLINK_MSG_ID_COMMAND_ACK && frame.payload.length >= 3) {
      const view = new DataView(frame.payload.buffer, frame.payload.byteOffset, frame.payload.byteLength);
      const command = view.getUint16(0, true);
      const result = frame.payload[2];
      console.log(`[AntennaMavlink] ACK: cmd=${command} result=${result}`);
      sendToRenderer({ type: 'command-ack', command, result });
    } else if (frame.msgId === MAVLINK_MSG_ID_PARAM_VALUE && frame.payload.length >= 25) {
      // PARAM_VALUE: param_value(f32), param_count(u16), param_index(u16), param_id(16), param_type(u8)
      const view = new DataView(frame.payload.buffer, frame.payload.byteOffset, frame.payload.byteLength);
      const paramValue = view.getFloat32(0, true);
      const paramId = Buffer.from(frame.payload.subarray(8, 24)).toString('ascii').replace(/\0/g, '').trim();
      handleParam(paramId, paramValue);
    }
  }
}

/**
 * Handle received parameter value — update servo calibration
 */
function handleParam(paramId: string, value: number): void {
  const p = state.servoParams;
  switch (paramId) {
    case 'SERVO1_MIN': p.servo1Min = value; break;
    case 'SERVO1_MAX': p.servo1Max = value; break;
    case 'SERVO1_TRIM': p.servo1Trim = value; break;
    case 'SERVO2_MIN': p.servo2Min = value; break;
    case 'SERVO2_MAX': p.servo2Max = value; break;
    case 'SERVO2_TRIM': p.servo2Trim = value; break;
    default: return;
  }
  console.log(`[AntennaMavlink] Param ${paramId} = ${value}`);
  receivedParams.add(paramId);
  p.loaded = true;
  sendToRenderer({
    type: 'servo-params',
    servo1Min: p.servo1Min, servo1Max: p.servo1Max, servo1Trim: p.servo1Trim,
    servo2Min: p.servo2Min, servo2Max: p.servo2Max, servo2Trim: p.servo2Trim,
  });
}

/**
 * Request servo parameters from tracker — retries every 2s until all received
 */
let paramRetryTimer: ReturnType<typeof setInterval> | null = null;
const REQUIRED_PARAMS = ['SERVO1_MIN', 'SERVO1_MAX', 'SERVO1_TRIM', 'SERVO2_MIN', 'SERVO2_MAX', 'SERVO2_TRIM'];
const receivedParams = new Set<string>();

function requestServoParams(): void {
  if (paramRetryTimer) return; // already running

  const sendAllParamRequests = () => {
    if (!state.connected || !state.config) {
      stopParamRequests();
      return;
    }

    // Check if all params received
    if (receivedParams.size >= REQUIRED_PARAMS.length) {
      console.log('[AntennaMavlink] All servo params received');
      stopParamRequests();
      return;
    }

    // Request only missing params
    for (const paramId of REQUIRED_PARAMS) {
      if (!receivedParams.has(paramId)) {
        const frame = state.mavBuilder.buildParamRequest(state.config.targetSystemId, state.config.targetComponentId, paramId);
        try { writeFrame(frame); } catch (_) {}
      }
    }
    console.log(`[AntennaMavlink] Requesting params (${receivedParams.size}/${REQUIRED_PARAMS.length} received)`);
  };

  // Send immediately + retry every 2 seconds
  sendAllParamRequests();
  paramRetryTimer = setInterval(sendAllParamRequests, 2000);
}

function stopParamRequests(): void {
  if (paramRetryTimer) {
    clearInterval(paramRetryTimer);
    paramRetryTimer = null;
  }
}

// ============================================================
// SERIAL TRANSPORT
// ============================================================

async function connectSerial(config: AntennaMavlinkConfig): Promise<void> {
  try {
    const { SerialPort } = await import('serialport');

    state.port = new SerialPort({
      path: config.portPath,
      baudRate: config.baudRate,
      autoOpen: false,
    });

    state.port.on('data', (data: Buffer) => handleIncomingData(data));

    state.port.on('error', (err: Error) => {
      console.error('[AntennaMavlink] Serial error:', err);
      sendToRenderer({ type: 'error', code: 'SERIAL_ERROR', message: err.message });
    });

    state.port.on('close', () => {
      console.log('[AntennaMavlink] Serial port closed');
      stopHeartbeat();
      state.connected = false;
      sendToRenderer({ type: 'disconnected' });
    });

    state.port.open((err: Error | null) => {
      if (err) {
        console.error('[AntennaMavlink] Failed to open port:', err);
        sendToRenderer({ type: 'error', code: 'OPEN_FAILED', message: err.message });
        return;
      }

      console.log(`[AntennaMavlink] Serial connected to ${config.portPath} at ${config.baudRate}`);
      state.connected = true;
      sendToRenderer({ type: 'connected', portPath: config.portPath });
      startHeartbeat();
    });
  } catch (e) {
    const error = e as Error;
    console.error('[AntennaMavlink] Failed to create serial port:', error);
    sendToRenderer({ type: 'error', code: 'CONNECT_FAILED', message: error.message });
  }
}

// ============================================================
// UDP TRANSPORT
// ============================================================

function connectUdp(config: AntennaMavlinkConfig): void {
  try {
    state.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    state.remoteAddress = config.udpHost;
    state.remotePort = config.udpPort;

    state.socket.on('message', (msg: Buffer) => handleIncomingData(msg));

    state.socket.on('error', (err: Error) => {
      console.error('[AntennaMavlink] UDP error:', err);
      sendToRenderer({ type: 'error', code: 'UDP_ERROR', message: err.message });
      state.connected = false;
    });

    state.socket.on('close', () => {
      console.log('[AntennaMavlink] UDP socket closed');
      stopHeartbeat();
      state.connected = false;
      sendToRenderer({ type: 'disconnected' });
    });

    // Bind to any available port for receiving responses
    state.socket.bind(0, () => {
      const addr = state.socket?.address();
      console.log(`[AntennaMavlink] UDP connected → ${config.udpHost}:${config.udpPort} (local port ${addr?.port})`);
      state.connected = true;
      sendToRenderer({ type: 'connected', portPath: `${config.udpHost}:${config.udpPort}` });
      startHeartbeat();
    });
  } catch (e) {
    const error = e as Error;
    console.error('[AntennaMavlink] Failed to create UDP socket:', error);
    sendToRenderer({ type: 'error', code: 'CONNECT_FAILED', message: error.message });
  }
}

// ============================================================
// COMMON
// ============================================================

async function connect(config: AntennaMavlinkConfig): Promise<void> {
  await disconnect();

  state.config = config;
  state.mavParser.reset();

  if (config.transport === 'udp') {
    connectUdp(config);
  } else {
    await connectSerial(config);
  }
}

function startHeartbeat(): void {
  stopHeartbeat();
  sendHeartbeat();
  state.heartbeatTimer = setInterval(sendHeartbeat, 1000);
}

function stopHeartbeat(): void {
  if (state.heartbeatTimer) {
    clearInterval(state.heartbeatTimer);
    state.heartbeatTimer = null;
  }
}

async function disconnect(): Promise<void> {
  stopHeartbeat();
  stopRcOverride();
  stopParamRequests();
  receivedParams.clear();

  // Close serial
  if (state.port) {
    try { if (state.port.isOpen) state.port.close(); } catch (_) {}
    state.port = null;
  }

  // Close UDP
  if (state.socket) {
    try { state.socket.close(); } catch (_) {}
    state.socket = null;
  }

  state.connected = false;
  state.config = null;
  state.paramsRequested = false;
  state.servoParams.loaded = false;
  state.mavParser.reset();
  sendToRenderer({ type: 'disconnected' });
}

async function listPorts(): Promise<void> {
  try {
    const { SerialPort } = await import('serialport');
    const ports = await SerialPort.list();
    sendToRenderer({
      type: 'ports',
      ports: ports.map(p => ({
        path: p.path,
        manufacturer: p.manufacturer,
        serialNumber: p.serialNumber,
        vendorId: p.vendorId,
        productId: p.productId,
      })),
    });
  } catch (e) {
    const error = e as Error;
    sendToRenderer({ type: 'error', code: 'LIST_PORTS_FAILED', message: error.message });
  }
}

async function handleRequest(request: AntennaMavlinkIPCRequest): Promise<void> {
  console.log('[AntennaMavlink] Received request:', request.type);
  switch (request.type) {
    case 'connect':
      await connect(request.config);
      break;
    case 'disconnect':
      await disconnect();
      break;
    case 'send-servo':
      if (state.config) {
        const p = state.servoParams;
        // Map azimuth from internal range (540-2400) to servo range (servo1Min-servo1Max), inverted
        const azNorm = (request.azimuthPwm - 540) / (2400 - 540); // 0..1
        const azPwm = Math.round(p.servo1Max - azNorm * (p.servo1Max - p.servo1Min)); // inverted
        sendServoCommand(state.config.azimuthServoChannel, azPwm);
        // Map elevation degrees to servo PWM using calibrated params
        // 0° = trim (horizontal), negative = towards min, positive = towards max
        const elDeg = request.elevationCmd; // raw degrees
        const elevationPwm = mapElevationToPwm(elDeg, p.servo2Min, p.servo2Max, p.servo2Trim);
        sendServoCommand(state.config.elevationServoChannel, elevationPwm);
      }
      break;
    case 'send-rc-override':
      if (state.connected && state.config) {
        const pRc = state.servoParams;
        // Map azimuth, inverted (same as servo)
        const azNorm = (request.azimuthPwm - 540) / (2400 - 540); // 0..1
        state.rcOverrideAz = Math.round(pRc.servo1Max - azNorm * (pRc.servo1Max - pRc.servo1Min));
        // Map elevation degrees using calibrated params
        const rcElDeg = request.elevationPwm; // raw degrees
        state.rcOverrideEl = mapElevationToPwm(rcElDeg, pRc.servo2Min, pRc.servo2Max, pRc.servo2Trim);
        // Start continuous RC override loop if not already running
        if (!state.rcOverrideActive) startRcOverride();
      }
      break;
    case 'set-mode':
      if (state.connected && state.config) {
        // Stop RC override when switching modes (avoid conflicts)
        stopRcOverride();
        await setModeReliable(state.config.targetSystemId, request.mode);
      }
      break;
    case 'set-home':
      if (state.connected && state.config) {
        const homeFrame = state.mavBuilder.buildSetHome(state.config.targetSystemId, state.config.targetComponentId, request.lat, request.lon, request.alt);
        try {
          writeFrame(homeFrame);
          console.log(`[AntennaMavlink] Set home: ${request.lat}, ${request.lon}, ${request.alt}m`);
        } catch (e) { console.error('[AntennaMavlink] Set home failed:', e); }
      }
      break;
    case 'forward-position':
      if (state.connected) {
        const posFrame = state.mavBuilder.buildGlobalPositionInt(request.lat, request.lon, request.alt, request.relativeAlt, request.hdg);
        try {
          writeFrame(posFrame);
        } catch (e) { console.error('[AntennaMavlink] Forward position failed:', e); }
      }
      break;
    case 'list-ports':
      await listPorts();
      break;
  }
}

export function setAntennaMavlinkChildWindow(childWindow: BrowserWindow | null): void {
  if (childWindow) {
    state.childWindows.add(childWindow);
    childWindow.on('closed', () => {
      state.childWindows.delete(childWindow);
    });
  }
}

export function antennaMavlinkWorker({ ipcMain: ipc }: { ipcMain: typeof ipcMain }): void {
  if (state.started) return;
  state.started = true;
  console.log('[AntennaMavlink] Worker starting...');

  ipc.handle(ANTENNA_MAVLINK_IPC_CHANNELS.REQUEST, async (_, request: AntennaMavlinkIPCRequest) => {
    if (!request) return;
    await handleRequest(request);
  });

  console.log('[AntennaMavlink] Worker started');
}

export function stopAntennaMavlinkWorker(): void {
  stopHeartbeat();
  if (state.port) {
    try { if (state.port.isOpen) state.port.close(); } catch (_) {}
    state.port = null;
  }
  if (state.socket) {
    try { state.socket.close(); } catch (_) {}
    state.socket = null;
  }
  state.connected = false;
  state.childWindows.clear();
  state.started = false;
}
