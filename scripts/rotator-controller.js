#!/usr/bin/env node
/**
 * Rotator E2E Controller — MCU emulator via UART
 *
 * Reads command frames from UART (sent by GroundLink via UDP -> WIFI232-B2)
 * and responds with telemetry back through UART (-> WIFI232-B2 -> UDP -> GroundLink).
 *
 * Protocol matches Pascal app (github.com/SkopasGit/rotation):
 *
 *   Command (GroundLink -> us):
 *     T:101;R:102;X:<PWM>;Y:<CMD>;CH:<T><R><X><Y>;\r\n
 *
 *   Telemetry (us -> GroundLink):
 *     T:102;R:101;COM:<degrees>;V:<voltage>;CH:<T><R><COM><V>;\r\n
 *
 * Usage:
 *   node scripts/rotator-controller.js [/dev/cu.usbserial-A5069RR4]
 */

const { spawn } = require('child_process');

const SERIAL_PATH = process.argv[2] || '/dev/cu.usbserial-A5069RR4';
const BAUD = 115200;
const TELEMETRY_INTERVAL = 500; // Match Pascal AutoSendIntervalMs

// Rotator state
const state = {
  currentCompass: 0,      // 0-359 degrees
  targetPWM: 1470,        // center
  targetCMD: 0,
  voltage: 12.4,
  txId: 102,              // rotator responds with swapped IDs
  rxId: 101,
  hasClient: false,
};

function mapValue(v, inMin, inMax, outMin, outMax) {
  const c = Math.max(inMin, Math.min(inMax, v));
  return Math.round(outMin + (c - inMin) * (outMax - outMin) / (inMax - inMin));
}

function parseCommand(line) {
  const p = {};
  line.split(';').forEach(s => {
    const i = s.indexOf(':');
    if (i > 0) p[s.substring(0, i).trim().toUpperCase()] = s.substring(i + 1).trim();
  });
  if (!p.T || !p.R || !p.X || !p.Y) return null;

  const chOk = p.CH === `${p.T}${p.R}${p.X}${p.Y}`;
  const pwm = parseInt(p.X, 10);
  const cmd = parseInt(p.Y, 10);

  return {
    t: parseInt(p.T, 10), r: parseInt(p.R, 10),
    pwm, cmd,
    deg: mapValue(pwm, 540, 2400, -164, 164),
    elev: cmd - 10,
    chOk
  };
}

/**
 * Telemetry — exact Pascal format:
 *   T:102;R:101;COM:45;V:12.4;CH:1021014512.4;
 * Checksum = raw string concat of T + R + COM + V
 */
function buildTelemetry() {
  const t = String(state.txId);
  const r = String(state.rxId);
  const com = String(Math.round(state.currentCompass));
  const v = state.voltage.toFixed(1);
  return `T:${t};R:${r};COM:${com};V:${v};CH:${t}${r}${com}${v};`;
}

function tick() {
  let target = mapValue(state.targetPWM, 540, 2400, -164, 164);
  if (target < 0) target += 360;

  let diff = target - state.currentCompass;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  if (Math.abs(diff) > 0.5) {
    state.currentCompass += Math.sign(diff) * Math.min(Math.abs(diff), 3);
    if (state.currentCompass < 0) state.currentCompass += 360;
    if (state.currentCompass >= 360) state.currentCompass -= 360;
  }
  state.voltage = 12.4 + (Math.random() - 0.5) * 0.2;
}

// --- Serial bridge via python (pyserial) ---
const py = spawn('/usr/bin/python3', ['-u', '-c', `
import serial, sys, threading

s = serial.Serial('${SERIAL_PATH}', ${BAUD}, timeout=0.1)
s.reset_input_buffer()

def reader():
    buf = b''
    while True:
        chunk = s.read(512)
        if chunk:
            buf += chunk
            while b'\\n' in buf:
                line, buf = buf.split(b'\\n', 1)
                line = line.strip()
                if line:
                    sys.stdout.write(line.decode('utf-8', errors='replace') + '\\n')
                    sys.stdout.flush()

threading.Thread(target=reader, daemon=True).start()

for line in sys.stdin:
    s.write(line.strip().encode() + b'\\r\\n')
    s.flush()
`]);

py.stderr.on('data', d => console.error(`[py] ${d.toString().trim()}`));
py.on('close', code => { console.log(`Serial closed (${code})`); process.exit(1); });

let rxBuf = '';
py.stdout.on('data', data => {
  rxBuf += data.toString();
  const lines = rxBuf.split('\n');
  rxBuf = lines.pop();

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const cmd = parseCommand(line);
    if (cmd) {
      state.hasClient = true;
      state.targetPWM = cmd.pwm;
      state.targetCMD = cmd.cmd;
      state.txId = cmd.r;
      state.rxId = cmd.t;
      console.log(`<< ${line}  [Az:${cmd.deg} El:${cmd.elev} CH:${cmd.chOk ? 'OK' : 'FAIL'}]`);
    }
  }
});

setInterval(() => {
  if (!state.hasClient) return;
  tick();
  const tel = buildTelemetry();
  py.stdin.write(tel + '\n');
  console.log(`>> ${tel}`);
}, TELEMETRY_INTERVAL);

console.log(`\nRotator Controller`);
console.log(`  ${SERIAL_PATH} @ ${BAUD}`);
console.log(`  GroundLink -> UDP:24448 -> WIFI232-B2 -> UART -> [here]`);
console.log(`  [here] -> UART -> WIFI232-B2 -> UDP -> GroundLink:24449\n`);

process.on('SIGINT', () => { py.kill(); process.exit(0); });
