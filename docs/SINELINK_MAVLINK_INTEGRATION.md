# Sine.link + MAVLink Antenna Auto-Tracking Integration

## Overview

Two serial connections through USB:
1. **Sine.link input** (COM port #1) - Get drone coordinates via MAVLink FTP + Wire SDK
2. **Antenna output** (COM port #2) - Send rotator commands via MAVLink DO_SET_SERVO

User selects which COM port is which in the UI.

## Architecture

```
Sine.link Master modem (USB → 2x Virtual COM)
    │
    │ COM port #1 (Serial, MAVLink FTP, baud 115200)
    ▼
sinelink_worker.ts (Electron main process)
    │ 1. Open serial port (serialport npm)
    │ 2. Build MAV FTP request: viGetPose (type=0x4C)
    │    - Wire SDK (WASM): proto → binary → raw_to_mavlink → FTP payload
    │ 3. Send FILE_TRANSFER_PROTOCOL MAVLink message
    │ 4. Receive response, parse: mavlink_to_raw → link_to_proto → viPose
    │ 5. IPC → renderer: { lat, lon, alt, valid, confidence }
    ▼
sinelink-store.ts (Pinia, renderer)
    │ calculateTrackingAngles(gcs, drone) → { azimuth, elevation, distance }
    ▼
┌─────────── controlMode? ──────────┐
│                                    │
│  'udp'              'mavlink'      │
│  (manual)           (auto-track)   │
│    │                    │          │
│    ▼                    ▼          │
│  UDP frame         MAVLink frame   │
│  T:101;R:102;      DO_SET_SERVO    │
│  X:1425;Y:30;      servo1=PWM(az) │
│  CH:...;\r\n       servo2=PWM(el) │
│    │                    │          │
└────┼────────────────────┼──────────┘
     ▼                    ▼
  WIFI232-B2         Antenna device
  (UDP:24448)        COM port #2
                     (Serial, MAVLink, baud 115200)
```

## Data Format

### Antenna output (MAVLink mode)
Same PWM values as UDP mode (540-2400 for azimuth), sent as MAV_CMD_DO_SET_SERVO:
- Servo 1 (configurable): azimuth PWM (same range as X field in UDP frame)
- Servo 2 (configurable): elevation command (same range as Y field in UDP frame)

### Wire SDK: viGetPose request/response flow
```
1. Build protobuf: Object { header: { type: viGetPose (0x4C) } }
2. Serialize: Object.encode(req).finish() → protoBytes
3. Wire SDK: wire__proto_to_link(protoBytes) → rawBinary
4. MAVLink wrap: wire__raw_to_mavlink(rawBinary, sysId=83, compId=76, uuid=0) → ftpPayload
5. Build MAVLink v1 FILE_TRANSFER_PROTOCOL message (msgId=110)
6. Send on serial port
7. Receive MAVLink response, extract FTP payload
8. Wire SDK: wire__mavlink_to_raw(payload) → rawBinary
9. Wire SDK: wire__link_to_proto(rawBinary) → protoBytes
10. Deserialize: Object.decode(protoBytes) → resp.pose { lat, lon, alt, valid, confidence }
```

## New Files
- `src/services/sinelink/wire-bridge.ts` - WASM wrapper
- `src/services/sinelink/types.ts` - IPC types
- `src/services/sinelink/mavlink-builder.ts` - Build/parse MAVLink v1 frames for serial
- `electron/main/sinelink_worker.ts` - Serial polling for Sine.link
- `electron/main/antenna_mavlink_worker.ts` - Serial MAVLink servo output for antenna
- `src/store/sinelink-store.ts` - Pinia store

## Modified Files
- `electron/main/index.ts` - Register new workers
- `src/store/rotator-store.ts` - Add 'mavlink' controlMode
- `src/components/molecules/AzimuthController.vue` - COM port selection, MAVLink mode UI
- `package.json` - Add serialport, @bufbuild/protobuf
