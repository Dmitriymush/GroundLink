# WiFi-RS485 Adapter Debug Session Log

## Session 4 — 2026-03-05

### What Was Accomplished

1. **New adapter configured**: Waveshare RS232/485 TO WIFI ETH (B) — a different, more advanced module than the WIFI232-B2. Uses RS485 (A/B differential) instead of UART (TX/RX).

2. **WiFi configured via curl**: Web interface at `10.10.100.254` has auth (`admin:admin`). Pages live under `/EN/`. Used `curl -u admin:admin -X POST` to set SSID/password because the web form mangles special characters (`&` in password `603700R&D`).

3. **RS485 polarity issue diagnosed and fixed**: Data was arriving garbled — 15/16 bytes matched the formula `output = 0xFF - (input * 2)`, which is the signature of inverted RS485 polarity. Fixed by swapping A and B wires.

4. **Baud rate difference found**: This adapter defaults to **57600** baud (not 115200 like the WIFI232-B2). The `uart_baudrate=15` config value maps to 57600 on this module (value 16 = 115200).

5. **Bidirectional data flow confirmed**:
   - UDP→RS485: GroundLink sends to `192.168.0.117:24448` → clean data on USB-485 serial
   - RS485→UDP: Write to serial → adapter sends UDP back to last client

6. **GroundLink connected successfully** via Settings → Rotator → `192.168.0.117:24448`

### Hardware Setup

```
Mac (GroundLink)                    Waveshare RS232/485 TO WIFI ETH (B)
  │                                   │
  └──── WiFi (Sakura1) ── UDP ────────┘
         192.168.0.117:24448           │
                                    RS485 A/B
                                       │
USB-485 dongle ◄───────────────────────┘
/dev/cu.usbserial-A50285BI @ 57600

RS485 Wiring:
  Adapter A ──── USB-485 A (D+)
  Adapter B ──── USB-485 B (D-)
  (GND optional for short runs)
```

### Module Configuration (current)

| Setting | Value |
|---|---|
| WiFi Mode | AP+STA (`sys_opmode=2`) |
| STA SSID | `Sakura1` |
| STA Password | `603700R&D` |
| Security | WPA2PSK / AES |
| Network Protocol | UDP |
| Network Mode | Server |
| Network Port | 24448 |
| Server Address | 0.0.0.0 (accept any) |
| UART | 57600 / 8N1 / Transparent Mode |
| Data Transfer Mode | Transparent (0) |
| STA IP (DHCP) | `192.168.0.117` |
| STA MAC | `d4:ad:20:bf:7c:85` |
| AP IP | `10.10.100.254` |
| Web Auth | `admin` / `admin` |
| USB-485 Serial Port | `/dev/cu.usbserial-A50285BI` |

### Baud Rate Mapping (this module)

| Config Value | Baud Rate |
|---|---|
| 12 | 9600 |
| 14 | 38400 |
| **15** | **57600 (current)** |
| 16 | 115200 |

### Web Config IDs (decimal, for curl POST)

| Config ID | Setting |
|---|---|
| 81723904 | `ssid_name` — STA WiFi SSID |
| 304087552 | `ssid_name3` — STA WiFi password |
| 18088192 | `sys_opmode` — 1=AP, 2=AP+STA, 3=STA-only |
| 81002752 | `apcli_enable` — 0=AP only, 1=STA client on |
| 285934080 | `net_protocol` — TCP or UDP |
| 286064896 | `net_port` — network port |

### Quick Reference

```bash
# ===== FIND ADAPTER ON NETWORK =====
arp -a | grep -i d4:ad                         # find by MAC prefix (USR IOT / Waveshare)
ping 192.168.0.117                              # ping current IP

# ===== TEST UDP CONNECTION =====
echo "TEST" | nc -u -w1 192.168.0.117 24448    # send test packet
sudo tcpdump -i en0 host 192.168.0.117 -X      # watch all traffic

# ===== MONITOR SERIAL (USB-485) =====
screen /dev/cu.usbserial-A50285BI 57600         # simple monitor (exit: Ctrl+A, K, Y)
# Or with Python:
python3 -c "
import serial, time
s = serial.Serial('/dev/cu.usbserial-A50285BI', 57600, timeout=1)
print('Monitoring USB-485... Ctrl+C to stop')
while True:
    d = s.read(500)
    if d: print(d.decode('utf-8', errors='replace'), end='', flush=True)
"

# ===== WEB INTERFACE (connect to adapter AP first, or use STA IP) =====
# Via AP:
open http://10.10.100.254/home.html              # browser (user: admin, pass: admin)
# Via network:
open http://192.168.0.117/home.html

# Menu pages:
# opmode.html        — Mode Selection (AP/STA, Transparent/Serial Command)
# ap.html            — AP Interface Setting
# sta_config.html    — STA Interface Setting (WiFi SSID/password)
# app_config.html    — Application Setting (UART, socket, port)
# ephy_config.html   — Ethernet Setting
# management.html    — Device Management (reboot, firmware)

# ===== CONFIGURE WIFI VIA CURL (special chars safe) =====
# Set SSID:
curl -u admin:admin -X POST "http://10.10.100.254/EN/do_cmd_fast.html" \
  -d "SET0=81723904=Sakura1"

# Set password (& must be encoded as %26):
curl -u admin:admin -X POST "http://10.10.100.254/EN/do_cmd_fast.html" \
  -d "SET0=304087552=603700R%26D"

# Set AP+STA mode:
curl -u admin:admin -X POST "http://10.10.100.254/EN/do_cmd_fast.html" \
  -d "SET0=18088192=2"

# Enable STA client:
curl -u admin:admin -X POST "http://10.10.100.254/EN/do_cmd_fast.html" \
  -d "SET0=81002752=1"

# Reboot to apply:
curl -u admin:admin http://10.10.100.254/reboot.html

# ===== GROUNDLINK =====
npm run dev
# Settings → Rotator → Host: 192.168.0.117, Port: 24448 → Connect

# ===== TROUBLESHOOTING =====
# Port 24449 already in use:
lsof -i :24449                                  # find process
kill $(lsof -t -i :24449)                       # kill it

# Data garbled on serial? → RS485 A/B wires are swapped. Swap them.
# No data at all? → Check B wire is connected (both A and B required).
# screen/python can't open serial? → close any other program using the port:
lsof | grep usbserial
```

### Configuring for a New WiFi Network (Step-by-Step)

1. **Connect to the adapter** — either via its AP (WiFi list) or via its current STA IP if on the same network
2. **Open web interface** — `http://<adapter_ip>/home.html` (login: `admin` / `admin`)
3. **Set new WiFi SSID and password via curl** (safer than web form for special characters):
   ```bash
   # Replace NEW_SSID and NEW_PASSWORD (encode & as %26, # as %23, etc.)
   curl -u admin:admin -X POST "http://<adapter_ip>/EN/do_cmd_fast.html" \
     -d "SET0=81723904=NEW_SSID"
   curl -u admin:admin -X POST "http://<adapter_ip>/EN/do_cmd_fast.html" \
     -d "SET0=304087552=NEW_PASSWORD"
   curl -u admin:admin -X POST "http://<adapter_ip>/EN/do_cmd_fast.html" \
     -d "SET0=18088192=2"
   curl -u admin:admin -X POST "http://<adapter_ip>/EN/do_cmd_fast.html" \
     -d "SET0=81002752=1"
   ```
4. **Reboot**: `curl -u admin:admin http://<adapter_ip>/reboot.html`
5. **Connect Mac to the new WiFi network**
6. **Find adapter IP**: `arp -a | grep -i d4:ad`
7. **Test**: `echo "TEST" | nc -u -w1 <new_ip> 24448`
8. **GroundLink**: Settings → Rotator → Host: `<new_ip>`, Port: `24448` → Connect

### URL Encoding for Special Characters in Passwords

| Character | URL Encode |
|---|---|
| `&` | `%26` |
| `#` | `%23` |
| `!` | `%21` |
| `$` | `%24` |
| `@` | `%40` |
| `+` | `%2B` |
| `=` | `%3D` |
| ` ` (space) | `%20` |

### Key Lesson: RS485 Polarity

If serial data is garbled but byte count is correct, A and B wires are swapped:
- Adapter **A** must connect to USB-485 **A** (D+)
- Adapter **B** must connect to USB-485 **B** (D-)
- Some manufacturers label them differently — if garbled, just swap the two wires

### Critical Finding: RS485 A/B Cannot Connect Directly to Arduino TTL TX/RX

**Problem discovered**: Connecting the adapter's RS485 A/B terminals directly to the Arduino Pro Micro's TX/RX pins does NOT work. The GroundLink commands were reaching the adapter (confirmed via tcpdump), but the telemetry coming back was garbled (`0x00`/`0xE0` bytes at 57600, all `0x00` at 9600/115200).

**Root cause**: The adapter's RS485 A/B terminals output **RS485 differential signals** (from the internal MAX485 chip), but the Arduino Pro Micro expects **TTL-level serial** (0V / 3.3V or 5V). These are completely incompatible electrical standards.

### Waveshare RS232/485 TO WIFI ETH (B) — Internal Architecture

```
WiFi/ETH SoC (USR IOT chip)
        │
    TTL UART (internal, not exposed)
        │
        ├──── MAX485 transceiver ──── RS485 A / B / G  (terminal block)
        │
        └──── SP3232 transceiver ──── RS232 DB9 connector (male)
```

**Key facts:**
- RS232 and RS485 share the **same internal UART** — use one OR the other, NOT both simultaneously
- The internal TTL UART between the SoC and the transceivers is **not exposed** on any header/pad
- The MAX485 transceiver is built-in — it handles RS485↔TTL conversion internally
- Manufacturer: USR IOT (Jinan USR IOT Technology Limited), rebranded by Waveshare
- MAC prefix: `d4:ad:20` = USR IOT
- Default baud: 57600
- Web auth: `admin` / `admin`

**Sources:**
- https://www.waveshare.com/wiki/RS232/485_TO_WIFI_ETH_(B)
- https://files.waveshare.com/upload/9/9a/RS232-485-TO-WIFI-ETH-User-Manual-EN.pdf
- https://www.waveshare.com/rs232-485-to-wifi-eth-b.htm

### Options to Connect Arduino Pro Micro

**Option A: Use RS485 with external MAX485 module on Arduino side (~$1-2)**
```
Waveshare adapter           MAX485 module            Pro Micro
RS485 A ──────────── A      DI ◄──────────────── TX (pin 1)
RS485 B ──────────── B      RO ────────────────► RX (pin 0)
                             DE/RE ──── VCC       GND ── GND
                             VCC ────── 5V
                             GND ────── GND
```

**Option B: Use RS232 with MAX3232 breakout on Arduino side (~$2)**
```
Waveshare DB9              MAX3232 breakout          Pro Micro
RS232 TX (pin 3) ─── IN    TTL OUT ──────────────► RX (pin 0)
RS232 RX (pin 2) ─── OUT   TTL IN ◄──────────────── TX (pin 1)
GND (pin 5) ──────── GND ──────────────────────── GND
```

**Option C: Use a different Waveshare adapter that has TTL UART**
The WIFI232-B2 (from Sessions 1-3) has direct TTL UART pins (TX/RX/GND) — no transceiver needed. But it's the older module without RS485/Ethernet.

### What Was Tested (tcpdump results)

1. **GroundLink → Adapter (UDP)**: Working perfectly
   ```
   T:101;R:102;X:1918;Y:45;CH:101102191845;   (clean ASCII)
   T:101;R:102;X:1674;Y:45;CH:101102167445;   (azimuth changes visible)
   ```

2. **Adapter → GroundLink (RS485 from Arduino)**: Garbled
   - At 57600 baud: 127-129 bytes of `0x00`/`0xE0` pattern
   - At 115200 baud: 127-129 bytes of mostly `0x00`
   - At 9600 baud: 127-129 bytes of all `0x00`
   - Consistent ~1 packet/second regardless of baud = Arduino IS sending, but signal is incompatible

3. **With A/B swapped** (wrong polarity for adapter→USB-485, but matches Arduino perspective):
   - GroundLink commands still sent, but NO telemetry received at all
   - Confirms the telemetry source is the Arduino

### Current Baud Rate Status

The adapter baud rate was changed during debugging. Current value needs verification:
```bash
curl -u admin:admin "http://192.168.0.117/EN/app_config.html" 2>/dev/null | grep "uart_baudrate"
```
To reset to 57600: `curl -u admin:admin -X POST "http://192.168.0.117/EN/do_cmd_fast.html" -d "SET0=285344000=15"`

### Next Steps

1. **Get a MAX485 module** (or MAX3232 for RS232 path) to properly interface the Arduino Pro Micro with the Waveshare adapter
2. **Determine the Pro Micro's baud rate** — check the sketch for `Serial1.begin(xxxxx)`. Previous sessions used 115200 with the WIFI232-B2
3. **Match the adapter baud rate** to the Arduino's baud rate
4. Once hardware is correct, test full E2E: GroundLink ↔ UDP ↔ Waveshare adapter ↔ RS485/RS232 ↔ Arduino

---

## Session 3 — 2026-03-01/02

### What Was Accomplished

1. **New hardware connected**: FTDI USB-UART adapter (`/dev/cu.usbserial-A5069RR4`) connected directly to WIFI232-B2 UART pins (no Pro Micro needed).

2. **WiFi reconfigured to Borsch**: Module was on a different WiFi (192.168.0.x). Reconfigured via web interface at `10.10.100.254` (connect to `Waveshare_5F94` AP first). Module now on Borsch at `192.168.3.72`.

3. **Bidirectional UDP/UART confirmed**:
   - UDP→UART: GroundLink sends to `192.168.3.72:24448` → appears on serial port
   - UART→UDP: Write to serial → module sends UDP to last known client (must send from port 24449 first)

4. **Frame format fixed**: `\n` → `\r\n` (staircase fix for serial terminals)

5. **Protocol matched to Pascal** (github.com/SkopasGit/rotation):
   - Azimuth: 0-164 stays, 165-195 dead zone, 196-359 subtract 360 → range -164..+164
   - PWM: 540-2400 mapped from -164..+164
   - Elevation: CMD = round(deg + 10), range 0-95
   - Checksum: raw string concatenation
   - Telemetry format: `T:102;R:101;COM:<deg>;V:<voltage>;CH:<concat>;\r\n`

6. **E2E controller** (`scripts/rotator-controller.js`): MCU emulator on Mac, reads commands from UART, sends telemetry back. Full cycle verified with GroundLink.

### Code Changes

| File | Change |
|---|---|
| `src/services/rotator/frame-builder.ts` | `\n`→`\r\n`; azimuth conversion matches Pascal exactly |
| `src/services/rotator/telemetry-parser.ts` | Checksum = raw string concat (Pascal style) |
| `scripts/rotator-simulator.js` | Rewritten to match Pascal protocol |
| `scripts/rotator-controller.js` | New — E2E MCU emulator via UART/WIFI232-B2 |

### Hardware Setup

```
Mac USB ←→ FTDI (A5069RR4) ←→ WIFI232-B2 UART ←→ WiFi/UDP ←→ GroundLink:24449
            /dev/cu.usbserial-      192.168.3.72:24448
            A5069RR4 @ 115200       AP: Waveshare_5F94
```

### Protocol Reference

**Command (GroundLink → Rotator):**
```
T:101;R:102;X:<PWM>;Y:<CMD>;CH:<T><R><X><Y>;\r\n
```

**Telemetry (Rotator → GroundLink):**
```
T:102;R:101;COM:<degrees>;V:<voltage>;CH:<T><R><COM><V>;\r\n
```

**Azimuth mapping:**

| UI | Protocol | PWM |
|---|---|---|
| 0° | 0 | 1470 |
| 164° | +164 | 2400 |
| 165-195° | DEAD ZONE | — |
| 196° | -164 | 540 |
| 359° | -1 | 1464 |

### Quick Reference

```bash
# --- SERIAL ---
screen /dev/cu.usbserial-A5069RR4 115200     # open serial monitor
screen -ls                                     # list sessions
screen -S <id> -X quit                         # kill session (e.g. 60041.ttys000.MacBook-Pro-3)
# Exit screen: Ctrl+A, K, Y

# --- NETWORK ---
arp -a | grep -i d4:ad                         # find module by MAC
ping 192.168.3.72                              # ping module
echo "TEST" | nc -u -w1 192.168.3.72 24448    # send test UDP
sudo tcpdump -i en0 udp port 24448 -X          # watch traffic

# --- WIFI CONFIG (web interface) ---
# 1. Connect Mac WiFi to "Waveshare_5F94"
# 2. http://10.10.100.254/EN/sta_set.html (STA/WiFi settings)
# 3. http://10.10.100.254/EN/net_set.html (network/UDP settings)

# --- AT COMMANDS (when connected via MCU bridge or direct serial) ---
+++                                             # enter AT mode (wait 2s, no Enter)
AT                                              # test
AT+WMODE=STA                                    # WiFi station mode
AT+WSSSID=Borsch                                # set WiFi SSID
AT+WSKEY=WPA2PSK,AES,18121996d                  # set WiFi password
AT+NETP=UDP,SERVER,24448,0.0.0.0                # UDP server on port 24448
AT+UART=115200,8,1,NONE,NFC                     # UART 115200/8N1
AT+WANN=DHCP                                    # use DHCP
AT+WANN=STATIC,192.168.3.200,255.255.255.0,192.168.3.1  # or static IP
AT+Z                                            # save & reboot
AT+RELD                                         # factory reset
AT+WSSSID                                       # query current SSID
AT+NETP                                         # query network config
AT+WANN                                         # query IP config

# --- E2E TESTING ---
# Terminal 1: MCU emulator (reads UART, sends telemetry back)
node scripts/rotator-controller.js

# Terminal 2: GroundLink app
npm run dev
# Settings → Rotator → Host: 192.168.3.72, Port: 24448 → Connect

# OR localhost simulator (no hardware):
node scripts/rotator-simulator.js
# Host: 127.0.0.1, Port: 24448
```

### Module Configuration (current)

| Setting | Value |
|---|---|
| WiFi Mode | AP+STA |
| STA SSID | `Borsch` |
| STA Password | `18121996d` |
| Network | UDP Server, port 24448 |
| UART | 115200 / 8N1 / Transparent |
| STA IP | `192.168.3.72` (DHCP) |
| STA MAC | `d4:ad:20:b4:5f:95` |
| AP SSID | `Waveshare_5F94` |
| AP IP | `10.10.100.254` |
| Serial Port | `/dev/cu.usbserial-A5069RR4` |

---

## Session 2 — 2026-02-24

### What Was Accomplished

1. **WiFi module now connects to router successfully**
   - Router renamed from "Борщ" (Cyrillic) to "Borsch" (ASCII) — Cyrillic SSID was corrupted by module's GB2312 web charset
   - Module confirmed on network: `192.168.3.72` / MAC `d4:ad:20:b4:5f:95`
   - Ping works, UDP packets to port 24448 confirmed received via tcpdump

2. **Web interface reverse-engineered**
   - Config POST format: `SET0=<decimal_cfg_id>=<value>` to `EN/do_cmd_fast.html`
   - Key config IDs (decimal):
     - `sys_opmode`: 18088192 (1=AP, 2=AP+STA, 3=STA-only)
     - `apcli_enable`: 81002752 (0=AP, 1=STA client on)
     - `ssid_name`: 81723904
     - `ssid_name3`: 304087552
     - `net_port`: 286064896
     - `net_protocol`: 285934080
   - All settings pages live under `/EN/` subdirectory

3. **UDP delivery to adapter proven via tcpdump**
   ```
   192.168.3.69.51060 > 192.168.3.72.24448: UDP, length 8
   payload: TEST123
   ```

### Current Module Configuration

| Setting | Value |
|---|---|
| WiFi Mode | AP+STA (`sys_opmode=2`) |
| STA SSID | `Borsch` |
| STA Password | `18121996d` |
| Security | WPA2PSK / AES |
| Network Protocol | UDP |
| Network Mode | Server |
| Network Port | 24448 |
| Server Address | 0.0.0.0 (accept any) |
| UART | 115200 / 8N1 / Transparent Mode |
| Module STA IP (DHCP) | `192.168.3.72` |
| Module STA MAC | `d4:ad:20:b4:5f:95` |
| Module AP MAC | `d4:ad:20:b4:5f:96` |
| Module AP IP | `10.10.100.254` |
| Module AP SSID | `Waveshare_5F94` |

### What Still Doesn't Work

**UART wiring between Pro Micro and WiFi module is wrong.**

Bridge sketch shows `from_uart:0` — zero bytes received from module. The physical wires were incorrectly connected:
- GND was going to RXD (wrong)
- TXD was going to TX (wrong — should go to RX)

### Next Steps (in order)

#### 1. Fix UART wiring (REQUIRED)

```
WiFi Module          Pro Micro
-----------          ---------
   TXD     ───────→  pin 0 (RX)
   RXD     ←───────  pin 1 (TX)
   GND     ────────  GND
```

#### 2. Test UART bridge

Terminal 1 — listen on Pro Micro serial:
```bash
/usr/bin/python3 -c "
import serial, time
s = serial.Serial('/dev/cu.usbmodem2101', 115200, timeout=1)
time.sleep(2)
print('Listening...')
while True:
    d = s.read(100)
    if d: print('GOT:', d)
"
```

Terminal 2 — send UDP to module:
```bash
echo "HELLO" | nc -u -w1 192.168.3.72 24448
```

If `HELLO` appears in Terminal 1, the full chain works:
**Mac → UDP → WiFi module → UART → Pro Micro → USB → Mac**

#### 3. Test from GroundLink app

```bash
npm run dev
```
Go to Settings → Rotator, enter:
- IP: `192.168.3.72`
- Port: `24448`

#### 4. Set static IP (optional, recommended)

Connect to `Waveshare_5F94` AP and run:
```bash
python3 /tmp/wifi_set_ssid.py  # or use web interface
```
Set `SWANIP` to a static address (e.g., `192.168.3.200`) so the IP doesn't change with DHCP.

#### 5. Consider pure STA mode

Current mode is AP+STA (`sys_opmode=2`). To disable AP and save power:
```bash
# Connect to Waveshare_5F94 and run:
python3 /tmp/wifi_fix_config.py  # sets sys_opmode=3
```
**Warning**: In pure STA mode, if the module can't find the router, it becomes unreachable (no AP fallback). Only do this after everything else works.

### Scripts Created

| File | Purpose |
|---|---|
| `/tmp/wifi_set_ssid.py` | Set module STA SSID (ASCII) and reboot |
| `/tmp/wifi_fix_config.py` | Set sys_opmode/SSID/network via web POST |
| `/tmp/wifi_diagnose.py` | Download all web pages and show status |
| `/tmp/wifi_web_config.py` | Full web interface explorer |
| `/tmp/wifi_bridge_test_v2.py` | Test Pro Micro UART bridge + AT mode |
| `/tmp/wifi_at_config.py` | AT commands via Pro Micro serial bridge |
| `/tmp/uart_bridge_test/` | Arduino bridge sketch (Serial↔Serial1) |

### Quick Reference

```bash
# Check module on network
arp -a | grep -i d4:ad

# Ping module
ping 192.168.3.72

# Send UDP test
echo "TEST" | nc -u -w1 192.168.3.72 24448

# Watch UDP traffic
sudo tcpdump -i en0 udp port 24448 -X

# Listen on Pro Micro serial
/usr/bin/python3 -c "import serial,time;s=serial.Serial('/dev/cu.usbmodem2101',115200,timeout=1);time.sleep(2);
while True:
 d=s.read(100)
 if d:print('GOT:',d)"

# Module web interface (connect to Waveshare_5F94 first)
open http://10.10.100.254/home.html
```

---

## Session 1 — 2026-02-23

### What Was Proven

1. **AP Mode UDP→UART bridge works**: `echo "HELLO_TEST" | nc -u -w2 10.10.100.254 24448` → text appeared in Pro Micro serial monitor
2. **Module connects to Борщ WiFi**: appeared at `192.168.3.45`
3. **Pro Micro bridge sketch works**: Serial↔Serial1 forwarding confirmed
4. **Problem identified**: AP+STA dual mode breaks UDP→UART routing on the STA interface

### Root Causes Found (Session 2)

1. **Cyrillic SSID "Борщ" corrupted by GB2312 charset** — stored as garbled bytes, module couldn't find the network
2. **`sys_opmode=2` means AP+STA**, not pure STA — the web interface "STA Mode" dropdown is misleading
3. **UART wires physically wrong** — GND to RXD, TXD to TX instead of TXD→RX crossover
