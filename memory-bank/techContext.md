# Technical Context: GroundLink (Drone Control System)

## Technology Stack

### Core Technologies
- **Electron**: v26.4.3
- **Vue.js**: v3.3.4
- **TypeScript**: v5.1.6
- **Vite**: v4.4.9
- **Vuetify**: v3.7.18

### State Management
- **Pinia**: v2.1.7
- **Vue Router**: v4.2.5
- **@vueuse/core**: v10.9.0
- **@tanstack/vue-query**: v5.17.0

### Network & Communication
- **Wireguard VPN**
- **WebSocket**
- **RTP (Real-time Transport Protocol)**
- **needle**: v3.3.1 (HTTP client)
- **axios**: v1.6.3

### Hardware Integration
- **node-hid**: v2.1.2
- **hwid**: v0.5.0
- **TBS Crossfire system**
- **Analog 5.8GHz video system**

## Development Setup

### Environment Requirements
```bash
Node.js >= 18.x
npm >= 9.x
Visual Studio Code (recommended)
```

### Project Setup
```bash
npm install          # Install dependencies
npm run dev         # Start development server
npm run build       # Build production version
npm run preview     # Preview production build
```

### Development Tools
- **Vue DevTools**
- **TypeScript Language Server**
- **Vite Plugin Electron**: v0.14.0
- **Vite Plugin Vue**: v4.3.3
- **Electron Builder**: v24.6.4

## Technical Constraints

### TypeScript Issues
Currently monitoring these type issues:
```typescript
// video-settings.ts
- No value exists in scope for shorthand property 'labe'

// rpanion.ts
- Type mismatch in BaseVideoSettings array
- Undefined label property in video settings interface
```

### Hardware Limitations
1. **Video Streaming**
   - Maximum resolution: 1920x1080
   - FPS limits: 20fps at 1920x1080, 30fps at lower resolutions
   - Bitrate range: 1000-5000 kbps

2. **Control System**
   - Maximum 7 control channels
   - Required channel mapping:
     ```typescript
     const CHANNEL_MAP = {
       CH1: 'ROLL',
       CH2: 'PITCH',
       CH3: 'THROTTLE',
       CH4: 'YAW',
       CH5: 'ARM',
       CH6: 'MODE',
       CH7: '-'
     }
     ```

### Network Requirements
- Minimum bandwidth: 3.5 Mbps
- VPN connection required
- UDP ports required:
  - Video: 5400
  - Telemetry: 14550
  - Control: 27015, 27016

## Dependencies

### Production Dependencies
```json
{
  "@mdi/font": "7.4.47",
  "@tanstack/vue-query": "^5.17.0",
  "@vueuse/core": "^10.9.0",
  "axios": "^1.6.3",
  "commander": "^12.1.0",
  "hwid": "^0.5.0",
  "lodash": "^4.17.21",
  "needle": "^3.3.1",
  "node-hid": "^2.1.2",
  "pinia": "^2.1.7",
  "uuid": "^9.0.1",
  "vue-router": "^4.2.5"
}
```

### Development Dependencies
```json
{
  "@electron/rebuild": "^3.3.0",
  "@vitejs/plugin-vue": "^4.3.3",
  "electron": "^26.4.3",
  "electron-builder": "^24.6.4",
  "typescript": "^5.1.6",
  "vite": "^4.4.9",
  "vite-plugin-electron": "^0.14.0",
  "vue": "^3.3.4",
  "vuetify": "3.7.18"
}
```

## Build System

### Electron Builder Configuration
```json5
{
  "appId": "com.GroundLink.app",
  "asar": true,
  "directories": {
    "output": "release/${version}"
  },
  "files": [
    "dist-electron",
    "dist"
  ]
}
```

### Vite Configuration
- ESBuild for TypeScript compilation
- Hot Module Replacement (HMR)
- Electron-specific plugins
- Native module support

## Performance Considerations

### Video Processing
- Hardware acceleration when available
- Adaptive quality based on bandwidth
- Frame buffering optimization

### Control Latency
- Direct HID input processing
- UDP for control commands
- Minimized processing overhead

### Memory Management
- Electron process separation
- Vue component lifecycle optimization
- Resource cleanup routines

## Security Measures

### VPN Configuration
- Wireguard tunnel for all communications
- Unique client configurations
- Automatic reconnection handling

### Content Verification
```typescript
if (!import.meta.env.VITE_APP_INGORE_SECURE) {
  checkContent(); // Validates application integrity
}
```

### Error Handling
- Graceful degradation
- Secure error logging
- Recovery procedures
