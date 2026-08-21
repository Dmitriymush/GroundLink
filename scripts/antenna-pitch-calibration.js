/**
 * Antenna tracker pitch axis calibration tool
 *
 * Reads/writes ArduPilot AntennaTracker SERVO2/RC2 parameters over UDP MAVLink
 * (same mechanism Mission Planner uses; values persist in tracker EEPROM).
 *
 * Correct pitch calibration for this hardware: MIN=350, TRIM=1350, MAX=2350
 * (mirrors the already-calibrated yaw axis SERVO1/RC1).
 *
 * Usage:
 *   node scripts/antenna-pitch-calibration.js check    [--host <ip>] [--port <p>] [--sys <id>]
 *   node scripts/antenna-pitch-calibration.js fix      [--host <ip>] [--port <p>] [--sys <id>] [--min <pwm>] [--trim <pwm>] [--max <pwm>]
 *   node scripts/antenna-pitch-calibration.js rollback [--host <ip>] [--port <p>] [--sys <id>]
 *
 *   check    — read-only: prints current calibration + live servo outputs
 *   fix      — writes SERVO2/RC2 = 350/1350/2350 (or --min/--trim/--max) and verifies each value
 *   rollback — restores ArduPilot defaults 1000/1500/2000
 *
 * IMPORTANT: disconnect the antenna in GroundLink before running (the app's
 * 10Hz traffic competes for the UDP channel; the script retries but it's slower).
 */
const dgram = require('dgram');

// ---- CLI ----
const args = process.argv.slice(2);
const command = args[0];
function opt(name, def) {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const HOST = opt('host', '192.168.31.30');
const PORT = Number(opt('port', 24448));
const TARGET_SYS = Number(opt('sys', 2));

if (!['check', 'fix', 'rollback'].includes(command)) {
  console.log('Usage: node scripts/antenna-pitch-calibration.js <check|fix|rollback> [--host <ip>] [--port <p>] [--sys <id>]');
  process.exit(2);
}

const PITCH_PARAMS = ['SERVO2_MIN', 'SERVO2_MAX', 'SERVO2_TRIM', 'RC2_MIN', 'RC2_MAX', 'RC2_TRIM'];
const READ_PARAMS = [
  'SERVO1_MIN', 'SERVO1_MAX', 'SERVO1_TRIM', 'RC1_MIN', 'RC1_MAX', 'RC1_TRIM',
  ...PITCH_PARAMS, 'PITCH_MIN', 'PITCH_MAX', 'YAW_RANGE',
];
// Pitch calibration target: defaults match this hardware family (same as yaw axis)
const FIX_MIN = Number(opt('min', 350));
const FIX_TRIM = Number(opt('trim', 1350));
const FIX_MAX = Number(opt('max', 2350));
if (!(FIX_MIN < FIX_TRIM && FIX_TRIM < FIX_MAX)) {
  console.log(`Некоректні значення: потрібно min < trim < max (отримано ${FIX_MIN}/${FIX_TRIM}/${FIX_MAX})`);
  process.exit(2);
}
// Write order matters: MIN, MAX, then TRIM — trim stays inside range at every step
const TARGETS = {
  fix:      { SERVO2_MIN: FIX_MIN, SERVO2_MAX: FIX_MAX, SERVO2_TRIM: FIX_TRIM, RC2_MIN: FIX_MIN, RC2_MAX: FIX_MAX, RC2_TRIM: FIX_TRIM },
  rollback: { SERVO2_MIN: 1000, SERVO2_MAX: 2000, SERVO2_TRIM: 1500, RC2_MIN: 1000, RC2_MAX: 2000, RC2_TRIM: 1500 },
};
const PARAM_TYPE_INT16 = 4;

// ---- MAVLink v2 (mirrors src/services/sinelink/mavlink-serial.ts) ----
const CRC_EXTRAS = { 0: 50, 20: 214, 22: 220, 23: 168, 30: 39, 36: 222 };
let seq = 0;
function crcAcc(b, crc) {
  const t = (b ^ (crc & 0xFF)) & 0xFF;
  const t2 = (t ^ (t << 4)) & 0xFF;
  return ((crc >> 8) ^ (t2 << 8) ^ (t2 << 3) ^ (t2 >> 4)) & 0xFFFF;
}
function crcCalc(buf, extra) {
  let crc = 0xFFFF;
  for (const b of buf) crc = crcAcc(b, crc);
  return crcAcc(extra, crc);
}
function buildFrame(msgId, payload) {
  let len = payload.length;
  while (len > 0 && payload[len - 1] === 0) len--;
  if (len === 0) len = 1;
  const f = Buffer.alloc(10 + len + 2);
  f[0] = 0xFD; f[1] = len; f[4] = seq++ & 0xFF; f[5] = 255; f[6] = 190;
  f[7] = msgId & 0xFF; f[8] = (msgId >> 8) & 0xFF; f[9] = (msgId >> 16) & 0xFF;
  payload.copy(f, 10, 0, len);
  const crc = crcCalc(f.subarray(1, 10 + len), CRC_EXTRAS[msgId] ?? 0);
  f[10 + len] = crc & 0xFF; f[11 + len] = (crc >> 8) & 0xFF;
  return f;
}
function buildHeartbeat() {
  const p = Buffer.alloc(9); p[4] = 6; p[5] = 8; p[8] = 3;
  return buildFrame(0, p);
}
function buildParamRequest(id) {
  const p = Buffer.alloc(20);
  p[0] = 0xFF; p[1] = 0xFF; p[2] = TARGET_SYS; p[3] = 0;
  Buffer.from(id, 'ascii').copy(p, 4, 0, 16);
  return buildFrame(20, p);
}
function buildParamSet(id, value) {
  const p = Buffer.alloc(23);
  p.writeFloatLE(value, 0);
  p[4] = TARGET_SYS; p[5] = 0;
  Buffer.from(id, 'ascii').copy(p, 6, 0, 16);
  p[22] = PARAM_TYPE_INT16;
  return buildFrame(23, p);
}

// ---- Parser (v1 + v2 with CRC validation) ----
let rx = Buffer.alloc(0);
function feed(data) {
  rx = Buffer.concat([rx, data]);
  const out = []; let i = 0;
  while (i < rx.length) {
    const stx = rx[i];
    if (stx !== 0xFE && stx !== 0xFD) { i++; continue; }
    const isV2 = stx === 0xFD, hdr = isV2 ? 10 : 6;
    if (i + hdr > rx.length) break;
    const len = rx[i + 1], total = hdr + len + 2;
    if (i + total > rx.length) break;
    const msgId = isV2 ? rx[i + 7] | (rx[i + 8] << 8) | (rx[i + 9] << 16) : rx[i + 5];
    const extra = CRC_EXTRAS[msgId];
    if (extra !== undefined) {
      const expected = crcCalc(rx.subarray(i + 1, i + hdr + len), extra);
      const received = rx[i + hdr + len] | (rx[i + hdr + len + 1] << 8);
      if (expected === received) {
        out.push({ msgId, payload: rx.subarray(i + hdr, i + hdr + len) });
      }
    }
    i += total;
  }
  rx = rx.subarray(i);
  return out;
}

// ---- State ----
const sock = dgram.createSocket({ type: 'udp4', reuseAddr: true });
const params = {}; // id -> value
const live = { s1: null, s2: null, yaw: null, pitch: null, heartbeat: false };

sock.on('message', (msg) => {
  for (const fr of feed(msg)) {
    const pl = Buffer.from(fr.payload);
    const pad = (n) => pl.length >= n ? pl : Buffer.concat([pl, Buffer.alloc(n - pl.length)]);
    if (fr.msgId === 22) {
      const p = pad(25);
      const id = p.subarray(8, 24).toString('ascii').replace(/\0/g, '').trim();
      params[id] = p.readFloatLE(0);
    } else if (fr.msgId === 36) {
      const p = pad(8);
      live.s1 = p.readUInt16LE(4); live.s2 = p.readUInt16LE(6);
    } else if (fr.msgId === 30) {
      const p = pad(16);
      live.pitch = p.readFloatLE(8) * 180 / Math.PI;
      live.yaw = (p.readFloatLE(12) * 180 / Math.PI + 360) % 360;
    } else if (fr.msgId === 0) {
      live.heartbeat = true;
    }
  }
});

function send(buf) { sock.send(buf, PORT, HOST); }
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function readParams(ids, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const missing = ids.filter(id => !(id in params));
    if (!missing.length) return true;
    for (const id of missing) send(buildParamRequest(id));
    await sleep(800);
  }
  return ids.every(id => id in params);
}

async function writeParam(id, value, timeoutMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    delete params[id];
    send(buildParamSet(id, value));
    send(buildParamRequest(id));
    await sleep(500);
    if (params[id] === value) return true;
  }
  return false;
}

function printParams(ids) {
  for (const id of ids) {
    console.log(`  ${id.padEnd(12)} = ${params[id] ?? '?? (не отримано)'}`);
  }
}

async function main() {
  await new Promise(r => sock.bind(0, r));
  console.log(`Механізм: ${HOST}:${PORT}, system id ${TARGET_SYS}`);
  const hb = setInterval(() => send(buildHeartbeat()), 1000);
  send(buildHeartbeat());

  await sleep(2000);
  if (!live.heartbeat && live.s1 == null) {
    console.log('УВАГА: немає відповіді від механізму за 2с. Перевірте IP/порт/живлення. Продовжую спроби...');
  }

  if (command === 'check') {
    const ok = await readParams(READ_PARAMS, 20000);
    console.log('\nКалібрування yaw (азимут):');
    printParams(['SERVO1_MIN', 'SERVO1_TRIM', 'SERVO1_MAX', 'RC1_MIN', 'RC1_TRIM', 'RC1_MAX']);
    console.log('Калібрування pitch (нахил):');
    printParams(['SERVO2_MIN', 'SERVO2_TRIM', 'SERVO2_MAX', 'RC2_MIN', 'RC2_TRIM', 'RC2_MAX']);
    console.log('Межі кутів:');
    printParams(['PITCH_MIN', 'PITCH_MAX', 'YAW_RANGE']);
    console.log(`\nЖива телеметрія: servo1=${live.s1 ?? '?'} servo2=${live.s2 ?? '?'} pitch=${live.pitch?.toFixed(1) ?? '?'}°`);
    const t = TARGETS.fix;
    const pitchOk = PITCH_PARAMS.every(id => params[id] === t[id]);
    console.log(pitchOk
      ? `\nРЕЗУЛЬТАТ: pitch відкалібровано правильно (${FIX_MIN}/${FIX_TRIM}/${FIX_MAX}) ✓`
      : `\nРЕЗУЛЬТАТ: pitch НЕ відповідає ${FIX_MIN}/${FIX_TRIM}/${FIX_MAX} — запустіть команду fix`);
    finish(hb, ok && true);
  } else {
    const targets = TARGETS[command];
    console.log(`\nЗапис параметрів (${command}):`);
    let allOk = true;
    for (const id of PITCH_PARAMS) {
      const target = targets[id];
      await readParams([id], 10000);
      const before = params[id];
      if (before === target) {
        console.log(`  ${id.padEnd(12)} = ${target} (вже правильно, пропущено)`);
        continue;
      }
      const ok = await writeParam(id, target, 30000);
      console.log(`  ${id.padEnd(12)} ${before ?? '?'} -> ${target} ${ok ? '✓' : 'ПОМИЛКА ЗАПИСУ ✗'}`);
      allOk = allOk && ok;
    }

    // Final verification pass
    for (const id of PITCH_PARAMS) delete params[id];
    await readParams(PITCH_PARAMS, 15000);
    console.log('\nФінальна перевірка:');
    let verified = true;
    for (const id of PITCH_PARAMS) {
      const good = params[id] === targets[id];
      verified = verified && good;
      console.log(`  ${id.padEnd(12)} = ${params[id] ?? '?'} ${good ? '✓' : '✗'}`);
    }
    console.log(verified
      ? '\nГОТОВО: всі параметри записані та підтверджені ✓\nПерепідключіть антену в GroundLink, щоб апка перечитала калібрування.'
      : '\nНЕ ВСІ параметри підтверджені — закрийте GroundLink і запустіть скрипт ще раз (він продовжить з місця зупинки).');
    finish(hb, allOk && verified);
  }
}

function finish(hb, ok) {
  clearInterval(hb);
  sock.close();
  process.exit(ok ? 0 : 1);
}

main();
