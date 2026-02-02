# System Patterns: GroundLink (Drone Control System)

## System Architecture

### High-Level Architecture
```mermaid
flowchart TD
    subgraph Desktop["Desktop Application (Electron)"]
        UI["Vue.js UI Layer"]
        Controllers["Control Layer"]
        Network["Network Layer"]
    end

    subgraph Hardware["Hardware Integration"]
        Joystick["HID Joystick"]
        Video["Video Devices"]
        Crossfire["TBS Crossfire"]
    end

    subgraph RemoteSystem["Remote System"]
        VPN["VPN Tunnel"]
        VideoStream["Video Stream"]
        DroneControl["Drone Control"]
        VulikSystem["Vulik System"]
    end

    UI <--> Controllers
    Controllers <--> Network
    Network <--> VPN
    VPN <--> DroneControl
    VPN <--> VideoStream
    VPN <--> VulikSystem
    Joystick <--> Controllers
    Video <--> VideoStream
    Crossfire <--> DroneControl
```

## Core Components

### Frontend Layer
- **Vue 3 Components**
  - Reactive UI updates
  - Component-based architecture
  - Vuetify for UI components
  - Vue Router for navigation
  - Pinia for state management

### Control Layer
- **Drone Control**
  - Channel mapping system
  - Joystick input processing
  - Real-time command transmission
  - Telemetry data handling

- **Video Management**
  - RTP stream handling
  - Quality configuration
  - Device management
  - Frame processing

- **Vulik Integration**
  - Box state management
  - Lead control system
  - Drone loading/unloading
  - Battery monitoring

### Network Layer
- **VPN Management**
  - Wireguard configuration
  - Connection monitoring
  - Auto-reconnection
  - Status tracking

- **Data Streams**
  - Control commands (UDP)
  - Video streaming (RTP)
  - Telemetry data
  - System status updates

## Design Patterns

### State Management
```mermaid
flowchart LR
    subgraph Stores["Pinia Stores"]
        AS["App Settings"]
        MS["Mixer Settings"]
        VS["Video Settings"]
        MN["Menu Store"]
    end

    subgraph Controllers["Controllers"]
        VC["Virtual Controller"]
        SC["Socket Controller"]
        AC["API Controller"]
    end

    subgraph Components["Vue Components"]
        UI["UI Elements"]
        Forms["Settings Forms"]
        Status["Status Displays"]
        Nav["Navigation Menu"]
    end

    Stores <--> Controllers
    Controllers <--> Components
    MN --> Nav
```

### Navigation Pattern
```mermaid
flowchart TD
    subgraph MenuStore["Menu Store"]
        State["Collapse State"]
        Auto["Auto Collapse"]
        Manual["Manual Toggle"]
    end

    subgraph Components["Components"]
        Top["TopBar"]
        Menu["Menu"]
        Video["Video Controls"]
    end

    subgraph Triggers["Collapse Triggers"]
        Window["Window Size < 1000px"]
        Button["Menu Button"]
    end

    Window --> Auto
    Button --> Manual
    State --> Menu
    State --> Video
    Manual --> State
    Auto --> State
    State --> Top
```

### Communication Patterns
1. **WebSocket Communication**
   - Real-time control data
   - Status updates
   - Error reporting

2. **REST APIs**
   - Configuration management
   - System status queries
   - Command transmission

3. **UDP Streams**
   - Video transmission
   - Telemetry data
   - Control commands

### Error Handling
```mermaid
flowchart TD
    Error["Error Detection"] --> Classify["Error Classification"]
    Classify --> Network["Network Error"]
    Classify --> Hardware["Hardware Error"]
    Classify --> System["System Error"]
    
    Network --> Reconnect["Auto Reconnect"]
    Hardware --> Reset["Hardware Reset"]
    System --> Recover["System Recovery"]
    
    Reconnect --> Log["Error Logging"]
    Reset --> Log
    Recover --> Log
```

## Technical Decisions

### Framework Choices
- **Electron**: Cross-platform desktop support
- **Vue 3**: Modern reactive UI framework
- **TypeScript**: Type safety and better development experience
- **Vuetify**: Material Design component framework

### Communication Protocols
- **Wireguard VPN**: Secure tunnel for all communications
- **RTP**: Efficient video streaming
- **WebSocket**: Real-time control and status
- **UDP**: Low-latency data transmission

### Hardware Integration
- **HID Protocol**: Joystick input handling
- **TBS Crossfire**: Reliable drone control
- **Video Devices**: Multiple format support
- **Vulik System**: Automated handling interface

### UI/UX Patterns
- **Responsive Navigation**
  - Collapsible menu system
  - Status indicators in top bar
  - Adaptive video controls
  - Icon-based navigation in collapsed state
  - Tooltips for accessibility

## Development Patterns

### Code Organization
```mermaid
flowchart TD
    src["Source Code"]
    src --> components["Components"]
    src --> controllers["Controllers"]
    src --> store["Store"]
    src --> utils["Utilities"]
    
    components --> atoms["Atoms"]
    components --> molecules["Molecules"]
    components --> pages["Pages"]
    
    controllers --> api["API"]
    controllers --> hardware["Hardware"]
    controllers --> network["Network"]
    
    store --> menu["Menu Store"]
    store --> settings["Settings Store"]
```

### Best Practices
1. **Component Design**
   - Single responsibility
   - Reusable components
   - Props validation
   - Event handling

2. **State Management**
   - Centralized stores
   - Action/mutation patterns
   - Reactive updates
   - State persistence

3. **Error Handling**
   - Error boundaries
   - Graceful degradation
   - User feedback
   - Recovery procedures
