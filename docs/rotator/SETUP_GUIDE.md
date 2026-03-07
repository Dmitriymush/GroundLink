# WIFI232-B2 & GroundLink Setup Guide

> Step-by-step instructions for configuring the rotator communication system

---

## Table of Contents

1. [What You Need](#1-what-you-need)
2. [ONE-TIME Setup](#2-one-time-setup)
3. [Verify Configuration](#3-verify-configuration)
4. [Normal Operation](#4-normal-operation)
5. [Remote Access Setup](#5-remote-access-setup)
6. [Troubleshooting](#6-troubleshooting)

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
