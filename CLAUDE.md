# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GroundLink (Megapolis Ground) is an Electron + Vue 3 desktop application for drone ground station control. It provides remote control, video streaming, telemetry monitoring, and hardware integration for drone operations over VPN connections.

## Development Commands

```bash
# Development
npm run dev              # Start dev server on port 27015

# Build
npm run build            # Type-check, build, and package with electron-builder
npm run build-no-lint    # Build without type-checking

# Other
npm run config           # Run build config script
npm run migrate-api      # Run API migration script
```

## Architecture

### Electron Structure
- `electron/main/index.ts` - Main process entry, window management
- `electron/main/hid_worker.ts` - HID device worker thread for joystick input (uses BroadcastChannel for IPC)
- `electron/preload/index.ts` - Preload scripts

### Vue Frontend (`src/`)

**State Management**: Pinia stores
- `store/app-settings-store.ts` - Connection profiles, persisted settings (uses `@vueuse/core` useStorage)
- `store/connections-status-store.ts` - Real-time connection status
- `store/rcControll.ts` - RC channel values
- `store/jr-settings-store.ts` - JR transmitter settings
- `store/can-store.ts` - CAN bus device state

**API Layer** (currently migrating):
- **New pattern**: `src/services/api/` with `ApiServiceFactory` and TanStack Query hooks in `src/hooks/use-*-api.ts`
- **Legacy** (deprecated): `src/controllers/api/` - direct API classes

Services:
- `RPanionService` - Rpanion-server communication (video config at http://10.0.2.100:3000)
- `HardwareService` - Local hardware server (port 3003)
- `DroneService` - Drone telemetry/control (port 8000)
- `InitiatorService` - Remote initiator server

**Routing**: `src/router/router.ts` defines page components:
- Settings, Remote Control (v1/v2), Antenna Control, CAN Control, Vulik Control, etc.

**Components**: Atomic design in `src/components/`
- `pages/` - Full page views
- `molecules/` - Composite components (settings panels, device cards)
- `atoms/` - Basic UI elements
- `modals/` - Dialog components

### Key Technologies
- Vue 3 + TypeScript + Vuetify 3
- TanStack Query for server state
- node-hid for USB HID devices (joysticks)
- Axios for HTTP

### Path Alias
`@/` maps to `./src/` (configured in tsconfig.json and vite.config.ts)

## Hardware Integration

The app communicates with:
- **Rpanion-server**: Raspberry Pi companion computer on drone (default http://10.0.2.100:3000)
- **Mega Server**: Main drone control server
- **USB HID devices**: Joysticks/transmitters via node-hid worker thread

## Notes

- UI language is Ukrainian
- Connection profiles are stored in localStorage
- Native modules (node-hid) require `electron-rebuild` after install