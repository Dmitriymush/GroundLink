#!/usr/bin/env python3
"""
Drone Position Emulator

Sends fake GLOBAL_POSITION_INT to GroundLink's MAVLink listener (port 14550).
Simulates a drone flying in a circle around a center point.

Usage:
  source /tmp/mavtest/bin/activate
  python3 scripts/emulator_drone.py [--lat 50.4501] [--lon 30.5234] [--radius 500] [--alt 100]

Then in GroundLink:
  - Mode: MAVLink
  - Port: 14550
  - Listen
  - Set GCS position (center of circle)
  - Enable Auto-track
"""

import os, sys, time, math, argparse
os.environ["MAVLINK20"] = "1"

from pymavlink import mavutil

parser = argparse.ArgumentParser(description="Drone position emulator")
parser.add_argument("--lat", type=float, default=50.4501, help="Center latitude (default: Kyiv)")
parser.add_argument("--lon", type=float, default=30.5234, help="Center longitude")
parser.add_argument("--radius", type=float, default=500, help="Circle radius in meters (default: 500)")
parser.add_argument("--alt", type=float, default=100, help="Altitude in meters (default: 100)")
parser.add_argument("--speed", type=float, default=30, help="Speed in degrees/sec around circle (default: 30)")
parser.add_argument("--port", type=int, default=14550, help="UDP port to send to (default: 14550)")
parser.add_argument("--host", type=str, default="127.0.0.1", help="Host to send to (default: 127.0.0.1)")
args = parser.parse_args()

DRONE_SYS_ID = 1
DRONE_COMP_ID = 1

print(f"=== Drone Position Emulator ===")
print(f"Sending GLOBAL_POSITION_INT to {args.host}:{args.port}")
print(f"Center: {args.lat}, {args.lon}")
print(f"Radius: {args.radius}m, Alt: {args.alt}m, Speed: {args.speed} deg/s")
print()

mav = mavutil.mavlink_connection(f'udpout:{args.host}:{args.port}', source_system=DRONE_SYS_ID, source_component=DRONE_COMP_ID)

# Earth radius
R = 6371000
angle = 0

while True:
    # Calculate position on circle
    angle_rad = math.radians(angle)

    # Offset in meters
    dx = args.radius * math.cos(angle_rad)
    dy = args.radius * math.sin(angle_rad)

    # Convert to lat/lon offset
    dlat = dy / R * (180 / math.pi)
    dlon = dx / (R * math.cos(math.radians(args.lat))) * (180 / math.pi)

    lat = args.lat + dlat
    lon = args.lon + dlon

    # Heading = direction of travel (tangent to circle)
    hdg = (angle + 90) % 360

    # Send heartbeat first (so GCS knows drone is alive)
    mav.mav.heartbeat_send(
        2,   # MAV_TYPE_QUADROTOR
        3,   # MAV_AUTOPILOT_ARDUPILOTMEGA
        0x80 | 0x40 | 0x10,  # base_mode: armed + guided + stabilize
        0,   # custom_mode
        4,   # MAV_STATE_ACTIVE
    )

    # Send GLOBAL_POSITION_INT
    mav.mav.global_position_int_send(
        int(time.time() * 1000) & 0xFFFFFFFF,  # time_boot_ms
        int(lat * 1e7),    # lat
        int(lon * 1e7),    # lon
        int(args.alt * 1000),  # alt MSL (mm)
        int(args.alt * 1000),  # relative_alt (mm)
        0,    # vx
        0,    # vy
        0,    # vz
        int(hdg * 100),    # hdg (cdeg)
    )

    print(f"\rDrone: {lat:.6f}, {lon:.6f} | Alt: {args.alt:.0f}m | Hdg: {hdg:.0f} | Angle: {angle:.0f}", end="", flush=True)

    angle = (angle + args.speed * 0.5) % 360  # Update every 0.5s
    time.sleep(0.5)
