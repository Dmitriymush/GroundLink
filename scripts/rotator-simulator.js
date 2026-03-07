#!/usr/bin/env node
/**
 * Rotator Simulator
 *
 * Simulates the rotator MCU for testing GroundLink rotator integration.
 * Protocol matches the Pascal implementation (github.com/SkopasGit/rotation)
 *
 * TX (GroundLink → Rotator):
 *   T:<T>;R:<R>;X:<PWM>;Y:<CMD>;CH:<T><R><X><Y>;\r\n
 *   X: azimuth PWM 540-2400 (mapped from -164..+164 degrees)
 *   Y: elevation cmd 0-95 (mapped from -10..+85 degrees)
 *
 * RX (Rotator → GroundLink):
 *   T:<T>;R:<R>;COM:<degrees>;V:<voltage>;CH:<T><R><COM><V>;\r\n
 *   COM: current compass position (integer degrees)
 *   V: battery voltage (float, e.g. "12.4")
 *
 * Usage:
 *   node scripts/rotator-simulator.js [--port 24448] [--real]
 *
 *   --real    Connect to physical device via UDP (192.168.3.72:24448)
 *            Listens on UART data from module and responds with telemetry
 *
 * Then in GroundLink:
 *   1. Go to Settings → Rotator Settings
 *   2. Set Host: 127.0.0.1, Port: 24448 (or 192.168.3.72 for --real)
 *   3. Enable and Connect
 *   4. Go to Antenna Control and move azimuth/elevation
 */

const dgram = require('dgram');

const args = process.argv.slice(2);
const SERVER_PORT = parseInt(args.find((_, i, a) => a[i - 1] === '--port') || '24448', 10);
const TELEMETRY_INTERVAL = 500; // Match Pascal: 500ms

// Simulated rotator state
const state = {
  currentAzimuth: 0,     // Current compass position (degrees, 0-359)
  targetAzimuthPWM: 1470, // Target PWM from last command (center)
  currentElevation: 0,
  targetElevationCmd: 0,
  voltage: 12.4,          // Simulated battery voltage
  transmitterId: 102,     // Rotator responds with swapped IDs
  receiverId: 101,
};

const server = dgram.createSocket('udp4');

let clientAddress = null;
let clientPort = null;

/**
 * Map value from one range to another (matches Pascal MapXdegToPwm)
 */
function mapValue(value, inMin, inMax, outMin, outMax) {
  const clamped = Math.max(inMin, Math.min(inMax, value));
  const k = (outMax - outMin) / (inMax - inMin);
  return Math.round(outMin + (clamped - inMin) * k);
}

/**
 * Parse incoming command frame
 * Format: T:101;R:102;X:1470;Y:45;CH:10110214700045;\r\n
 */
function parseCommand(data) {
  const str = data.toString().trim();
  console.log(`<< RX: ${str}`);

  const parts = {};
  str.split(';').forEach(part => {
    const colonPos = part.indexOf(':');
    if (colonPos > 0) {
      const key = part.substring(0, colonPos).trim();
      const value = part.substring(colonPos + 1).trim();
      parts[key] = value;
    }
  });

  if (parts.T && parts.R && parts.X && parts.Y) {
    const pwm = parseInt(parts.X, 10);
    const cmd = parseInt(parts.Y, 10);

    // Verify checksum (Pascal style: raw string concat)
    const expectedCH = `${parts.T}${parts.R}${parts.X}${parts.Y}`;
    const chOk = parts.CH === expectedCH;

    // Convert PWM back to degrees for display
    const azDeg = mapValue(pwm, 540, 2400, -164, 164);
    const elDeg = cmd - 10;

    console.log(`   Azimuth: ${azDeg} deg (PWM=${pwm}), Elevation: ${elDeg} deg (CMD=${cmd}), CH: ${chOk ? 'OK' : 'FAIL'}`);

    // Update targets
    state.targetAzimuthPWM = pwm;
    state.targetElevationCmd = cmd;

    return true;
  }

  console.log('   Invalid command format');
  return false;
}

/**
 * Build telemetry frame matching Pascal protocol
 *
 * Pascal uTelemetry.pas expects:
 *   T:<val>;R:<val>;COM:<degrees>;V:<voltage>;CH:<checksum>;
 * Where checksum = sT + sR + sCOM + sV (raw string concatenation)
 */
function buildTelemetry() {
  const t = String(state.transmitterId);
  const r = String(state.receiverId);
  const com = String(Math.round(state.currentAzimuth));
  const v = state.voltage.toFixed(1);

  // Pascal checksum: raw string concat of T + R + COM + V
  const ch = `${t}${r}${com}${v}`;

  // Semicolon-delimited, CRLF terminated (matches FrameDelimiters = [#10, #13, ';'])
  return `T:${t};R:${r};COM:${com};V:${v};CH:${ch};\r\n`;
}

/**
 * Simulate rotator movement (gradual approach to target)
 */
function simulateMovement() {
  // Convert target PWM to compass degrees for simulation
  // PWM 540(-164deg) → compass ~196deg, PWM 2400(+164deg) → compass ~164deg
  const targetProtocolDeg = mapValue(state.targetAzimuthPWM, 540, 2400, -164, 164);
  // Protocol degrees to compass: negative → add 360
  let targetCompass = targetProtocolDeg;
  if (targetCompass < 0) targetCompass += 360;

  // Move azimuth towards target
  let diff = targetCompass - state.currentAzimuth;
  // Handle wrap-around (take shortest path, avoiding dead zone)
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;

  if (Math.abs(diff) > 0.5) {
    state.currentAzimuth += Math.sign(diff) * Math.min(Math.abs(diff), 3);
    // Normalize to 0-359
    if (state.currentAzimuth < 0) state.currentAzimuth += 360;
    if (state.currentAzimuth >= 360) state.currentAzimuth -= 360;
  }

  // Simulate voltage fluctuation
  state.voltage = 12.4 + (Math.random() - 0.5) * 0.2;
}

// Handle incoming messages
server.on('message', (msg, rinfo) => {
  clientAddress = rinfo.address;
  clientPort = rinfo.port;
  parseCommand(msg);
});

server.on('error', (err) => {
  console.error(`Server error: ${err.message}`);
  server.close();
});

server.on('listening', () => {
  const address = server.address();
  console.log(`\nRotator Simulator`);
  console.log(`  UDP: ${address.address}:${address.port}`);
  console.log(`  Telemetry interval: ${TELEMETRY_INTERVAL}ms`);
  console.log(`\n  GroundLink settings:`);
  console.log(`    Host: 127.0.0.1`);
  console.log(`    Port: ${SERVER_PORT}`);
  console.log(`    Local Port: ${SERVER_PORT + 1}`);
  console.log(`\n  Waiting for commands...\n`);
});

server.bind(SERVER_PORT);

// Send telemetry periodically (matches Pascal AutoSendIntervalMs = 500)
setInterval(() => {
  if (clientAddress && clientPort) {
    simulateMovement();

    const telemetry = buildTelemetry();
    const buffer = Buffer.from(telemetry);

    server.send(buffer, clientPort, clientAddress, (err) => {
      if (!err) {
        console.log(`>> TX: ${telemetry.trim()}`);
      }
    });
  }
}, TELEMETRY_INTERVAL);

process.on('SIGINT', () => {
  console.log('\nShutting down simulator...');
  server.close();
  process.exit(0);
});
