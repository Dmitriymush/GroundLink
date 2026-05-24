#!/usr/bin/env python3
"""
Full AntennaTracker Emulator

Emulates ArduPilot AntennaTracker on UDP port 24448.
- Sends heartbeats (type=5, sys_id=2)
- Responds to SET_MODE, SET_HOME, DO_SET_SERVO
- Responds to PARAM_REQUEST_READ with servo params
- Receives GLOBAL_POSITION_INT for AUTO tracking
- Sends ATTITUDE with current yaw/pitch
- Sends SERVO_OUTPUT_RAW

Usage:
  source /tmp/mavtest/bin/activate
  python3 scripts/emulator_full.py

Then start GroundLink (npm run dev) — it will auto-connect to 127.0.0.1:24448
"""

import os, sys, time, math, threading, struct
os.environ["MAVLINK20"] = "1"

from pymavlink import mavutil

LISTEN_PORT = 24448
SYS_ID = 2
COMP_ID = 1

# Tracker state
tracker_mode = 3  # SERVO_TEST initially
armed = True
home_lat = 0.0
home_lon = 0.0
home_alt = 0.0
drone_lat = 0.0
drone_lon = 0.0
drone_alt = 0.0
servo1_pwm = 1350  # yaw center
servo2_pwm = 1150  # pitch center
current_yaw = 0.0   # degrees
current_pitch = 0.0  # degrees

MODE_NAMES = {0: "MANUAL", 1: "STOP", 2: "SCAN", 3: "SERVO_TEST", 10: "AUTO", 16: "INITIALISING"}

# Servo parameters (configurable)
SERVO_PARAMS = {
    'SERVO1_MIN': 350.0,
    'SERVO1_MAX': 2350.0,
    'SERVO1_TRIM': 1350.0,
    'SERVO2_MIN': 900.0,
    'SERVO2_MAX': 2200.0,
    'SERVO2_TRIM': 1420.0,
}

def pwm_to_yaw(pwm):
    """Convert servo1 PWM to yaw degrees"""
    p = SERVO_PARAMS
    norm = (pwm - p['SERVO1_MIN']) / (p['SERVO1_MAX'] - p['SERVO1_MIN'])
    return norm * 360.0

def pwm_to_pitch(pwm):
    """Convert servo2 PWM to pitch degrees"""
    p = SERVO_PARAMS
    trim = p['SERVO2_TRIM']
    if pwm <= trim:
        norm = (pwm - p['SERVO2_MIN']) / (trim - p['SERVO2_MIN'])
        return -75.0 + norm * 75.0  # -75 to 0
    else:
        norm = (pwm - trim) / (p['SERVO2_MAX'] - trim)
        return norm * 90.0  # 0 to 90

print(f"=== AntennaTracker Full Emulator ===")
print(f"Listening on UDP port {LISTEN_PORT}")
print(f"System ID: {SYS_ID}")
print(f"Servo params: {SERVO_PARAMS}")
print()

mav = mavutil.mavlink_connection(f'udpin:0.0.0.0:{LISTEN_PORT}', source_system=SYS_ID, source_component=COMP_ID)

def telemetry_loop():
    """Send heartbeat, attitude, servo output every 1 second"""
    global current_yaw, current_pitch
    while True:
        base_mode = 0x80 | 0x01 if armed else 0x01  # armed + custom_mode_enabled

        # HEARTBEAT
        mav.mav.heartbeat_send(
            5,              # MAV_TYPE_ANTENNA_TRACKER
            3,              # MAV_AUTOPILOT_ARDUPILOTMEGA
            base_mode,
            tracker_mode,
            4,              # MAV_STATE_ACTIVE
        )

        # ATTITUDE
        current_yaw = pwm_to_yaw(servo1_pwm)
        current_pitch = pwm_to_pitch(servo2_pwm)
        mav.mav.attitude_send(
            int(time.time() * 1000) & 0xFFFFFFFF,
            0,                                    # roll
            math.radians(current_pitch),          # pitch
            math.radians(current_yaw),            # yaw
            0, 0, 0                               # rollspeed, pitchspeed, yawspeed
        )

        # SERVO_OUTPUT_RAW
        mav.mav.servo_output_raw_send(
            int(time.time() * 1000000) & 0xFFFFFFFF,
            0,
            servo1_pwm, servo2_pwm, 0, 0, 0, 0, 0, 0
        )

        mode_name = MODE_NAMES.get(tracker_mode, f"?{tracker_mode}")
        status = f"\rMode: {mode_name:12s} | S1: {servo1_pwm:5d} | S2: {servo2_pwm:5d} | Yaw: {current_yaw:6.1f}° | Pitch: {current_pitch:6.1f}°"
        if home_lat != 0:
            status += f" | Home: {home_lat:.4f},{home_lon:.4f}"
        print(status, end="", flush=True)

        time.sleep(1)

# Start telemetry in background
t = threading.Thread(target=telemetry_loop, daemon=True)
t.start()

print("Waiting for messages...")

while True:
    msg = mav.recv_match(blocking=True, timeout=0.1)
    if not msg:
        continue

    mtype = msg.get_type()

    if mtype == 'COMMAND_LONG':
        cmd = msg.command

        # DO_SET_MODE (176)
        if cmd == 176:
            tracker_mode = int(msg.param1)
            print(f"\n>>> SET_MODE (cmd176): {MODE_NAMES.get(tracker_mode, tracker_mode)}")
            mav.mav.command_ack_send(cmd, 0)

        # DO_SET_HOME (179)
        elif cmd == 179:
            home_lat = msg.param5
            home_lon = msg.param6
            home_alt = msg.param7
            print(f"\n>>> SET_HOME: {home_lat:.6f}, {home_lon:.6f}, {home_alt:.0f}m")
            mav.mav.command_ack_send(cmd, 0)

        # DO_SET_SERVO (183)
        elif cmd == 183:
            servo_num = int(msg.param1)
            pwm = int(msg.param2)
            if servo_num == 1:
                servo1_pwm = pwm
            elif servo_num == 2:
                servo2_pwm = pwm
            mav.mav.command_ack_send(cmd, 0)

        # ARM (400)
        elif cmd == 400:
            armed = bool(msg.param1)
            print(f"\n>>> ARM: {armed}")
            mav.mav.command_ack_send(cmd, 0)

        else:
            mav.mav.command_ack_send(cmd, 0)

    elif mtype == 'SET_MODE':
        tracker_mode = msg.custom_mode
        print(f"\n>>> SET_MODE: {MODE_NAMES.get(tracker_mode, tracker_mode)}")

    elif mtype == 'PARAM_REQUEST_READ':
        param_id = msg.param_id.replace('\x00', '').strip()
        if param_id in SERVO_PARAMS:
            value = SERVO_PARAMS[param_id]
            print(f"\n>>> PARAM_REQUEST: {param_id} → {value}")
            mav.mav.param_value_send(
                param_id.encode().ljust(16, b'\x00'),
                value,
                0,  # MAV_PARAM_TYPE_REAL32
                len(SERVO_PARAMS),
                list(SERVO_PARAMS.keys()).index(param_id),
            )
        else:
            print(f"\n>>> PARAM_REQUEST: {param_id} (unknown)")

    elif mtype == 'GLOBAL_POSITION_INT':
        drone_lat = msg.lat / 1e7
        drone_lon = msg.lon / 1e7
        drone_alt = msg.alt / 1000

    elif mtype == 'RC_CHANNELS_OVERRIDE':
        if msg.chan1_raw > 0 and msg.chan1_raw < 65535:
            servo1_pwm = msg.chan1_raw
        if msg.chan2_raw > 0 and msg.chan2_raw < 65535:
            servo2_pwm = msg.chan2_raw

    elif mtype == 'HEARTBEAT':
        pass  # GCS heartbeat
