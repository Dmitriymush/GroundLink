#!/usr/bin/env node
/**
 * MAVLink Telemetry Simulator
 *
 * Simulates a drone sending MAVLink HEARTBEAT and GLOBAL_POSITION_INT
 * messages via UDP. Used for testing the MAVLink auto-tracking feature
 * in GroundLink without a real drone.
 *
 * The simulated drone flies in a circle around a configurable center point.
 *
 * Usage:
 *   node scripts/mavlink-simulator.js [options]
 *
 *   --port 14550        UDP port to send to (default: 14550)
 *   --host 127.0.0.1    Target host (default: 127.0.0.1)
 *   --lat 50.4501       Center latitude (default: Kyiv)
 *   --lon 30.5234       Center longitude (default: Kyiv)
 *   --alt 100           Altitude in meters (default: 100)
 *   --radius 500        Circle radius in meters (default: 500)
 *   --speed 1           Speed multiplier (default: 1)
 *   --rate 5            Messages per second (default: 5)
 *
 * Example:
 *   node scripts/mavlink-simulator.js --lat 50.4501 --lon 30.5234 --alt 150
 *
 * Then in GroundLink:
 *   1. Go to Antenna Control
 *   2. Enable Rotator → switch to MAVLink mode
 *   3. Enter GCS coordinates (e.g. 50.4501, 30.5234, 0)
 *   4. Click "Listen" (port 14550)
 *   5. Enable "Auto-track"
 *   6. Watch the compass follow the simulated drone
 */

const dgram = require('dgram');

// ============================================================
// CLI ARGS
// ============================================================

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    port: 14550,
    host: '127.0.0.1',
    lat: 50.4501,    // Kyiv
    lon: 30.5234,
    alt: 100,
    radius: 500,     // meters
    speed: 1,
    rate: 5,         // Hz
  };

  for (let i = 0; i < args.length; i += 2) {
    const key = args[i].replace(/^--/, '');
    const val = parseFloat(args[i + 1]);
    if (key in opts && !isNaN(val)) opts[key] = val;
    if (key === 'host') opts.host = args[i + 1];
  }

  return opts;
}

// ============================================================
// MAVLink MESSAGE BUILDERS
// ============================================================

// X.25 CRC
function crcAccumulate(byte, crc) {
  let tmp = byte ^ (crc & 0xff);
  tmp ^= (tmp << 4) & 0xff;
  return ((crc >> 8) ^ (tmp << 8) ^ (tmp << 3) ^ (tmp >> 4)) & 0xffff;
}

function crcCalculate(buffer, crcExtra) {
  let crc = 0xffff;
  for (let i = 0; i < buffer.length; i++) {
    crc = crcAccumulate(buffer[i], crc);
  }
  crc = crcAccumulate(crcExtra, crc);
  return crc;
}

let sequence = 0;
const SYSTEM_ID = 1;
const COMPONENT_ID = 1;

/**
 * Build MAVLink v1 packet
 */
function buildMavlinkV1(msgId, payload, crcExtra) {
  const header = Buffer.alloc(6);
  header[0] = 0xfe; // STX v1
  header[1] = payload.length;
  header[2] = sequence++ & 0xff;
  header[3] = SYSTEM_ID;
  header[4] = COMPONENT_ID;
  header[5] = msgId;

  // CRC over header[1..5] + payload
  const crcData = Buffer.concat([header.subarray(1), payload]);
  const crc = crcCalculate(crcData, crcExtra);
  const crcBuf = Buffer.alloc(2);
  crcBuf.writeUInt16LE(crc);

  return Buffer.concat([header, payload, crcBuf]);
}

/**
 * HEARTBEAT (msg 0, CRC_EXTRA 50)
 */
function buildHeartbeat() {
  const payload = Buffer.alloc(9);
  payload.writeUInt32LE(0, 0);      // custom_mode
  payload.writeUInt8(2, 4);          // type: MAV_TYPE_QUADROTOR
  payload.writeUInt8(3, 5);          // autopilot: MAV_AUTOPILOT_ARDUPILOTMEGA
  payload.writeUInt8(0x81, 6);       // base_mode: ARMED | CUSTOM
  payload.writeUInt8(4, 7);          // system_status: MAV_STATE_ACTIVE
  payload.writeUInt8(3, 8);          // mavlink_version
  return buildMavlinkV1(0, payload, 50);
}

/**
 * GLOBAL_POSITION_INT (msg 33, CRC_EXTRA 104)
 */
function buildGlobalPositionInt(lat, lon, alt, relAlt, vx, vy, vz, hdg) {
  const payload = Buffer.alloc(28);
  payload.writeUInt32LE(Date.now() & 0xffffffff, 0); // time_boot_ms
  payload.writeInt32LE(Math.round(lat * 1e7), 4);     // lat (degE7)
  payload.writeInt32LE(Math.round(lon * 1e7), 8);     // lon (degE7)
  payload.writeInt32LE(Math.round(alt * 1000), 12);    // alt (mm MSL)
  payload.writeInt32LE(Math.round(relAlt * 1000), 16); // relative_alt (mm)
  payload.writeInt16LE(Math.round(vx * 100), 20);      // vx (cm/s)
  payload.writeInt16LE(Math.round(vy * 100), 22);      // vy (cm/s)
  payload.writeInt16LE(Math.round(vz * 100), 24);      // vz (cm/s)
  payload.writeUInt16LE(Math.round(hdg * 100), 26);    // hdg (cdeg)
  return buildMavlinkV1(33, payload, 104);
}

// ============================================================
// FLIGHT SIMULATION
// ============================================================

const DEG_TO_RAD = Math.PI / 180;
const EARTH_RADIUS = 6371000;

/**
 * Offset a lat/lon by meters in N/E direction
 */
function offsetPosition(lat, lon, northMeters, eastMeters) {
  const dLat = northMeters / EARTH_RADIUS;
  const dLon = eastMeters / (EARTH_RADIUS * Math.cos(lat * DEG_TO_RAD));
  return {
    lat: lat + dLat / DEG_TO_RAD,
    lon: lon + dLon / DEG_TO_RAD,
  };
}

// ============================================================
// MAIN
// ============================================================

const opts = parseArgs();
const socket = dgram.createSocket('udp4');

let angle = 0; // current position on circle (radians)
const angularSpeed = (2 * Math.PI) / 60 * opts.speed; // one full circle per 60s

console.log('=== MAVLink Telemetry Simulator ===');
console.log(`Target:  ${opts.host}:${opts.port}`);
console.log(`Center:  ${opts.lat}°, ${opts.lon}°`);
console.log(`Alt:     ${opts.alt}m`);
console.log(`Radius:  ${opts.radius}m`);
console.log(`Rate:    ${opts.rate} Hz`);
console.log(`Speed:   ${opts.speed}x (${(60 / opts.speed).toFixed(0)}s per circle)`);
console.log('---');
console.log('Sending MAVLink packets... (Ctrl+C to stop)');
console.log('');

let msgCount = 0;

const interval = setInterval(() => {
  const dt = 1 / opts.rate;
  angle += angularSpeed * dt;

  // Calculate drone position on circle
  const northOffset = opts.radius * Math.cos(angle);
  const eastOffset = opts.radius * Math.sin(angle);
  const pos = offsetPosition(opts.lat, opts.lon, northOffset, eastOffset);

  // Slight altitude variation
  const altVariation = Math.sin(angle * 2) * 10;
  const currentAlt = opts.alt + altVariation;

  // Velocity (tangent to circle)
  const speed = angularSpeed * opts.radius; // m/s
  const vx = -speed * Math.sin(angle); // north component
  const vy = speed * Math.cos(angle);   // east component

  // Heading (direction of travel)
  const hdg = ((Math.atan2(vy, vx) / DEG_TO_RAD) + 360) % 360;

  // Send heartbeat every ~1 second
  if (msgCount % opts.rate === 0) {
    const hb = buildHeartbeat();
    socket.send(hb, opts.port, opts.host);
  }

  // Send position
  const gpi = buildGlobalPositionInt(pos.lat, pos.lon, currentAlt, currentAlt, vx, vy, 0, hdg);
  socket.send(gpi, opts.port, opts.host);

  msgCount++;

  // Log every second
  if (msgCount % opts.rate === 0) {
    const bearing = ((Math.atan2(eastOffset, northOffset) / DEG_TO_RAD) + 360) % 360;
    process.stdout.write(
      `\r  Drone: ${pos.lat.toFixed(5)}°, ${pos.lon.toFixed(5)}° | ` +
      `Alt: ${currentAlt.toFixed(0)}m | ` +
      `Bearing: ${bearing.toFixed(0)}° | ` +
      `Hdg: ${hdg.toFixed(0)}° | ` +
      `Msgs: ${msgCount}   `
    );
  }
}, 1000 / opts.rate);

// Cleanup
process.on('SIGINT', () => {
  clearInterval(interval);
  socket.close();
  console.log('\n\nSimulator stopped.');
  process.exit(0);
});
