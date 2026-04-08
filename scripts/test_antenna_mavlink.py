#!/usr/bin/env python3
"""
Antenna MAVLink diagnostic script.
Tests communication with Arduino antenna controller.

Usage:
  python3 scripts/test_antenna_mavlink.py /dev/tty.usbserial-BG01MW51 57600
"""

import sys
import time
import os
os.environ["MAVLINK20"] = "1"

from pymavlink import mavutil

port = sys.argv[1] if len(sys.argv) > 1 else '/dev/tty.usbserial-BG01MW51'
baud = int(sys.argv[2]) if len(sys.argv) > 2 else 57600

print(f"Connecting to {port} at {baud}...")
mav = mavutil.mavlink_connection(port, baud=baud)

# Step 1: Wait for heartbeat
print("\n--- Step 1: Waiting for heartbeat (10s) ---")
hb = mav.wait_heartbeat(timeout=10)
if hb:
    print(f"  GOT HEARTBEAT!")
    print(f"  System ID: {mav.target_system}")
    print(f"  Component ID: {mav.target_component}")
    print(f"  Type: {hb.type}")
    print(f"  Autopilot: {hb.autopilot}")
    print(f"  Base mode: {hb.base_mode}")
    print(f"  System status: {hb.system_status}")
else:
    print("  No heartbeat received. Device may not send heartbeats.")
    print("  Trying with default target sys=1, comp=1")
    mav.target_system = 1
    mav.target_component = 1

# Step 2: Listen for any messages
print("\n--- Step 2: Listening for any messages (5s) ---")
start = time.time()
msg_types = set()
while time.time() - start < 5:
    msg = mav.recv_match(blocking=True, timeout=1)
    if msg:
        mtype = msg.get_type()
        if mtype not in msg_types:
            msg_types.add(mtype)
            print(f"  Received: {mtype} (sys={msg.get_srcSystem()}, comp={msg.get_srcComponent()})")
            if mtype == 'SERVO_OUTPUT_RAW':
                print(f"    servo1={msg.servo1_raw} servo2={msg.servo2_raw} servo3={msg.servo3_raw} servo4={msg.servo4_raw}")

if not msg_types:
    print("  No messages received at all.")
else:
    print(f"  Message types seen: {msg_types}")

# Step 3: Try sending DO_SET_SERVO
print(f"\n--- Step 3: Sending DO_SET_SERVO (target sys={mav.target_system}, comp={mav.target_component}) ---")

test_pwms = [1000, 1500, 2000, 1500]

for pwm in test_pwms:
    print(f"\n  Sending servo 1 = {pwm}...")
    mav.mav.command_long_send(
        mav.target_system,
        mav.target_component,
        mavutil.mavlink.MAV_CMD_DO_SET_SERVO,
        0,       # confirmation
        1,       # param1: servo number
        pwm,     # param2: PWM value
        0, 0, 0, 0, 0
    )

    # Check for ACK
    ack = mav.recv_match(type='COMMAND_ACK', blocking=True, timeout=2)
    if ack:
        result_names = {0: 'ACCEPTED', 1: 'TEMPORARILY_REJECTED', 2: 'DENIED',
                       3: 'UNSUPPORTED', 4: 'FAILED', 5: 'IN_PROGRESS'}
        print(f"  ACK: command={ack.command} result={result_names.get(ack.result, ack.result)}")
    else:
        print(f"  No ACK received")

    time.sleep(1)

# Step 4: Try raw text protocol (in case Arduino expects UDP-style text)
print(f"\n--- Step 4: Trying raw text protocol ---")
test_frames = [
    "T:101;R:102;X:1470;Y:30;CH:10110214701030;\r\n",
    "T:101;R:102;X:1200;Y:30;CH:10110212001030;\r\n",
    "T:101;R:102;X:1800;Y:30;CH:10110218001030;\r\n",
    "T:101;R:102;X:1470;Y:30;CH:10110214701030;\r\n",
]

# Get raw serial port
try:
    serial_port = mav.port
    for frame in test_frames:
        print(f"  Sending: {frame.strip()}")
        serial_port.write(frame.encode())
        time.sleep(1)
        # Read any response
        try:
            data = serial_port.read(256)
            if data:
                print(f"  Response: {data}")
        except:
            pass
except Exception as e:
    print(f"  Could not access raw serial: {e}")

print("\n--- Done ---")
print("\nSummary:")
print(f"  Heartbeat: {'YES' if hb else 'NO'}")
print(f"  Target: sys={mav.target_system}, comp={mav.target_component}")
print(f"  Messages seen: {msg_types or 'none'}")
print(f"\nIf antenna didn't move with DO_SET_SERVO but moved with raw text,")
print(f"then the device expects the text protocol T:;R:;X:;Y:;CH:; over serial.")
