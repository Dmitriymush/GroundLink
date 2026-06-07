#!/usr/bin/env python3
"""
Camera RTSP Emulator

Emulates an RTSP camera stream using ffmpeg test source.
Creates a fake RTSP stream that GroundLink can connect to.

Requires: ffmpeg installed on the system

Usage:
  python3 scripts/emulator_camera.py [--port 8554] [--width 640] [--height 480]

Then in GroundLink Camera window:
  RTSP URL: rtsp://127.0.0.1:8554/stream
"""

import subprocess
import sys
import signal
import argparse

parser = argparse.ArgumentParser(description="Camera RTSP emulator")
parser.add_argument("--port", type=int, default=8554, help="RTSP port (default: 8554)")
parser.add_argument("--width", type=int, default=640, help="Width (default: 640)")
parser.add_argument("--height", type=int, default=480, help="Height (default: 480)")
parser.add_argument("--fps", type=int, default=25, help="FPS (default: 25)")
args = parser.parse_args()

print(f"=== Camera RTSP Emulator ===")
print(f"Resolution: {args.width}x{args.height} @ {args.fps}fps")
print(f"RTSP URL: rtsp://127.0.0.1:{args.port}/stream")
print()
print("Note: This requires 'mediamtx' or 'rtsp-simple-server' for RTSP serving.")
print("Alternative: Using UDP stream that ffmpeg in GroundLink can receive directly.")
print()

# Since RTSP server requires additional software (mediamtx/rtsp-simple-server),
# we'll create a simple UDP stream that simulates what the camera would send.
# GroundLink's ffmpeg will connect to this.

# Option 1: If mediamtx is available, use it
# Option 2: Direct UDP stream (simpler, no RTSP server needed)

print("Starting test pattern stream via UDP on port 5400...")
print("In GroundLink, use RTSP URL: udp://127.0.0.1:5400")
print("Or connect ffmpeg directly.")
print()

try:
    # Generate test pattern and stream via UDP
    cmd = [
        "ffmpeg",
        "-re",  # real-time
        "-f", "lavfi",
        "-i", f"testsrc=size={args.width}x{args.height}:rate={args.fps}",
        "-f", "lavfi",
        "-i", f"sine=frequency=440:sample_rate=44100",
        "-vcodec", "libx264",
        "-preset", "ultrafast",
        "-tune", "zerolatency",
        "-b:v", "1000k",
        "-f", "mpegts",
        f"udp://127.0.0.1:5400?pkt_size=1316",
    ]

    print(f"Running: {' '.join(cmd)}")
    print()

    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)

    def signal_handler(sig, frame):
        proc.terminate()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)

    # Print stderr (ffmpeg output)
    for line in iter(proc.stderr.readline, b''):
        text = line.decode('utf-8', errors='replace').strip()
        if text:
            print(text)

except FileNotFoundError:
    print("ERROR: ffmpeg not found. Install it:")
    print("  macOS: brew install ffmpeg")
    print("  Linux: sudo apt install ffmpeg")
    print("  Windows: download from https://ffmpeg.org/download.html")
except KeyboardInterrupt:
    print("\nStopped.")
