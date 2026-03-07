# Rotator Control System Integration Plan

> **Project**: GroundLink (Megapolis Ground)
> **Version**: 1.0
> **Date**: February 2025
> **Status**: Planning Phase

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Hardware Requirements](#3-hardware-requirements)
4. [Layer 1: Physical Hardware Setup](#4-layer-1-physical-hardware-setup)
5. [Layer 2: Embedded Controller (Microcontroller)](#5-layer-2-embedded-controller-microcontroller)
6. [Layer 3: WIFI232-B2 Configuration](#6-layer-3-wifi232-b2-configuration)
7. [Layer 4: Network Configuration](#7-layer-4-network-configuration)
8. [Layer 5: Software Integration](#8-layer-5-software-integration)
9. [Communication Protocol](#9-communication-protocol)
10. [Implementation Checklist](#10-implementation-checklist)
11. [Troubleshooting](#11-troubleshooting)
12. [References](#12-references)

---

## 1. Executive Summary

This document describes the complete integration plan for a remote-controlled antenna rotator system into the GroundLink ground station application. The system allows operators to remotely control antenna azimuth and elevation over a Starlink WiFi connection.

### System Components

| Component | Purpose | Status |
|-----------|---------|--------|
| Physical Rotator | Mechanical rotation mechanism | Required |
| Microcontroller | Motor control & protocol handling | Required |
| WIFI232-B2 | UART-to-WiFi bridge | Required |
| Starlink | Network connectivity | Required |
| GroundLink App | User interface & control | To be implemented |

### High-Level Data Flow

```
[GroundLink PC] ──UDP──> [Starlink] ──WiFi──> [WIFI232-B2] ──UART──> [MCU] ──PWM──> [Motors]
                                                                        │
[GroundLink PC] <──UDP── [Starlink] <──WiFi── [WIFI232-B2] <──UART── [MCU] <──ADC── [Sensors]
```

---

## 2. System Architecture Overview

### Complete System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                 FIELD SITE                                      │
│                                                                                 │
│   ┌──────────────────────────────────────────────────────────────────────────┐  │
│   │                          ROTATOR ASSEMBLY                                │  │
│   │                                                                          │  │
│   │  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐  │  │
│   │  │ Directional │   │   Azimuth   │   │  Elevation  │   │   Power     │  │  │
│   │  │   Antenna   │   │    Motor    │   │    Motor    │   │   Supply    │  │  │
│   │  └─────────────┘   └──────┬──────┘   └──────┬──────┘   │   12-24V    │  │  │
│   │                           │                  │          └──────┬──────┘  │  │
│   │                    ┌──────▼──────────────────▼──────┐          │         │  │
│   │                    │        MOTOR DRIVER            │◄─────────┘         │  │
│   │                    │     (L298N / BTS7960)          │                    │  │
│   │                    └──────────────┬─────────────────┘                    │  │
│   │                                   │ PWM                                  │  │
│   │                    ┌──────────────▼─────────────────┐                    │  │
│   │                    │       MICROCONTROLLER          │                    │  │
│   │                    │    (Arduino/STM32/ESP32)       │                    │  │
│   │                    │                                │◄── Encoder/Pot     │  │
│   │                    │  - Protocol Parser             │◄── Voltage Sense   │  │
│   │                    │  - PID Motor Control           │                    │  │
│   │                    │  - Telemetry Generator         │                    │  │
│   │                    └──────────────┬─────────────────┘                    │  │
│   │                                   │ UART (TX/RX)                         │  │
│   │                    ┌──────────────▼─────────────────┐                    │  │
│   │                    │         WIFI232-B2             │                    │  │
│   │                    │      (UART-WiFi Bridge)        │                    │  │
│   │                    │                                │                    │  │
│   │                    │  Mode: Station (STA)           │                    │  │
│   │                    │  Protocol: UDP Server          │                    │  │
│   │                    │  Port: 24448                   │                    │  │
│   │                    └──────────────┬─────────────────┘                    │  │
│   │                                   │ WiFi                                 │  │
│   └───────────────────────────────────┼──────────────────────────────────────┘  │
│                                       │                                         │
│                        ┌──────────────▼─────────────────┐                       │
│                        │       STARLINK ROUTER          │                       │
│                        │       192.168.1.1              │                       │
│                        └──────────────┬─────────────────┘                       │
│                                       │                                         │
└───────────────────────────────────────┼─────────────────────────────────────────┘
                                        │ Internet / VPN
                                        │
┌───────────────────────────────────────┼─────────────────────────────────────────┐
│                                       │           OPERATOR LOCATION             │
│                        ┌──────────────▼─────────────────┐                       │
│                        │      GROUND STATION PC         │                       │
│                        │                                │                       │
│                        │   ┌────────────────────────┐   │                       │
│                        │   │   GroundLink App       │   │                       │
│                        │   │   (Electron + Vue)     │   │                       │
│                        │   │                        │   │                       │
│                        │   │   - Rotator Control    │   │                       │
│                        │   │   - Compass Display    │   │                       │
│                        │   │   - Telemetry View     │   │                       │
│                        │   └────────────────────────┘   │                       │
│                        └────────────────────────────────┘                       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Hardware Requirements

### Bill of Materials

| # | Component | Specification | Quantity | Notes |
|---|-----------|--------------|----------|-------|
| 1 | WIFI232-B2 | Waveshare UART-WiFi module | 1 | Main communication bridge |
| 2 | Microcontroller | Arduino Mega / STM32 / ESP32 | 1 | Protocol & motor control |
| 3 | Motor Driver | L298N / BTS7960 / similar | 1-2 | Depends on motor type |
| 4 | Azimuth Motor | DC/Stepper/Servo | 1 | Based on rotator design |
| 5 | Elevation Motor | DC/Stepper/Servo | 1 | Based on rotator design |
| 6 | Position Sensors | Encoder / Potentiometer | 2 | Azimuth + Elevation feedback |
| 7 | Power Supply | 12V-24V, 5A+ | 1 | For motors |
| 8 | Power Supply | 5V, 1A | 1 | For MCU + WIFI232 |
| 9 | Voltage Divider | Resistors | 1 | Battery voltage monitoring |
| 10 | Enclosure | Weatherproof box | 1 | Outdoor protection |

### Wiring Diagram

```
                                    +12-24V
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
               ┌────▼────┐        ┌────▼────┐       ┌────▼────┐
               │  Motor  │        │  Motor  │       │Voltage  │
               │ Driver  │        │ Driver  │       │Regulator│
               │  (AZ)   │        │  (EL)   │       │ 12V→5V  │
               └────┬────┘        └────┬────┘       └────┬────┘
                    │                  │                  │
          ┌─────────┼──────────────────┼──────────────────┼─────────┐
          │         │                  │                  │         │
          │    ┌────▼────┐        ┌────▼────┐        ┌────▼────┐   │
          │    │ Azimuth │        │Elevation│        │   +5V   │   │
          │    │  Motor  │        │  Motor  │        │  Power  │   │
          │    └────┬────┘        └────┬────┘        └────┬────┘   │
          │         │                  │                  │         │
          │    ┌────▼────┐        ┌────▼────┐             │         │
          │    │ Encoder │        │ Encoder │             │         │
          │    │  (AZ)   │        │  (EL)   │             │         │
          │    └────┬────┘        └────┬────┘             │         │
          │         │                  │                  │         │
          │    ┌────┴──────────────────┴──────────────────┘         │
          │    │                                                    │
          │    │              MICROCONTROLLER                       │
          │    │         ┌─────────────────────────┐                │
          │    │         │                         │                │
          │    └────────►│ A0 ◄── AZ Encoder       │                │
          │              │ A1 ◄── EL Encoder       │                │
          │              │ A2 ◄── Battery Voltage  │                │
          │              │                         │                │
          │              │ D9  ──► AZ Motor PWM    │────────────────┘
          │              │ D10 ──► EL Motor PWM    │       (to Motor Drivers)
          │              │ D8  ──► AZ Direction    │
          │              │ D11 ──► EL Direction    │
          │              │                         │
          │              │ TX1 ──► WIFI232-B2 RX   │
          │              │ RX1 ◄── WIFI232-B2 TX   │
          │              │                         │
          │              │ GND ─── WIFI232-B2 GND  │
          │              │ 5V  ─── WIFI232-B2 VCC  │
          │              └─────────────────────────┘
          │                          │
          │              ┌───────────▼───────────┐
          │              │      WIFI232-B2       │
          │              │                       │
          │              │  VCC ◄── 3.3V/5V      │
          │              │  GND ◄── GND          │
          │              │  TX  ──► MCU RX       │
          │              │  RX  ◄── MCU TX       │
          │              │                       │
          │              │  [Antenna Connector]  │
          │              └───────────────────────┘
          │
          └─────────────────── GND ───────────────────────────────
```

---

## 4. Layer 1: Physical Hardware Setup

### 4.1 Rotator Mechanical Assembly

The rotator must provide:
- **Azimuth rotation**: 360° (or limited range with dead zone)
- **Elevation rotation**: 0° to 90° (horizon to zenith)
- **Mounting**: Secure antenna attachment
- **Weatherproofing**: Outdoor operation capability

### 4.2 Motor Selection

| Parameter | Azimuth Motor | Elevation Motor |
|-----------|--------------|-----------------|
| Type | DC with gearbox / Stepper | DC with gearbox / Stepper |
| Torque | Based on antenna weight | Based on antenna weight |
| Speed | 5-10 RPM recommended | 5-10 RPM recommended |
| Voltage | 12V or 24V | 12V or 24V |

### 4.3 Position Feedback

**Option A: Potentiometers**
- Simple, analog output
- Limited rotation (270° typical)
- Low cost

**Option B: Encoders**
- Digital, higher precision
- Unlimited rotation (incremental) or absolute
- Higher cost

### 4.4 Dead Zone Handling

Based on the protocol, there is a **dead zone** where the rotator cannot point:
- **Dead Zone**: 164° to 196° (azimuth)
- Software must prevent commands in this range
- Hardware may have physical stops

---

## 5. Layer 2: Embedded Controller (Microcontroller)

### 5.1 Firmware Requirements

The microcontroller firmware must:

1. **Parse incoming commands** via UART
2. **Control motors** using PID or simple proportional control
3. **Read position sensors** (encoders/potentiometers)
4. **Send telemetry** back via UART
5. **Handle safety limits** (end stops, dead zones)

### 5.2 Communication Protocol

#### Command Frame (Received from PC)

```
T:<transmitter_id>;R:<receiver_id>;X:<pwm_value>;Y:<elevation_cmd>;CH:<checksum>;
```

| Field | Description | Range | Example |
|-------|-------------|-------|---------|
| T | Transmitter ID | Integer | 101 |
| R | Receiver ID | Integer | 102 |
| X | Azimuth PWM | 540-2400 | 1470 |
| Y | Elevation command | 0-95 | 45 |
| CH | Checksum | String | "10110214745" |

**Checksum calculation**: Concatenate T + R + X + Y as strings

**Example command**: `T:101;R:102;X:1470;Y:45;CH:101102147045;`

#### Telemetry Frame (Sent to PC)

```
T:<transmitter_id>
R:<receiver_id>
COM:<compass_degrees>
V:<voltage>
CH:<checksum>
```

| Field | Description | Range | Example |
|-------|-------------|-------|---------|
| T | Transmitter ID | Integer | 101 |
| R | Receiver ID | Integer | 102 |
| COM | Current azimuth | Degrees | 45 |
| V | Battery voltage | Volts | 12.3 |
| CH | Checksum | String | "10110245123" |

**Example telemetry**:
```
T:101
R:102
COM:45
V:12.3
CH:10110245123
```

### 5.3 Value Mappings

#### Azimuth Mapping

| UI Degrees | Protocol Degrees | PWM Value |
|-----------|-----------------|-----------|
| 0° | 0° | 1470 (center) |
| 90° | 90° | 2010 |
| 164° | 164° | 2400 (max) |
| 196° | -164° | 540 (min) |
| 270° | -90° | 930 |
| 359° | -1° | 1464 |

**Formula**:
```
// UI (0-359) to Protocol (-164 to +164)
protocolDeg = uiDeg > 180 ? uiDeg - 360 : uiDeg
if (protocolDeg < -164 || protocolDeg > 164) → DEAD ZONE

// Protocol to PWM
pwm = map(protocolDeg, -164, 164, 540, 2400)
```

#### Elevation Mapping

| UI Degrees | Protocol Degrees | Command Value |
|-----------|-----------------|---------------|
| 0° | -10° | 0 |
| 10° | 0° | 10 |
| 45° | 35° | 45 |
| 90° | 80° | 90 |

**Formula**:
```
// UI to Protocol
protocolDeg = uiDeg - 10

// Protocol to Command
cmd = protocolDeg + 10  // (same as uiDeg for 0-90 range)
```

### 5.4 Sample Arduino Firmware

```cpp
// ============================================================
// ROTATOR CONTROLLER FIRMWARE
// For Arduino Mega / STM32 / ESP32
// ============================================================

#include <Arduino.h>

// Pin Definitions
#define AZ_MOTOR_PWM    9
#define AZ_MOTOR_DIR    8
#define EL_MOTOR_PWM    10
#define EL_MOTOR_DIR    11
#define AZ_ENCODER_PIN  A0
#define EL_ENCODER_PIN  A1
#define VOLTAGE_PIN     A2

// Protocol Constants
#define TRANSMITTER_ID  101
#define RECEIVER_ID     102
#define PWM_MIN         540
#define PWM_MAX         2400
#define PWM_CENTER      1470

// Global Variables
String inputBuffer = "";
int targetAzimuthPWM = PWM_CENTER;
int targetElevationCmd = 45;
unsigned long lastTelemetryTime = 0;
const unsigned long TELEMETRY_INTERVAL = 200; // ms

void setup() {
  // Initialize Serial for WIFI232-B2 communication
  Serial1.begin(115200);  // Hardware UART to WIFI232
  Serial.begin(115200);   // Debug USB

  // Initialize motor pins
  pinMode(AZ_MOTOR_PWM, OUTPUT);
  pinMode(AZ_MOTOR_DIR, OUTPUT);
  pinMode(EL_MOTOR_PWM, OUTPUT);
  pinMode(EL_MOTOR_DIR, OUTPUT);

  Serial.println("Rotator Controller Started");
}

void loop() {
  // Read incoming commands
  while (Serial1.available()) {
    char c = Serial1.read();
    if (c == '\n' || c == ';') {
      if (inputBuffer.length() > 0) {
        parseCommand(inputBuffer);
        inputBuffer = "";
      }
    } else {
      inputBuffer += c;
    }
  }

  // Update motor control
  updateMotors();

  // Send telemetry periodically
  if (millis() - lastTelemetryTime >= TELEMETRY_INTERVAL) {
    sendTelemetry();
    lastTelemetryTime = millis();
  }
}

void parseCommand(String cmd) {
  // Parse: T:101;R:102;X:1470;Y:45;CH:xxx

  int tPos = cmd.indexOf("T:");
  int rPos = cmd.indexOf("R:");
  int xPos = cmd.indexOf("X:");
  int yPos = cmd.indexOf("Y:");

  if (xPos != -1) {
    int xEnd = cmd.indexOf(';', xPos);
    if (xEnd == -1) xEnd = cmd.length();
    targetAzimuthPWM = cmd.substring(xPos + 2, xEnd).toInt();
    targetAzimuthPWM = constrain(targetAzimuthPWM, PWM_MIN, PWM_MAX);
  }

  if (yPos != -1) {
    int yEnd = cmd.indexOf(';', yPos);
    if (yEnd == -1) yEnd = cmd.length();
    targetElevationCmd = cmd.substring(yPos + 2, yEnd).toInt();
    targetElevationCmd = constrain(targetElevationCmd, 0, 95);
  }

  Serial.print("Target AZ PWM: "); Serial.print(targetAzimuthPWM);
  Serial.print(" EL Cmd: "); Serial.println(targetElevationCmd);
}

void updateMotors() {
  // Read current positions
  int currentAzRaw = analogRead(AZ_ENCODER_PIN);
  int currentElRaw = analogRead(EL_ENCODER_PIN);

  // Map encoder readings to PWM range (adjust based on your encoder)
  int currentAzPWM = map(currentAzRaw, 0, 1023, PWM_MIN, PWM_MAX);
  int currentElCmd = map(currentElRaw, 0, 1023, 0, 95);

  // Simple proportional control for azimuth
  int azError = targetAzimuthPWM - currentAzPWM;
  int azSpeed = constrain(abs(azError) / 4, 0, 255);

  if (abs(azError) > 10) {
    digitalWrite(AZ_MOTOR_DIR, azError > 0 ? HIGH : LOW);
    analogWrite(AZ_MOTOR_PWM, azSpeed);
  } else {
    analogWrite(AZ_MOTOR_PWM, 0);
  }

  // Simple proportional control for elevation
  int elError = targetElevationCmd - currentElCmd;
  int elSpeed = constrain(abs(elError) * 3, 0, 255);

  if (abs(elError) > 2) {
    digitalWrite(EL_MOTOR_DIR, elError > 0 ? HIGH : LOW);
    analogWrite(EL_MOTOR_PWM, elSpeed);
  } else {
    analogWrite(EL_MOTOR_PWM, 0);
  }
}

void sendTelemetry() {
  // Read sensors
  int azRaw = analogRead(AZ_ENCODER_PIN);
  int voltageRaw = analogRead(VOLTAGE_PIN);

  // Convert to degrees (adjust mapping based on your setup)
  int compassDeg = map(azRaw, 0, 1023, 0, 359);
  float voltage = voltageRaw * (5.0 / 1023.0) * 4.0; // Assuming 4:1 voltage divider

  // Build checksum
  String checksum = String(TRANSMITTER_ID) + String(RECEIVER_ID) +
                    String(compassDeg) + String((int)(voltage * 10));

  // Send telemetry
  Serial1.print("T:"); Serial1.println(TRANSMITTER_ID);
  Serial1.print("R:"); Serial1.println(RECEIVER_ID);
  Serial1.print("COM:"); Serial1.println(compassDeg);
  Serial1.print("V:"); Serial1.println(voltage, 1);
  Serial1.print("CH:"); Serial1.println(checksum);
}
```

### 5.5 Flashing the Firmware

**For Arduino:**
1. Open Arduino IDE
2. Select correct board (Arduino Mega 2560)
3. Select correct COM port
4. Click Upload

**For STM32:**
1. Use STM32CubeIDE or PlatformIO
2. Configure UART1 for WIFI232 communication
3. Flash via ST-Link or USB DFU

**For ESP32:**
1. Use Arduino IDE with ESP32 board support
2. Or use PlatformIO
3. Flash via USB

---

## 6. Layer 3: WIFI232-B2 Configuration

### 6.1 Initial Connection

**Step 1: Power the module**
- Connect 3.3V (or 5V with onboard regulator) and GND
- Wait for boot (LED indicators)

**Step 2: Connect to module's AP**
- By default, WIFI232-B2 creates an Access Point
- SSID: Usually `WIFI232_xxxx` or similar
- Connect your PC to this WiFi network

**Step 3: Access web interface**
- Open browser: `http://10.10.100.254`
- Or use Waveshare configuration tool

### 6.2 AT Command Configuration

Connect to the module via serial terminal (115200 baud, 8N1) or telnet and send the following commands:

#### 6.2.1 Enter Command Mode

```
+++
```
Wait 1 second, then send:
```
AT
```
Expected response: `+ok`

#### 6.2.2 Configure WiFi Station Mode

```
AT+WMODE=STA
```
Response: `+ok`

#### 6.2.3 Set Target WiFi Network (Starlink)

```
AT+WSSSID=YOUR_STARLINK_SSID
```
Response: `+ok`

```
AT+WSKEY=WPA2PSK,AES,YOUR_STARLINK_PASSWORD
```
Response: `+ok`

#### 6.2.4 Configure Network Protocol (UDP Server)

```
AT+NETP=UDP,SERVER,24448,0.0.0.0
```
Response: `+ok`

Parameters:
- `UDP` - Protocol type
- `SERVER` - Work mode
- `24448` - Port number
- `0.0.0.0` - Accept from any IP

#### 6.2.5 Configure UART Parameters

```
AT+UART=115200,8,1,NONE,NFC
```
Response: `+ok`

Parameters:
- `115200` - Baud rate
- `8` - Data bits
- `1` - Stop bits
- `NONE` - No parity
- `NFC` - No flow control

#### 6.2.6 Optional: Set Static IP (if needed)

```
AT+WANN=STATIC,192.168.1.100,255.255.255.0,192.168.1.1
```

Or use DHCP (default):
```
AT+WANN=DHCP
```

#### 6.2.7 Save and Restart

```
AT+Z
```

The module will restart and connect to Starlink WiFi.

### 6.3 Complete Configuration Script

Save this as a reference:

```bash
# WIFI232-B2 Configuration Script
# ================================
# Execute these commands via serial terminal at 115200 baud

+++                                          # Enter command mode (wait 1 sec)
AT                                           # Test connection
AT+WMODE=STA                                 # Station mode (connect to existing WiFi)
AT+WSSSID=Starlink_Network_Name              # Your Starlink SSID
AT+WSKEY=WPA2PSK,AES,YourStarlinkPassword    # WiFi security settings
AT+NETP=UDP,SERVER,24448,0.0.0.0             # UDP server on port 24448
AT+UART=115200,8,1,NONE,NFC                  # UART: 115200 baud, 8N1, no flow control
AT+WANN=DHCP                                 # Use DHCP for IP address
AT+Z                                         # Save and restart

# After restart, find the device IP:
# - Check your Starlink router's DHCP client list
# - Or use network scanner
# - Or configure static IP above
```

### 6.4 Verify Configuration

After restart:

1. **Check WiFi connection**: Module LED should indicate connected state
2. **Find IP address**: Check Starlink router DHCP leases
3. **Test UDP connection**: Use netcat or similar tool:
   ```bash
   # Send test command
   echo "T:101;R:102;X:1470;Y:45;CH:test;" | nc -u 192.168.1.100 24448
   ```

### 6.5 Troubleshooting WIFI232-B2

| Problem | Solution |
|---------|----------|
| Can't enter AT mode | Wait 3 seconds after `+++`, don't send anything |
| WiFi won't connect | Verify SSID/password, check Starlink is working |
| No UDP response | Check port number, firewall settings |
| Garbled data | Verify UART baud rate matches MCU |

---

## 7. Layer 4: Network Configuration

### 7.1 Starlink Router Setup

1. **Ensure WIFI232-B2 connects**: Check connected devices in Starlink app
2. **Note the IP address**: WIFI232-B2 will get DHCP address (e.g., 192.168.1.100)
3. **Optional - Reserve IP**: Set DHCP reservation for consistent addressing

### 7.2 Port Forwarding (if needed)

If operator is on different network (not same Starlink):

1. **Starlink router**: Forward UDP port 24448 to WIFI232-B2's IP
2. **Note**: Starlink may have CGNAT limitations - consider VPN instead

### 7.3 VPN Setup (Recommended)

For reliable remote access:

1. **Install VPN server** on a device at field site (or use Starlink's public IP if available)
2. **Connect operator PC** to VPN
3. **Access WIFI232-B2** via VPN tunnel using local IP

---

## 8. Layer 5: Software Integration

### 8.1 New Files to Create

```
src/
├── services/
│   └── rotator/
│       ├── index.ts                    # Barrel export
│       ├── types.ts                    # TypeScript interfaces
│       ├── frame-builder.ts            # Command frame builder
│       └── telemetry-parser.ts         # Telemetry parser
├── store/
│   └── rotator-store.ts                # Pinia store for state
├── components/
│   ├── atoms/
│   │   └── RotatorConnectionStatus.vue # Connection indicator
│   └── molecules/
│       └── settings/
│           └── RotatorSettings.vue     # Configuration panel

electron/
└── main/
    └── rotator_worker.ts               # UDP communication (Node.js)
```

### 8.2 Files to Modify

| File | Changes |
|------|---------|
| `electron/main/index.ts` | Initialize rotator worker |
| `src/store/index.ts` | Export rotator store |
| `src/components/molecules/AzimuthController.vue` | Add rotator mode |
| `src/components/atoms/AzimuthCompass.vue` | Add dead zone display |
| `src/components/pages/SettingsPage.vue` | Add rotator settings |

### 8.3 Implementation Priority

| Phase | Task | Description |
|-------|------|-------------|
| 1 | Types & Protocol | Create TypeScript types and protocol handlers |
| 2 | UDP Worker | Implement Electron main process UDP communication |
| 3 | Pinia Store | Create state management for rotator |
| 4 | UI Components | Build settings and status components |
| 5 | Integration | Connect to existing AzimuthController |
| 6 | Testing | Test with hardware |

---

## 9. Communication Protocol

### 9.1 Command Frame Structure

```typescript
interface RotatorCommand {
  transmitterId: number;  // T: 101
  receiverId: number;     // R: 102
  azimuthPWM: number;     // X: 540-2400
  elevationCmd: number;   // Y: 0-95
  checksum: string;       // CH: concatenation
}

// Serialized format:
// "T:101;R:102;X:1470;Y:45;CH:101102147045;\n"
```

### 9.2 Telemetry Frame Structure

```typescript
interface RotatorTelemetry {
  transmitterId: number;  // T: 101
  receiverId: number;     // R: 102
  compassDegrees: number; // COM: 0-359
  voltage: number;        // V: volts
  checksum: string;       // CH: concatenation
  checksumValid: boolean; // Verification result
}

// Received format (multi-line):
// T:101
// R:102
// COM:45
// V:12.3
// CH:10110245123
```

### 9.3 Coordinate Mappings

| UI Value | Protocol Value | Hardware Value |
|----------|----------------|----------------|
| Azimuth 0° | 0° | PWM 1470 |
| Azimuth 90° | 90° | PWM 2010 |
| Azimuth 164° | 164° | PWM 2400 |
| Azimuth 180° | DEAD ZONE | - |
| Azimuth 196° | -164° | PWM 540 |
| Azimuth 270° | -90° | PWM 930 |
| Elevation 0° | -10° | Cmd 0 |
| Elevation 45° | 35° | Cmd 45 |
| Elevation 90° | 80° | Cmd 90 |

---

## 10. Implementation Checklist

### Hardware Setup

- [ ] **Rotator assembly** mounted and operational
- [ ] **Motors** connected and tested manually
- [ ] **Position sensors** (encoders/pots) calibrated
- [ ] **Motor driver** wired and tested
- [ ] **Microcontroller** flashed with firmware
- [ ] **WIFI232-B2** configured and connected to Starlink
- [ ] **Power supply** stable and adequate
- [ ] **Weatherproofing** completed (if outdoor)

### Network Setup

- [ ] **WIFI232-B2** connected to Starlink WiFi
- [ ] **IP address** noted (DHCP or static)
- [ ] **UDP port 24448** accessible
- [ ] **VPN or direct connection** tested from operator location

### Software Setup

- [ ] **TypeScript types** created
- [ ] **Frame builder** implemented and tested
- [ ] **Telemetry parser** implemented and tested
- [ ] **UDP worker** in Electron main process
- [ ] **Pinia store** created
- [ ] **UI components** built
- [ ] **Integration** with AzimuthController
- [ ] **End-to-end testing** completed

---

## 11. Troubleshooting

### No Communication

| Symptom | Check | Solution |
|---------|-------|----------|
| PC can't reach WIFI232 | Ping test | Verify same network, check firewall |
| WIFI232 not on network | Starlink DHCP list | Reconfigure WiFi settings |
| Commands sent but no response | Serial monitor on MCU | Check UART wiring, baud rate |
| Telemetry garbled | Protocol format | Verify frame delimiters, encoding |

### Motor Issues

| Symptom | Check | Solution |
|---------|-------|----------|
| Motor doesn't move | Power supply | Check voltage, current capacity |
| Motor moves wrong direction | Wiring | Swap motor leads or DIR pin logic |
| Motor overshoots | PID tuning | Adjust control gains |
| Position inaccurate | Encoder | Calibrate sensor mapping |

### Connection Drops

| Symptom | Check | Solution |
|---------|-------|----------|
| Intermittent connection | WiFi signal | Improve antenna position |
| Timeout errors | Network latency | Increase timeout values |
| Reconnection fails | WIFI232 config | Check auto-reconnect settings |

---

## 12. References

### Hardware Documentation

- [WIFI232-B2 Product Page](https://www.waveshare.com/uart-wifi232-b2.htm)
- [WIFI232-B2 Wiki](https://www.waveshare.com/wiki/UART-WIFI232-B2)
- [WIFI232 User Manual (PDF)](https://www.waveshare.com/w/upload/7/73/WIFI232-UserManual.pdf)

### Protocol Reference

- [Original Pascal Implementation](https://github.com/SkopasGit/rotation)

### GroundLink Documentation

- [API Refactoring Guide](../API_REFACTORING.md)
- [Project README](../../README.md)

---

## Appendix A: Quick Reference Card

### AT Commands Summary

```
+++                                    # Enter AT mode
AT+WMODE=STA                          # Station mode
AT+WSSSID=<ssid>                      # Set WiFi SSID
AT+WSKEY=WPA2PSK,AES,<password>       # Set WiFi password
AT+NETP=UDP,SERVER,24448,0.0.0.0      # UDP server mode
AT+UART=115200,8,1,NONE,NFC           # UART settings
AT+Z                                  # Save & restart
```

### Protocol Summary

**TX (PC → Rotator):**
```
T:101;R:102;X:1470;Y:45;CH:101102147045;
```

**RX (Rotator → PC):**
```
T:101
R:102
COM:45
V:12.3
CH:10110245123
```

### Pin Reference (Arduino)

```
D8  - AZ Direction
D9  - AZ PWM
D10 - EL PWM
D11 - EL Direction
A0  - AZ Encoder
A1  - EL Encoder
A2  - Voltage Sense
TX1 - WIFI232 RX
RX1 - WIFI232 TX
```
