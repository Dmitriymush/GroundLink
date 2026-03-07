# Remote Access — GroundLink to Field Rotator

How to control the rotator from Borsch network when the WIFI232-B2 adapter is on a different WiFi network in the field (e.g. Starlink).

```
YOUR LOCATION (Borsch)                    FIELD LOCATION (Starlink)
┌──────────────┐                          ┌─────────────┐     UART     ┌──────────┐
│  GroundLink  │◄── UDP over VPN ────────►│ WIFI232-B2  │◄───────────►│ Arduino  │──► Servos
│  Mac/PC      │                          │ 192.168.1.x │             │          │──► Compass
│  Borsch WiFi │                          │ Starlink    │             │          │──► Battery
└──────────────┘                          └─────────────┘             └──────────┘
   192.168.3.x                              192.168.1.x
```

---

## Part 1: Field Hardware — Arduino + WIFI232-B2

### What You Need

| Item | Purpose |
|---|---|
| Arduino (Uno/Nano/Mega) | Rotator MCU — parses commands, drives servos, reads sensors |
| WIFI232-B2 | UART↔WiFi bridge (UDP) |
| Servo x2 | Azimuth + elevation motors |
| Compass sensor (HMC5883L/QMC5883L) | Current heading feedback |
| Battery + voltage divider | Power + voltage telemetry |
| Raspberry Pi (optional) | VPN gateway for remote access from another network |

### Wiring: Arduino ↔ WIFI232-B2

```
Arduino                    WIFI232-B2
───────                    ──────────
pin 1 (TX)  ──────────►   RXD
pin 0 (RX)  ◄──────────   TXD
GND         ────────────   GND
5V          ────────────   VCC (check module voltage!)

IMPORTANT: TX→RX crossover! Arduino TX goes to module RX.
```

If using SoftwareSerial (to keep Serial free for debugging):
```
Arduino                    WIFI232-B2
───────                    ──────────
pin 10 (SW TX) ────────►   RXD
pin 11 (SW RX) ◄────────   TXD
GND            ────────────   GND
```

### How to Flash Arduino (step by step for beginners)

#### Step 1: Install Arduino IDE

1. Go to https://www.arduino.cc/en/software
2. Download **Arduino IDE 2.x** for your OS (Windows / macOS / Linux)
3. Install and open it

#### Step 2: Connect Arduino to PC

1. Plug Arduino into your PC with a USB cable
2. In Arduino IDE, go to **Tools → Board** and select your board:
   - `Arduino Uno` / `Arduino Nano` / `Arduino Mega` (whichever you have)
3. Go to **Tools → Port** and select the port:
   - **macOS**: `/dev/cu.usbmodem...` or `/dev/cu.usbserial-...`
   - **Windows**: `COM3`, `COM4`, etc.
   - **Linux**: `/dev/ttyUSB0` or `/dev/ttyACM0`
4. If you don't see a port, install the USB driver:
   - CH340: https://sparks.gogo.co.nz/ch340.html
   - CP2102: https://www.silabs.com/developers/usb-to-uart-bridge-vcp-drivers
   - FTDI: https://ftdichip.com/drivers/

#### Step 3: Upload the Firmware

1. In Arduino IDE: **File → New**
2. Delete all the default code
3. Copy-paste the entire sketch below
4. Click the **Upload** button (→ arrow icon in the top-left)
5. Wait for "Done uploading" message at the bottom

#### Step 4: Test with Serial Monitor

1. In Arduino IDE: **Tools → Serial Monitor** (or Ctrl+Shift+M)
2. Set baud rate to **115200** (dropdown in the bottom-right)
3. You should see telemetry lines appearing every 500ms:
   ```
   T:102;R:101;COM:0;V:12.4;CH:102101012.4;
   ```
4. You can type a test command and press Enter:
   ```
   T:101;R:102;X:1470;Y:0;CH:10110214700;
   ```

**IMPORTANT**: Before connecting the WIFI232-B2, disconnect from Arduino IDE Serial Monitor — only one program can use the serial port at a time.

#### Step 5: Wire WIFI232-B2

1. Close Arduino IDE Serial Monitor
2. Disconnect USB cable
3. Wire Arduino to WIFI232-B2 (see wiring diagram above)
4. Power on — the Arduino runs the firmware automatically from flash memory

### Arduino Firmware

The Arduino must implement the exact Pascal protocol:

**Receive** command frames from GroundLink (via WIFI232-B2 UART):
```
T:101;R:102;X:<PWM>;Y:<CMD>;CH:<T><R><X><Y>;\r\n
```

**Send** telemetry back (via WIFI232-B2 UART):
```
T:102;R:101;COM:<compass_degrees>;V:<voltage>;CH:<T><R><COM><V>;\r\n
```

#### Arduino Sketch

```cpp
// rotator_controller.ino
// Protocol: github.com/SkopasGit/rotation

#include <Servo.h>

// --- Config ---
#define SERIAL_BAUD 115200
#define TELEMETRY_INTERVAL_MS 500

// Azimuth servo
#define AZ_SERVO_PIN 9
#define AZ_PWM_MIN 540
#define AZ_PWM_MAX 2400

// Elevation servo
#define EL_SERVO_PIN 10
#define EL_CMD_MIN 0
#define EL_CMD_MAX 95

// Voltage divider on A0 (e.g. 12V battery through 3:1 divider)
#define VOLTAGE_PIN A0
#define VOLTAGE_MULTIPLIER 4.0  // Adjust for your divider ratio

// --- State ---
Servo azServo;
Servo elServo;

int lastPWM = 1470;    // center
int lastCMD = 0;
int currentCompass = 0; // from compass sensor or simulated
unsigned long lastTelemetryMs = 0;

char rxBuf[128];
int rxPos = 0;

// --- Command Parsing ---
// Parse: T:101;R:102;X:1470;Y:0;CH:10110214700;
bool parseCommand(const char* line, int &pwm, int &cmd) {
  char sT[8]="", sR[8]="", sX[8]="", sY[8]="", sCH[32]="";

  // Extract fields
  const char* p = line;
  while (*p) {
    if (strncmp(p, "T:", 2) == 0) { p+=2; int i=0; while(*p && *p!=';') sT[i++]=*p++; }
    else if (strncmp(p, "R:", 2) == 0) { p+=2; int i=0; while(*p && *p!=';') sR[i++]=*p++; }
    else if (strncmp(p, "X:", 2) == 0) { p+=2; int i=0; while(*p && *p!=';') sX[i++]=*p++; }
    else if (strncmp(p, "Y:", 2) == 0) { p+=2; int i=0; while(*p && *p!=';') sY[i++]=*p++; }
    else if (strncmp(p, "CH:", 3) == 0) { p+=3; int i=0; while(*p && *p!=';') sCH[i++]=*p++; }
    else p++;
  }

  if (strlen(sT)==0 || strlen(sX)==0 || strlen(sY)==0) return false;

  // Verify checksum (raw string concat)
  char expected[32];
  snprintf(expected, sizeof(expected), "%s%s%s%s", sT, sR, sX, sY);
  if (strcmp(expected, sCH) != 0) return false;

  pwm = atoi(sX);
  cmd = atoi(sY);
  return true;
}

// --- Telemetry ---
void sendTelemetry() {
  // Read compass (replace with real sensor reading)
  // currentCompass = readCompass();  // TODO: implement

  // Read voltage
  int raw = analogRead(VOLTAGE_PIN);
  float voltage = (raw / 1023.0) * 5.0 * VOLTAGE_MULTIPLIER;

  // Build telemetry: T:102;R:101;COM:<deg>;V:<voltage>;CH:<concat>;
  char com[8], vol[8];
  itoa(currentCompass, com, 10);
  dtostrf(voltage, 1, 1, vol);

  // Checksum = raw string concat of T + R + COM + V
  Serial.print("T:102;R:101;COM:");
  Serial.print(com);
  Serial.print(";V:");
  Serial.print(vol);
  Serial.print(";CH:102101");
  Serial.print(com);
  Serial.print(vol);
  Serial.print(";\r\n");
}

// --- Main ---
void setup() {
  Serial.begin(SERIAL_BAUD);

  azServo.attach(AZ_SERVO_PIN);
  elServo.attach(EL_SERVO_PIN);

  // Center position
  azServo.writeMicroseconds(1470);
  elServo.write(45);
}

void loop() {
  // --- Read incoming commands ---
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n' || c == '\r') {
      if (rxPos > 0) {
        rxBuf[rxPos] = '\0';

        int pwm, cmd;
        if (parseCommand(rxBuf, pwm, cmd)) {
          // Apply to servos
          pwm = constrain(pwm, AZ_PWM_MIN, AZ_PWM_MAX);
          cmd = constrain(cmd, EL_CMD_MIN, EL_CMD_MAX);

          azServo.writeMicroseconds(pwm);
          elServo.write(map(cmd, 0, 95, 0, 180));  // adjust for your servo

          lastPWM = pwm;
          lastCMD = cmd;

          // Update compass from PWM for simulation
          // (replace with real compass reading in production)
          int deg = map(pwm, 540, 2400, -164, 164);
          currentCompass = deg < 0 ? deg + 360 : deg;
        }

        rxPos = 0;
      }
    } else if (rxPos < (int)sizeof(rxBuf) - 1) {
      rxBuf[rxPos++] = c;
    }
  }

  // --- Send telemetry every 500ms ---
  unsigned long now = millis();
  if (now - lastTelemetryMs >= TELEMETRY_INTERVAL_MS) {
    lastTelemetryMs = now;
    sendTelemetry();
  }
}
```

### WIFI232-B2 Configuration for Field

Before deploying, configure the module for the field WiFi:

```bash
# Connect USB-UART adapter to WIFI232-B2
# Open serial terminal:
screen /dev/cu.usbserial-A5069RR4 115200

# Enter AT mode:
+++            # wait 2 seconds, no Enter
AT             # should respond +ok

# Configure for field WiFi (e.g. Starlink):
AT+WMODE=STA
AT+WSSSID=STARLINK-ABC123
AT+WSKEY=WPA2PSK,AES,StarllinkPassword123
AT+NETP=UDP,SERVER,24448,0.0.0.0
AT+UART=115200,8,1,NONE,NFC
AT+WANN=STATIC,192.168.1.200,255.255.255.0,192.168.1.1
AT+Z

# Or use web interface:
# 1. Connect to Waveshare_5F94 AP
# 2. http://10.10.100.254/EN/sta_set.html → set SSID/password
# 3. http://10.10.100.254/EN/net_set.html → verify UDP/24448
```

### Test Locally Before Deploying

1. Wire Arduino ↔ WIFI232-B2
2. Connect both to the same WiFi as your Mac
3. Start GroundLink: `npm run dev`
4. Settings → Rotator → Host: `<module_IP>`, Port: `24448`
5. Enable → Connect → move azimuth
6. Verify: Arduino receives commands, telemetry appears in GroundLink

---

## Part 2: Remote Access — Controlling from Another Network

### Why You Need a Raspberry Pi

The WIFI232-B2 only talks on its local WiFi. It cannot reach the internet.
Your Mac on Borsch cannot reach Starlink's local network.
You need ONE device at the field that is on Starlink WiFi AND connected to the internet via VPN.
That device is a Raspberry Pi. It acts as a tunnel.

```
BORSCH (your home)                    FIELD (Starlink)
──────────────────                    ─────────────────

Mac (GroundLink)                      Raspberry Pi ──── same WiFi ──── WIFI232-B2 ──── Arduino
  │                                     │
  └───── Tailscale VPN (internet) ──────┘

Your Mac can't see the WIFI232-B2 directly.
But your Mac CAN see the Pi via Tailscale.
The Pi CAN see the WIFI232-B2 (same WiFi).
So the Pi relays traffic between them.
```

---

### What You Need to Buy

| Item | Price | Where |
|---|---|---|
| Raspberry Pi (any model with WiFi — Pi 3, 4, or Zero W) | ~$15-50 | Amazon, local electronics store |
| Micro SD card (8GB+) with Raspberry Pi OS | ~$5 | Included with some Pi kits |
| Power supply (USB) for Pi | ~$10 | Comes with Pi kits |
| That's it. No extra cables, no extra software to buy. | | |

The Arduino and WIFI232-B2 stay exactly as they are. You don't touch them.

---

### Step-by-Step Setup (Tailscale — the simplest way)

#### PHASE 1: Prepare the Raspberry Pi (do this at home, before going to field)

**Step 1.1: Install Raspberry Pi OS**

1. Download Raspberry Pi Imager: https://www.raspberrypi.com/software/
2. Insert the micro SD card into your Mac/PC
3. Open Raspberry Pi Imager
4. Choose OS: **Raspberry Pi OS Lite (64-bit)** (no desktop needed)
5. Click the gear icon and set:
   - Hostname: `rotator-gateway`
   - Enable SSH: yes
   - Username: `pi`
   - Password: choose one you'll remember (e.g. `rotator123`)
   - WiFi SSID: your home WiFi for now (you'll change it to Starlink later)
   - WiFi password: your home WiFi password
6. Write to SD card

**Step 1.2: Boot the Pi and connect via SSH**

1. Insert SD card into Pi
2. Plug in power — wait 1-2 minutes for first boot
3. From your Mac terminal:

```bash
# Find the Pi on your network:
ping rotator-gateway.local

# If that doesn't work, find it by IP:
arp -a | grep -i "b8:27:eb\|dc:a6:32\|e4:5f:01"

# SSH into it:
ssh pi@rotator-gateway.local
# Enter the password you set (e.g. rotator123)
```

**Step 1.3: Install Tailscale on the Pi**

Run these commands on the Pi (via SSH):

```bash
# Install Tailscale
curl -fsSL https://tailscale.com/install.sh | sh

# Start Tailscale as a subnet router
sudo tailscale up --advertise-routes=192.168.1.0/24 --accept-routes

# It will print a URL like:
# https://login.tailscale.com/a/abc123def456
# Open this URL in your browser and log in (create account if needed)
```

After login, note the Pi's Tailscale IP:

```bash
tailscale ip -4
# Example output: 100.64.0.5
# WRITE THIS DOWN: _______________
```

**Step 1.4: Enable IP forwarding on the Pi**

```bash
# Enable now:
sudo sysctl -w net.ipv4.ip_forward=1

# Enable permanently (survives reboot):
echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf
```

**Step 1.5: Install and configure the UDP relay on the Pi**

```bash
# Install socat (UDP relay tool):
sudo apt update && sudo apt install -y socat

# Create the relay service (starts automatically on every boot):
sudo tee /etc/systemd/system/rotator-relay.service << 'EOF'
[Unit]
Description=Rotator UDP relay to WIFI232-B2
After=network-online.target tailscaled.service
Wants=network-online.target tailscaled.service

[Service]
Type=simple
# CHANGE 192.168.1.200 to your WIFI232-B2's IP on Starlink!
ExecStart=/bin/bash -c '\
  socat UDP-LISTEN:24448,fork,reuseaddr UDP:192.168.1.200:24448 & \
  socat UDP-LISTEN:24449,fork,reuseaddr UDP:192.168.1.200:24449 & \
  wait'
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# Enable and start:
sudo systemctl daemon-reload
sudo systemctl enable rotator-relay
sudo systemctl start rotator-relay

# Verify it's running:
sudo systemctl status rotator-relay
# Should show "active (running)"
```

**Step 1.6: Test the Pi relay locally (while still at home)**

If the WIFI232-B2 is also on your home WiFi for testing:

```bash
# On the Pi, check if WIFI232-B2 is reachable:
ping 192.168.1.200    # or whatever IP the module has on your home WiFi

# Check relay is listening:
sudo ss -ulnp | grep 24448
# Should show socat listening on port 24448
```

#### PHASE 2: Set up your Mac (do this once)

**Step 2.1: Install Tailscale on your Mac**

1. Go to https://tailscale.com/download
2. Download and install the macOS app
3. Open Tailscale, log in with the SAME account you used on the Pi
4. Your Mac now has a Tailscale IP (check with `tailscale ip -4`)

**Step 2.2: Approve the Pi's subnet route**

1. Go to https://login.tailscale.com/admin/machines
2. Find `rotator-gateway` in the list
3. Click the "..." menu → "Edit route settings"
4. Approve the `192.168.1.0/24` subnet route
5. This allows your Mac to reach devices on the Starlink WiFi through the Pi

**Step 2.3: Test the connection**

```bash
# Ping the Pi through Tailscale:
ping 100.64.0.5    # use Pi's Tailscale IP

# If subnet routing is working, you can reach the WIFI232-B2 directly:
ping 192.168.1.200

# Test UDP:
echo "TEST" | nc -u -w1 192.168.1.200 24448
```

#### PHASE 3: Deploy to field

**Step 3.1: Configure WIFI232-B2 for Starlink WiFi**

Before going to the field, configure the WIFI232-B2 for Starlink:

```
Connect to Waveshare_5F94 AP → http://10.10.100.254/EN/sta_set.html

Set:
  SSID: <your_starlink_wifi_name>
  Password: <your_starlink_wifi_password>
  Static IP: 192.168.1.200
```

Or via AT commands (USB-UART adapter → WIFI232-B2):
```
+++
AT+WSSSID=<starlink_ssid>
AT+WSKEY=WPA2PSK,AES,<starlink_password>
AT+WANN=STATIC,192.168.1.200,255.255.255.0,192.168.1.1
AT+Z
```

**Step 3.2: Configure the Pi for Starlink WiFi**

```bash
# SSH into Pi:
ssh pi@rotator-gateway.local

# Set Starlink WiFi credentials:
sudo raspi-config
# Navigate to: System Options → Wireless LAN
# Enter Starlink SSID and password
# Finish and reboot
```

Or edit directly:

```bash
sudo tee -a /etc/wpa_supplicant/wpa_supplicant.conf << 'EOF'
network={
    ssid="YOUR_STARLINK_SSID"
    psk="YOUR_STARLINK_PASSWORD"
    priority=1
}
EOF
sudo reboot
```

**Step 3.3: At the field — just plug everything in**

1. Power on Arduino + WIFI232-B2 (connected via UART)
2. Power on Raspberry Pi (connected to Starlink WiFi)
3. Wait 30-60 seconds for everything to connect
4. The Pi auto-connects to Tailscale and starts the relay — no action needed

**Step 3.4: From Borsch — open GroundLink and connect**

1. Make sure Tailscale is running on your Mac
2. Open GroundLink: `npm run dev`
3. Settings → Rotator:
   - Host: `192.168.1.200` (WIFI232-B2's IP on Starlink)
   - Port: `24448`
4. Enable → Connect
5. Move azimuth — you should see telemetry coming back

The full path:
```
GroundLink (Borsch) → Tailscale VPN → internet → Pi (Starlink) → local WiFi → WIFI232-B2 → UART → Arduino → rotator
```

---

### Verifying Everything Works

From your Mac (Borsch network), run these checks:

```bash
# 1. Is the Pi reachable?
ping 100.64.0.5                    # Pi's Tailscale IP
# Expected: replies

# 2. Is subnet routing working?
ping 192.168.1.200                 # WIFI232-B2's Starlink IP
# Expected: replies (going through Pi)

# 3. Is UDP relay working?
echo "TEST" | nc -u -w1 192.168.1.200 24448
# Expected: no error (if Arduino is connected, you'd see it in serial monitor)

# 4. SSH into Pi to check status:
ssh pi@100.64.0.5
tailscale status                   # should show your Mac as connected
sudo systemctl status rotator-relay  # should show "active (running)"
ping 192.168.1.200                 # Pi can reach WIFI232-B2 locally
```

---

## Checklist

### Before leaving for field
```
[ ] Raspberry Pi prepared:
    [ ] Raspberry Pi OS installed on SD card
    [ ] Tailscale installed and logged in
    [ ] IP forwarding enabled
    [ ] rotator-relay service enabled
    [ ] Starlink WiFi credentials configured
    [ ] Pi's Tailscale IP noted: _______________

[ ] WIFI232-B2 configured for Starlink WiFi:
    [ ] SSID set to Starlink network name
    [ ] Password set
    [ ] Static IP set (192.168.1.200)
    [ ] UDP server port 24448

[ ] Mac prepared:
    [ ] Tailscale installed, same account as Pi
    [ ] Subnet route approved in Tailscale admin

[ ] Tested locally (everything on home WiFi):
    [ ] GroundLink sends commands through Pi relay
    [ ] Telemetry comes back
```

### At the field
```
[ ] Power on Arduino + WIFI232-B2
[ ] Power on Raspberry Pi
[ ] Wait 60 seconds
[ ] From Borsch: ping Pi's Tailscale IP
[ ] From Borsch: GroundLink connects and shows telemetry
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Can't ping Pi via Tailscale | Check both devices logged into same Tailscale account. Run `tailscale status` on Pi via another method (e.g. monitor+keyboard). |
| Can ping Pi but not 192.168.1.200 | Subnet route not approved. Go to https://login.tailscale.com/admin/machines → Pi → approve route. |
| Ping works but GroundLink can't connect | Check relay is running: `ssh pi@<tailscale_ip> "sudo systemctl status rotator-relay"`. Check WIFI232-B2 is on and connected to Starlink. |
| Commands sent but no telemetry | WIFI232-B2 responds to the last UDP source. GroundLink sends first (automatic). If still broken, check Arduino is powered and UART wired correctly. |
| Pi loses Starlink WiFi after reboot | Re-enter WiFi creds: `sudo raspi-config` → Wireless LAN. Or check `/etc/wpa_supplicant/wpa_supplicant.conf`. |
| Everything was working, suddenly stopped | Power cycle Pi and Arduino. Check Starlink is online. Run `tailscale up` on Pi. |
| Need to reconfigure WIFI232-B2 remotely | SSH into Pi, then connect to Waveshare_5F94 AP from Pi (not possible if Pi is on Starlink). Alternative: ask someone at field to connect phone to Waveshare_5F94 AP and open `http://10.10.100.254`. |
