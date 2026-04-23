#!/usr/bin/env python3
"""
AntennaTracker Emulator

Emulates an ArduPilot AntennaTracker device on a UDP port.
Sends heartbeats (type=5, sys_id=2), responds to SET_MODE, SET_HOME,
receives GLOBAL_POSITION_INT and calculates bearing.

Usage:
  source /tmp/mavtest/bin/activate
  python3 scripts/emulator_tracker.py

Then in GroundLink:
  - Mode: MAVLink or SineLink
  - Antenna: UDP, host=127.0.0.1, port=14560
  - Connect
"""

import os, sys, time, math, threading
os.environ["MAVLINK20"] = "1"

from pymavlink import mavutil

LISTEN_PORT = 14560
SYS_ID = 2
COMP_ID = 1

# Tracker state
tracker_mode = 0  # MANUAL
home_lat = 0.0
home_lon = 0.0
home_alt = 0.0
drone_lat = 0.0
drone_lon = 0.0
drone_alt = 0.0
bearing = 0.0
elevation = 0.0
servo1_pwm = 1500
servo2_pwm = 1500

MODE_NAMES = {0: "MANUAL", 1: "STOP", 2: "SCAN", 3: "SERVO_TEST", 10: "AUTO", 16: "INITIALISING"}

def calc_bearing(lat1, lon1, lat2, lon2):
    """Calculate bearing from point 1 to point 2"""
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlon = lon2 - lon1
    y = math.sin(dlon) * math.cos(lat2)
    x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(y, x)) + 360) % 360

def calc_elevation(lat1, lon1, alt1, lat2, lon2, alt2):
    """Calculate elevation angle"""
    R = 6371000
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
    dist = R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    if dist < 1:
        return 90 if alt2 > alt1 else 0
    return max(0, min(90, math.degrees(math.atan2(alt2 - alt1, dist))))

def bearing_to_pwm(bearing_deg, yaw_range=360):
    """Convert bearing to servo PWM (1000-2000, center=1500)"""
    # Normalize to -180..180
    b = bearing_deg
    if b > 180: b -= 360
    return int(1500 + (b / (yaw_range/2)) * 500)

def elevation_to_pwm(elev_deg):
    """Convert elevation to servo PWM (1000-2000)"""
    return int(1000 + (elev_deg / 90) * 1000)

print(f"=== AntennaTracker Emulator ===")
print(f"Listening on UDP port {LISTEN_PORT}")
print(f"System ID: {SYS_ID}, Component ID: {COMP_ID}")
print(f"Connect GroundLink Antenna to: UDP 127.0.0.1:{LISTEN_PORT}")
print()

# Create MAVLink connection listening on UDP
mav = mavutil.mavlink_connection(f'udpin:0.0.0.0:{LISTEN_PORT}', source_system=SYS_ID, source_component=COMP_ID)

def heartbeat_loop():
    """Send heartbeats every 1 second"""
    global servo1_pwm, servo2_pwm, bearing, elevation
    while True:
        # HEARTBEAT: type=5 (ANTENNA_TRACKER), autopilot=3 (ARDUPILOTMEGA)
        mav.mav.heartbeat_send(
            5,              # MAV_TYPE_ANTENNA_TRACKER
            3,              # MAV_AUTOPILOT_ARDUPILOTMEGA
            0x80 if tracker_mode == 10 else 0,  # base_mode (armed in AUTO)
            tracker_mode,   # custom_mode
            4,              # system_status = ACTIVE
        )

        # SERVO_OUTPUT_RAW
        mav.mav.servo_output_raw_send(
            int(time.time() * 1000000) & 0xFFFFFFFF,  # time_usec
            0,              # port
            servo1_pwm,     # servo1
            servo2_pwm,     # servo2
            0, 0, 0, 0, 0, 0  # servo3-8
        )

        mode_name = MODE_NAMES.get(tracker_mode, f"?{tracker_mode}")
        status = f"Mode: {mode_name:12s} | Servo1: {servo1_pwm} | Servo2: {servo2_pwm}"
        if home_lat != 0:
            status += f" | Home: {home_lat:.4f},{home_lon:.4f}"
        if drone_lat != 0:
            status += f" | Bearing: {bearing:.1f} Elev: {elevation:.1f}"
        print(f"\r{status}", end="", flush=True)

        time.sleep(1)

# Start heartbeat in background
hb_thread = threading.Thread(target=heartbeat_loop, daemon=True)
hb_thread.start()

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
            print(f"\n>>> SET_MODE: {MODE_NAMES.get(tracker_mode, tracker_mode)}")
            # Send ACK
            mav.mav.command_ack_send(cmd, 0)  # MAV_RESULT_ACCEPTED

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
            # No print here - too noisy
            mav.mav.command_ack_send(cmd, 0)

        else:
            print(f"\n>>> CMD {cmd}: params={msg.param1},{msg.param2},{msg.param3},{msg.param4},{msg.param5},{msg.param6},{msg.param7}")
            mav.mav.command_ack_send(cmd, 0)

    elif mtype == 'GLOBAL_POSITION_INT':
        drone_lat = msg.lat / 1e7
        drone_lon = msg.lon / 1e7
        drone_alt = msg.alt / 1000

        # In AUTO mode, calculate bearing and move servos
        if tracker_mode == 10 and home_lat != 0:
            bearing = calc_bearing(home_lat, home_lon, drone_lat, drone_lon)
            elevation = calc_elevation(home_lat, home_lon, home_alt, drone_lat, drone_lon, drone_alt)
            servo1_pwm = bearing_to_pwm(bearing)
            servo2_pwm = elevation_to_pwm(elevation)

    elif mtype == 'HEARTBEAT':
        pass  # GCS heartbeat, ignore
    else:
        pass  # Other messages
