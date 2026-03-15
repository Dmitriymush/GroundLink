# Rotator & GroundLink Setup Guide

> Step-by-step instructions for configuring the rotator communication system

---

## Table of Contents

1. [What You Need](#1-what-you-need)
2. [ONE-TIME Setup: WIFI232-B2](#2-one-time-setup)
3. [Setup: RS232/485 TO WIFI ETH (B)](#setup-rs232485-to-wifi-eth-b)
4. [Verify Configuration](#3-verify-configuration)
5. [Normal Operation](#4-normal-operation)
6. [Remote Access Setup](#5-remote-access-setup)
7. [Building GroundLink for Windows](#building-groundlink-for-windows)
8. [Troubleshooting](#6-troubleshooting)

---

## 1. What You Need

### Hardware

| Item | Description | Where to Buy |
|------|-------------|--------------|
| WIFI232-B2 | Waveshare UART-WiFi module | [Waveshare](https://www.waveshare.com/uart-wifi232-b2.htm), [EVO.net.ua](https://evo.net.ua/ru/adapter-uart-wifi232-b2-25116/) |
| USB-to-UART Adapter | CH340, CP2102, or FT232 | Amazon, AliExpress, local electronics store |
| Jumper Wires | Female-to-female, 4 pcs | Electronics store |
| Starlink | Internet connection at field site | Already installed |
| PC with GroundLink | Windows/macOS/Linux | Your computer |

### Software

| Software | Purpose | Download |
|----------|---------|----------|
| Serial Terminal | Send AT commands | PuTTY (Windows), CoolTerm (macOS), minicom (Linux) |
| GroundLink | Control application | This repository |

---

## 2. ONE-TIME Setup

> **This configuration is done ONCE. Settings are saved permanently.**

### Step 2.1: Gather Starlink WiFi Credentials

Before starting, you need:

```
┌─────────────────────────────────────────────────────────────────┐
│  STARLINK WIFI INFORMATION                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Network Name (SSID):  _________________________________        │
│                        Example: STARLINK-ABC123-5G              │
│                                                                 │
│  Password:             _________________________________        │
│                        Example: MySecurePassword123             │
│                                                                 │
│  Router IP:            192.168.1.1 (usually default)            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**How to find:**
- Open Starlink app on your phone
- Go to Settings → WiFi
- Note the network name and password

---

### Step 2.2: Connect WIFI232-B2 to PC

**Wiring diagram:**

```
┌─────────────────┐                    ┌─────────────────┐
│   USB-to-UART   │                    │   WIFI232-B2    │
│     Adapter     │                    │                 │
│                 │                    │                 │
│      TX  ───────┼────────────────────┼───► RX          │
│      RX  ◄──────┼────────────────────┼──── TX          │
│      GND ───────┼────────────────────┼──── GND         │
│      3.3V ──────┼────────────────────┼───► VCC         │
│                 │                    │                 │
│    [USB to PC]  │                    │   [Antenna]     │
└─────────────────┘                    └─────────────────┘

⚠️  IMPORTANT:
    - TX connects to RX (crossed!)
    - RX connects to TX (crossed!)
    - Check voltage: 3.3V or 5V (see your module specs)
```

**Physical connection:**

1. Connect jumper wires as shown above
2. Plug USB adapter into your PC
3. WIFI232-B2 LED should light up (powered)

---

### Step 2.3: Find COM Port

#### Windows:

1. Press `Win + X` → Device Manager
2. Expand **Ports (COM & LPT)**
3. Find your adapter: `USB-SERIAL CH340 (COM3)` or similar
4. Note the COM port number (e.g., `COM3`)

```
Device Manager
└── Ports (COM & LPT)
    └── USB-SERIAL CH340 (COM3)  ◄── This is your port
```

#### macOS:

Open Terminal and run:
```bash
ls /dev/tty.usb*
```

Result example:
```
/dev/tty.usbserial-1420    ◄── This is your port
```

#### Linux:

Open Terminal and run:
```bash
ls /dev/ttyUSB*
```

Result example:
```
/dev/ttyUSB0    ◄── This is your port
```

---

### Step 2.4: Open Serial Terminal

#### Windows (PuTTY):

1. Download PuTTY: https://putty.org
2. Open PuTTY
3. Configure:
   - Connection type: **Serial**
   - Serial line: **COM3** (your port)
   - Speed: **115200**
4. Click **Open**

```
┌─────────────────────────────────────┐
│ PuTTY Configuration                 │
├─────────────────────────────────────┤
│                                     │
│ Connection type:                    │
│ ○ Raw  ○ Telnet  ○ Rlogin  ○ SSH   │
│ ● Serial                            │
│                                     │
│ Serial line:  [ COM3        ]       │
│ Speed:        [ 115200      ]       │
│                                     │
│         [ Open ]  [ Cancel ]        │
└─────────────────────────────────────┘
```

#### macOS (CoolTerm):

1. Download CoolTerm: https://freeware.the-meiers.org
2. Open CoolTerm
3. Options → Serial Port:
   - Port: `/dev/tty.usbserial-1420`
   - Baudrate: `115200`
   - Data Bits: `8`
   - Parity: `None`
   - Stop Bits: `1`
4. Click **Connect**

#### macOS/Linux (Terminal):

```bash
screen /dev/tty.usbserial-1420 115200
# or
screen /dev/ttyUSB0 115200
```

To exit screen: Press `Ctrl+A`, then `K`, then `Y`

---

### Step 2.5: Enter AT Command Mode

In your serial terminal:

**Step 1:** Type `+++` and **wait 2 seconds** (don't press Enter)

```
+++
```

**Step 2:** After 2 seconds, type `AT` and press Enter:

```
AT
```

**Expected response:**
```
+ok
```

If you see `+ok`, you're connected! If not, see [Troubleshooting](#6-troubleshooting).

---

### Step 2.6: Configure WIFI232-B2

Send these commands **one by one**, pressing Enter after each, and wait for `+ok`:

#### Command 1: Set WiFi Mode to Station

```
AT+WMODE=STA
```
Response: `+ok`

#### Command 2: Set Starlink WiFi Name (SSID)

```
AT+WSSSID=YOUR_STARLINK_WIFI_NAME
```
Response: `+ok`

**Example:**
```
AT+WSSSID=STARLINK-ABC123-5G
```

#### Command 3: Set WiFi Password

```
AT+WSKEY=WPA2PSK,AES,YOUR_STARLINK_PASSWORD
```
Response: `+ok`

**Example:**
```
AT+WSKEY=WPA2PSK,AES,MySecurePassword123
```

#### Command 4: Set UDP Server Mode

```
AT+NETP=UDP,SERVER,24448,0.0.0.0
```
Response: `+ok`

This configures:
- Protocol: UDP
- Mode: Server (listening)
- Port: 24448
- Accept from: Any IP address

#### Command 5: Set UART Parameters

```
AT+UART=115200,8,1,NONE,NFC
```
Response: `+ok`

This configures:
- Baud rate: 115200
- Data bits: 8
- Stop bits: 1
- Parity: None
- Flow control: None

#### Command 6: Set Static IP (Recommended)

```
AT+WANN=STATIC,192.168.1.200,255.255.255.0,192.168.1.1
```
Response: `+ok`

This sets:
- IP Address: `192.168.1.200` (always the same)
- Subnet Mask: `255.255.255.0`
- Gateway: `192.168.1.1` (Starlink router)

**Alternative - Use DHCP (IP may change):**
```
AT+WANN=DHCP
```

#### Command 7: Save and Restart

```
AT+Z
```

The module will restart. Connection to serial terminal will be lost - this is normal!

---

### Step 2.7: Complete Command Summary

Copy-paste reference (replace with your values):

```
+++
AT
AT+WMODE=STA
AT+WSSSID=STARLINK-ABC123-5G
AT+WSKEY=WPA2PSK,AES,MySecurePassword123
AT+NETP=UDP,SERVER,24448,0.0.0.0
AT+UART=115200,8,1,NONE,NFC
AT+WANN=STATIC,192.168.1.200,255.255.255.0,192.168.1.1
AT+Z
```

---

## 3. Verify Configuration

### Step 3.1: Check LED Status

After restart, observe WIFI232-B2 LEDs:

| LED State | Meaning |
|-----------|---------|
| Blinking fast | Searching for WiFi |
| Blinking slow | Connecting to WiFi |
| Solid ON | Connected to WiFi |

**Wait 10-30 seconds** for connection to establish.

---

### Step 3.2: Verify IP Address

#### Method A: Check Starlink Router

1. Open Starlink app on phone
2. Go to Network → Devices
3. Look for device named "WIFI232" or similar
4. Note IP address (should be `192.168.1.200` if you set static)

#### Method B: Query Module (reconnect serial)

If you reconnect USB-UART adapter:

```
+++
AT+WANN
```

Response:
```
+ok=STATIC,192.168.1.200,255.255.255.0,192.168.1.1
```

#### Method C: Network Scanner

On your PC (connected to same Starlink WiFi):

**Windows:**
```cmd
arp -a
```

**macOS/Linux:**
```bash
arp -a | grep 192.168.1
```

Or use network scanner app (Fing, Angry IP Scanner).

---

### Step 3.3: Test UDP Connection

From PC connected to Starlink WiFi:

**Linux/macOS:**
```bash
# Send test message
echo "test" | nc -u 192.168.1.200 24448
```

**Windows (PowerShell):**
```powershell
# Test connection
Test-NetConnection -ComputerName 192.168.1.200 -Port 24448 -InformationLevel Detailed
```

If connection works, WIFI232-B2 is ready!

---

## 4. Normal Operation

After one-time setup, daily usage is simple:

### At Field Site:

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: Power ON                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Turn on power to rotator system                             │
│     (WIFI232-B2 + MCU + Motors)                                │
│                                                                 │
│  2. Wait 10-30 seconds                                          │
│                                                                 │
│  3. WIFI232-B2 automatically:                                   │
│     ✓ Connects to Starlink WiFi                                │
│     ✓ Gets IP address 192.168.1.200                            │
│     ✓ Starts UDP server on port 24448                          │
│     ✓ Ready to receive commands                                 │
│                                                                 │
│  No user action required!                                       │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### At Operator PC:

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 2: Connect GroundLink                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Make sure PC is on same network:                            │
│     - Same Starlink WiFi (if local)                            │
│     - Or VPN connected (if remote)                              │
│                                                                 │
│  2. Open GroundLink application                                 │
│                                                                 │
│  3. Go to Settings → Rotator                                    │
│                                                                 │
│  4. Enter connection details:                                   │
│     ┌───────────────────────────────────────┐                   │
│     │ IP Address: [ 192.168.1.200        ]  │                   │
│     │ Port:       [ 24448                ]  │                   │
│     │                                       │                   │
│     │ [ Connect ]                           │                   │
│     └───────────────────────────────────────┘                   │
│                                                                 │
│  5. Click "Connect"                                             │
│                                                                 │
│  6. Status should show: ● Connected                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Control Rotator:

```
┌─────────────────────────────────────────────────────────────────┐
│  STEP 3: Control                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Go to Antenna Control page                                  │
│                                                                 │
│  2. Enable rotator control checkbox                             │
│                                                                 │
│  3. Use controls:                                               │
│     - Click on compass to set azimuth                          │
│     - Use arrow buttons for fine adjustment                    │
│     - Enter degrees directly in input field                    │
│                                                                 │
│  4. Watch telemetry:                                            │
│     - Actual position updates from rotator                     │
│     - Battery voltage displayed                                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Remote Access Setup

If operator is NOT at the field site (different location):

### Option A: Tailscale (Easiest)

```
┌─────────────────────────────────────────────────────────────────┐
│  TAILSCALE SETUP                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  At Field Site:                                                 │
│  ──────────────                                                 │
│  1. Get a Raspberry Pi (or any Linux device)                   │
│  2. Connect it to Starlink WiFi                                │
│  3. Install Tailscale:                                          │
│     curl -fsSL https://tailscale.com/install.sh | sh           │
│  4. Login: sudo tailscale up                                    │
│  5. Note the Tailscale IP (e.g., 100.64.0.1)                   │
│                                                                 │
│  At Operator PC:                                                │
│  ────────────────                                               │
│  1. Install Tailscale: https://tailscale.com/download          │
│  2. Login with same account                                     │
│  3. Your PC gets Tailscale IP (e.g., 100.64.0.2)               │
│                                                                 │
│  Now use in GroundLink:                                         │
│  ──────────────────────                                         │
│  - IP: 192.168.1.200 (access via Tailscale network)            │
│  - Both devices can communicate through Tailscale!             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Option B: WireGuard VPN

```
┌─────────────────────────────────────────────────────────────────┐
│  WIREGUARD VPN SETUP                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  At Field Site (VPN Server):                                    │
│  ────────────────────────────                                   │
│  1. Install WireGuard on a device at field site                │
│  2. Configure as server                                         │
│  3. Note public key and endpoint                               │
│                                                                 │
│  At Operator PC (VPN Client):                                   │
│  ─────────────────────────────                                  │
│  1. Install WireGuard                                           │
│  2. Import configuration from server                           │
│  3. Connect to VPN                                              │
│                                                                 │
│  Now use in GroundLink:                                         │
│  ──────────────────────                                         │
│  - IP: 192.168.1.200 (through VPN tunnel)                      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

---

## Setup: RS232/485 TO WIFI ETH (B)

> Alternative adapter — Waveshare RS232/485 TO WIFI ETH (B). Use this section instead of Section 2 if you have this adapter.

### What You Need

| Item | Description |
|------|-------------|
| RS232/485 TO WIFI ETH (B) | Waveshare serial server (Part No. 25222) |
| Arduino Pro Micro | MCU for rotator control |
| 6-36V Power Supply | For the adapter (DC jack or terminal) |
| 2x Wires | For RS485 A/B connection to Arduino |
| PC with GroundLink | Windows or macOS |

### Step A1: Power and Connect

1. Power the adapter with 6-36V via DC jack or terminal block
2. Connect Arduino Pro Micro to the adapter's RS485 terminal:
   ```
   Adapter RS485        Arduino Pro Micro
   ─────────────        ────────────────
   A ────────────────── RX (pin 0)
   B ────────────────── TX (pin 1)
   G ────────────────── GND
   ```
   > Note: This direct RS485→TTL connection works at 9600 baud only.
   > For higher baud rates, add a MAX485 module on the Arduino side.

### Step A2: Connect to Adapter's WiFi AP

1. On your PC, open WiFi settings
2. Connect to the adapter's AP network (named `Waveshare_XXXX`)
3. Open browser: `http://10.10.100.254/home.html`
4. Login: **admin** / **admin**

### Step A3: Configure WiFi via curl

The web form mangles special characters in passwords. Use curl instead:

```bash
# Set WiFi SSID
curl -u admin:admin -X POST "http://10.10.100.254/EN/do_cmd_fast.html" \
  -d "SET0=81723904=YOUR_WIFI_NAME"

# Set WiFi password (encode & as %26, # as %23, etc.)
curl -u admin:admin -X POST "http://10.10.100.254/EN/do_cmd_fast.html" \
  -d "SET0=304087552=YOUR_PASSWORD"

# Set AP+STA mode
curl -u admin:admin -X POST "http://10.10.100.254/EN/do_cmd_fast.html" \
  -d "SET0=18088192=2"

# Enable STA client
curl -u admin:admin -X POST "http://10.10.100.254/EN/do_cmd_fast.html" \
  -d "SET0=81002752=1"
```

### Step A4: Set Baud Rate to 9600

```bash
# Set baud to 9600 (config value 12)
curl -u admin:admin -X POST "http://10.10.100.254/EN/do_cmd_fast.html" \
  -d "SET0=285344000=12"
```

> Baud rate mapping: 12=9600, 14=38400, 15=57600, 16=115200

### Step A5: Reboot

```bash
curl -u admin:admin -X POST "http://10.10.100.254/EN/restart.html" \
  -d "CMD=SYS_CONF"
```

### Step A6: Find Adapter on Network

1. Connect your PC to the same WiFi network
2. Find the adapter's IP:
   ```bash
   # macOS/Linux
   arp -a | grep -i d4:ad

   # Windows
   arp -a
   ```
   Look for MAC addresses starting with `d4-ad-20`
3. Ping the adapter:
   ```bash
   ping <adapter_ip>
   ```

### Step A7: Connect GroundLink

1. Open GroundLink
2. Go to Settings → Rotator
3. Enter:
   - **Host**: `<adapter_ip>` (e.g., `192.168.0.117`)
   - **Port**: `24448`
4. Click Connect

### Step A8: Verify Data Flow

```bash
# Watch traffic between GroundLink and adapter
sudo tcpdump -i en0 udp port 24448 -A
```

You should see:
- **Outgoing commands**: `T:101;R:102;X:<PWM>;Y:<CMD>;CH:<checksum>;`
- **Incoming telemetry**: `T:102;R:101;COM:<deg>;V:<voltage>;CH:<checksum>;`

### URL Encoding for Special Characters in Passwords

| Character | URL Encode |
|-----------|------------|
| `&` | `%26` |
| `#` | `%23` |
| `!` | `%21` |
| `$` | `%24` |
| `@` | `%40` |
| `+` | `%2B` |
| `=` | `%3D` |
| ` ` (space) | `%20` |

### RS232/485 TO WIFI ETH (B) Quick Reference Card

```
Adapter Settings (current)
──────────────────────────
WiFi Mode:    AP+STA
Protocol:     UDP Server, port 24448
UART:         9600 / 8N1 / Transparent
Web Auth:     admin / admin
AP IP:        10.10.100.254
MAC prefix:   d4:ad:20

Config IDs (for curl POST to do_cmd_fast.html)
──────────────────────────────────────────────
81723904    SSID
304087552   Password
18088192    Mode (1=AP, 2=AP+STA, 3=STA)
81002752    STA enable (0=off, 1=on)
285934080   Protocol (TCP/UDP)
286064896   Port
285344000   Baud rate (12=9600, 15=57600, 16=115200)

Troubleshooting
───────────────
Data garbled?     → Swap RS485 A and B wires
No data at all?   → Check B wire is connected
Port in use?      → lsof -i :24449 / kill the process
Can't reach web?  → Connect to Waveshare_XXXX AP first
```

---

## Building GroundLink for Windows

### Prerequisites (one-time)

1. Install **Node.js LTS** from https://nodejs.org
2. Clone or copy the project to the Windows machine
3. Open Command Prompt in the project root:
   ```cmd
   cd C:\path\to\GroundLink
   npm install
   ```

### Build the Installer

```cmd
npm run build-no-lint
```

> Use `npm run build` for a full build with TypeScript type-checking.
> Use `npm run build-no-lint` to skip type-checking (faster, avoids strict TS errors).

### Output

The installer will be at:

```
release\<version>\GroundLink-Windows-<version>-Setup.exe
```

Example: `release\1.0.0\GroundLink-Windows-1.0.0-Setup.exe`

### Common Build Issues

| Error | Fix |
|-------|-----|
| `Invalid version: "1"` | Change `"version": "1"` to `"version": "1.0.0"` in `package.json` |
| Native module errors | Run `npx @electron/rebuild` |
| `node-hid` build fails | Install Windows Build Tools: `npm install -g windows-build-tools` |
| `-replace was unexpected` | Use `notepad package.json` in cmd.exe (not PowerShell syntax) |

### Editing package.json on Windows

```cmd
notepad package.json
```

Or via PowerShell:
```powershell
powershell -Command "(Get-Content package.json) -replace '\"version\": \"1\"', '\"version\": \"1.0.0\"' | Set-Content package.json"
```

---

## 6. Troubleshooting

### Problem: No Response to AT Commands

| Check | Solution |
|-------|----------|
| Wiring | TX→RX, RX→TX (must be crossed) |
| Power | Ensure 3.3V or 5V connected |
| Baud rate | Try 115200, 9600, 57600 |
| `+++` timing | Wait 2 seconds before sending AT |
| COM port | Verify correct port selected |

### Problem: `+ok` but WiFi Won't Connect

| Check | Solution |
|-------|----------|
| SSID | Must match exactly (case-sensitive) |
| Password | Check for typos, special characters |
| WiFi band | WIFI232-B2 only supports 2.4GHz |
| Distance | Move closer to Starlink router |
| Starlink status | Check if Starlink is online |

### Problem: Connected but No UDP Communication

| Check | Solution |
|-------|----------|
| IP address | Verify correct IP in GroundLink |
| Port | Must be 24448 (or your configured port) |
| Firewall | Temporarily disable to test |
| Same network | Both devices must be on same network |
| VPN | If remote, check VPN is connected |

### Problem: Intermittent Connection

| Check | Solution |
|-------|----------|
| WiFi signal | Improve antenna position |
| Power supply | Ensure stable power to WIFI232-B2 |
| Interference | Move away from other electronics |
| Static IP | Use static IP instead of DHCP |

### Reset to Factory Defaults

If something goes wrong, reset WIFI232-B2:

```
+++
AT+RELD
```

This restores factory settings. You'll need to reconfigure.

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────────┐
│              WIFI232-B2 QUICK REFERENCE                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  SERIAL CONNECTION                                              │
│  ─────────────────                                              │
│  Baud: 115200 | Data: 8 | Stop: 1 | Parity: None               │
│                                                                 │
│  WIRING (USB-UART → WIFI232)                                   │
│  ───────────────────────────                                    │
│  TX → RX  |  RX ← TX  |  GND ↔ GND  |  3.3V → VCC              │
│                                                                 │
│  AT COMMANDS                                                    │
│  ───────────                                                    │
│  +++                     Enter command mode (wait 2s)           │
│  AT                      Test connection                        │
│  AT+WMODE=STA            Station mode                           │
│  AT+WSSSID=<name>        Set WiFi name                          │
│  AT+WSKEY=WPA2PSK,AES,<pass>  Set WiFi password                │
│  AT+NETP=UDP,SERVER,24448,0.0.0.0  UDP server                  │
│  AT+UART=115200,8,1,NONE,NFC  UART settings                    │
│  AT+WANN=STATIC,<ip>,<mask>,<gw>  Static IP                    │
│  AT+WANN=DHCP            Use DHCP                               │
│  AT+Z                    Save and restart                       │
│  AT+RELD                 Factory reset                          │
│                                                                 │
│  DEFAULT VALUES                                                 │
│  ──────────────                                                 │
│  WIFI232-B2 IP: 192.168.1.200 (if static configured)           │
│  UDP Port: 24448                                                │
│  GroundLink Local Port: 24449                                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```
