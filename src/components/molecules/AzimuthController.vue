<template>
  <div class="azimuth-controller">
    <!-- Top: Rotator panel (collapsible) -->
    <div class="rotator-panel" v-if="rotatorStore">
      <!-- Header: Rotator switch + mode toggle + expand arrow -->
      <div class="rotator-header" @click="panelExpanded = !panelExpanded">
        <VSwitch
          v-model="rotatorEnabledModel"
          :label="t('Rotator')"
          color="primary"
          density="compact"
          hide-details
          class="rotator-switch"
          @click.stop
        />
        <VBtnToggle
          v-if="rotatorEnabled"
          v-model="controlMode"
          mandatory
          density="compact"
          variant="outlined"
          color="primary"
          class="mode-toggle"
          @click.stop
        >
          <VBtn value="udp" size="x-small">UDP</VBtn>
          <VBtn value="mavlink" size="x-small">MAVLink</VBtn>
          <VBtn value="mavlink-serial" size="x-small">SineLink</VBtn>
        </VBtnToggle>
        <!-- Collapsed status dots -->
        <div v-if="!panelExpanded && rotatorEnabled" class="collapsed-status">
          <span v-if="controlMode === 'udp' && rotatorTelemetryConnected" class="status-dot-inline" />
          <span v-if="controlMode === 'mavlink' && mavlinkPositionReceived" class="status-dot-inline" />
          <VIcon v-if="controlMode === 'mavlink' && mavlinkStore.isTracking" color="success" size="14">mdi-crosshairs-gps</VIcon>
          <span v-if="controlMode === 'mavlink-serial' && sinelinkStore.sinelinkConnected" class="status-dot-inline" />
          <VIcon v-if="controlMode === 'mavlink-serial' && sinelinkStore.isTracking" color="success" size="14">mdi-crosshairs-gps</VIcon>
        </div>
        <VIcon size="18" class="expand-icon" :class="{ expanded: panelExpanded }">mdi-chevron-down</VIcon>
      </div>

      <template v-if="panelExpanded && rotatorEnabled">
        <!-- UDP MODE -->
        <template v-if="controlMode === 'udp'">
          <div class="connection-row">
            <VTextField
              v-if="!rotatorConnected"
              v-model="rotatorHost"
              placeholder="127.0.0.1"
              density="compact"
              hide-details
              variant="outlined"
              class="rotator-host-input"
              style="max-width: 140px;"
            />
            <VBtn
              :color="rotatorTelemetryConnected ? 'success' : rotatorTimedOut ? 'error' : rotatorConnected ? 'warning' : 'primary'"
              :loading="rotatorConnecting"
              size="small"
              variant="tonal"
              @click="toggleRotatorConnection"
            >
              {{ rotatorTelemetryConnected ? 'Connected' : rotatorTimedOut ? 'No response' : rotatorConnected ? 'Waiting...' : 'Connect' }}
            </VBtn>
          </div>

          <div v-if="rotatorConnected" class="connection-status">
            <div class="status-indicator" :class="rotatorTelemetryConnected ? 'status-ok' : rotatorTimedOut ? 'status-error' : 'status-waiting'">
              <span class="status-dot" />
              <span v-if="rotatorTelemetryConnected">Device connected</span>
              <span v-else-if="rotatorTimedOut">Device not responding! Check connection.</span>
              <span v-else>Waiting for device response...</span>
            </div>
            <span class="connected-host-inline">{{ rotatorHost }}:{{ rotatorStore.configPort }}</span>
          </div>

          <div v-if="rotatorTelemetryConnected && rotatorTelemetry" class="telemetry-feedback">
            <div class="telemetry-row">
              <div class="telemetry-item">
                <span class="telemetry-label">Azimuth</span>
                <span class="telemetry-value">{{ rotatorTelemetry.compassDegrees.toFixed(1) }}°</span>
              </div>
              <div class="telemetry-item" v-if="rotatorTelemetry.voltage > 0">
                <span class="telemetry-label">Battery</span>
                <span class="telemetry-value" :class="rotatorTelemetry.voltage < 11 ? 'voltage-low' : 'voltage-ok'">
                  {{ rotatorTelemetry.voltage.toFixed(1) }}V
                </span>
              </div>
              <div class="telemetry-item">
                <span class="telemetry-label">Sent</span>
                <span class="telemetry-value telemetry-counter">{{ rotatorStore.commandsSent }}</span>
              </div>
            </div>
          </div>
        </template>

        <!-- MAVLINK MODE (UDP) -->
        <template v-if="controlMode === 'mavlink'">
          <!-- Host + Port + Listen + Auto-track -->
          <div class="connection-row">
            <VTextField
              v-if="!mavlinkConnected"
              v-model="mavlinkStore.mavlinkBindAddress"
              label="Host"
              placeholder="0.0.0.0"
              density="compact"
              hide-details
              variant="outlined"
              style="max-width: 120px;"
            />
            <VTextField
              v-if="!mavlinkConnected"
              v-model.number="mavlinkStore.mavlinkPort"
              label="Port"
              density="compact"
              hide-details
              variant="outlined"
              style="max-width: 80px;"
            />
            <VBtn
              :color="mavlinkConnected ? (mavlinkPositionReceived ? 'success' : 'warning') : 'primary'"
              :loading="mavlinkStore.connecting"
              size="small"
              variant="tonal"
              @click="toggleMavlinkConnection"
            >
              {{ mavlinkConnected ? (mavlinkPositionReceived ? 'Receiving' : 'Waiting...') : 'Connect' }}
            </VBtn>
            <div class="tracking-inline">
              <VSwitch
                v-model="mavlinkStore.trackingEnabled"
                label="Auto-track"
                :disabled="!mavlinkStore.hasGcsPosition || !mavlinkPositionReceived"
                color="success"
                density="compact"
                hide-details
              />
              <VIcon v-if="mavlinkStore.isTracking" color="success" size="14" class="tracking-icon">mdi-crosshairs-gps</VIcon>
            </div>
          </div>

          <!-- GCS Position -->
          <div class="gcs-position">
            <div class="gcs-label-row">
              <span class="section-label">GCS Position</span>
              <VBtn
                size="x-small"
                variant="text"
                color="primary"
                :loading="geoLoading"
                :prepend-icon="geoError ? 'mdi-alert-circle' : 'mdi-crosshairs-gps'"
                @click="fetchGcsLocation"
              >
                {{ geoError || 'Auto' }}
              </VBtn>
            </div>
            <div class="gcs-inputs">
              <VTextField
                v-model.number="mavlinkStore.gcsLat"
                label="Lat"
                density="compact"
                hide-details
                variant="outlined"
                type="number"
                step="0.0001"
              />
              <VTextField
                v-model.number="mavlinkStore.gcsLon"
                label="Lon"
                density="compact"
                hide-details
                variant="outlined"
                type="number"
                step="0.0001"
              />
              <VTextField
                v-model.number="mavlinkStore.gcsAlt"
                label="Alt(m)"
                density="compact"
                hide-details
                variant="outlined"
                type="number"
                style="max-width: 80px;"
              />
            </div>
          </div>

          <!-- Antenna MAVLink output (optional — for MAVLink servo instead of UDP) -->
          <div class="section-label" style="margin-top: 8px;">Antenna MAVLink (servo output)</div>
          <div v-if="!sinelinkStore.antennaConnected" class="connection-row">
            <VBtnToggle
              v-model="sinelinkStore.antennaTransport"
              mandatory
              density="compact"
              variant="outlined"
              color="primary"
              style="height: 30px;"
            >
              <VBtn value="serial" size="x-small">Serial</VBtn>
              <VBtn value="udp" size="x-small">UDP</VBtn>
            </VBtnToggle>
          </div>
          <div class="connection-row">
            <template v-if="sinelinkStore.antennaTransport === 'serial' && !sinelinkStore.antennaConnected">
              <VSelect
                v-model="sinelinkStore.antennaPort"
                :items="portItems"
                label="COM Port"
                density="compact"
                hide-details
                variant="outlined"
                style="max-width: 180px;"
              />
              <VSelect
                v-model.number="sinelinkStore.antennaBaud"
                :items="baudRateOptions"
                label="Baud"
                density="compact"
                hide-details
                variant="outlined"
                style="max-width: 100px;"
              />
            </template>
            <template v-if="sinelinkStore.antennaTransport === 'udp' && !sinelinkStore.antennaConnected">
              <VTextField
                v-model="sinelinkStore.antennaUdpHost"
                label="Host"
                placeholder="127.0.0.1"
                density="compact"
                hide-details
                variant="outlined"
                style="max-width: 150px;"
              />
              <VTextField
                v-model.number="sinelinkStore.antennaUdpPort"
                label="Port"
                placeholder="14550"
                density="compact"
                hide-details
                variant="outlined"
                type="number"
                style="max-width: 90px;"
              />
            </template>
            <VBtn
              :color="sinelinkStore.antennaConnected ? (sinelinkStore.antennaHeartbeatReceived ? 'success' : 'warning') : 'primary'"
              :loading="sinelinkStore.antennaConnecting"
              :disabled="antennaConnectDisabled"
              size="small"
              variant="tonal"
              @click="toggleAntennaConnection"
            >
              {{ sinelinkStore.antennaConnected ? (sinelinkStore.antennaHeartbeatReceived ? 'Connected' : 'Waiting...') : 'Connect' }}
            </VBtn>
          </div>

          <!-- Loading params indicator -->
          <div v-if="sinelinkStore.antennaHeartbeatReceived && !sinelinkStore.antennaParamsLoaded" class="params-loading">
            <VProgressCircular indeterminate size="16" width="2" color="primary" />
            <span>Loading params...</span>
          </div>

          <!-- AntennaTracker controls (only after params loaded) -->
          <div v-if="sinelinkStore.antennaParamsLoaded" class="tracker-controls">
            <div class="tracker-mode-row">
              <span class="section-label" style="margin: 0;">Mode: <strong>{{ trackerModeName }}</strong></span>
              <div class="tracker-mode-buttons">
                <VBtn size="x-small" variant="tonal" :color="sinelinkStore.trackerMode === 10 ? 'success' : 'default'" @click="sinelinkStore.setTrackerMode(10)">AUTO</VBtn>
                <VBtn size="x-small" variant="tonal" :color="sinelinkStore.trackerMode === 0 ? 'warning' : 'default'" @click="sinelinkStore.setTrackerMode(0)">MANUAL</VBtn>
                <VBtn size="x-small" variant="tonal" :color="sinelinkStore.trackerMode === 3 ? 'info' : 'default'" @click="sinelinkStore.setTrackerMode(3)">SERVO TEST</VBtn>
                <VBtn size="x-small" variant="tonal" :color="sinelinkStore.trackerMode === 1 ? 'error' : 'default'" @click="sinelinkStore.setTrackerMode(1)">STOP</VBtn>
              </div>
            </div>
            <div class="tracker-home-row">
              <VBtn size="x-small" variant="text" color="primary" prepend-icon="mdi-home-map-marker" @click="setTrackerHomeFromGcs">
                Set Home (GCS)
              </VBtn>
              <span v-if="sinelinkStore.trackerServo1 || sinelinkStore.trackerServo2" class="servo-info">
                S1: {{ sinelinkStore.trackerServo1 }} | S2: {{ sinelinkStore.trackerServo2 }}
              </span>
            </div>
          </div>

          <!-- Drone telemetry (only when connected) -->
          <div v-if="mavlinkConnected" class="mavlink-status">
            <div class="connection-status">
              <div class="status-indicator" :class="mavlinkPositionReceived ? 'status-ok' : 'status-waiting'">
                <span class="status-dot" />
                <span v-if="mavlinkPositionReceived">Drone GPS acquired</span>
                <span v-else>Waiting for GPS data...</span>
              </div>
            </div>

            <div v-if="mavlinkStore.dronePosition" class="telemetry-feedback">
              <div class="telemetry-row">
                <div class="telemetry-item">
                  <span class="telemetry-label">Drone</span>
                  <span class="telemetry-value telemetry-coord">{{ mavlinkStore.dronePosition.lat.toFixed(4) }}°, {{ mavlinkStore.dronePosition.lon.toFixed(4) }}°</span>
                </div>
                <div class="telemetry-item">
                  <span class="telemetry-label">Alt</span>
                  <span class="telemetry-value telemetry-coord">{{ mavlinkStore.dronePosition.alt.toFixed(0) }}m</span>
                </div>
              </div>
              <div v-if="mavlinkStore.trackingAngles" class="telemetry-row" style="margin-top: 2px;">
                <div class="telemetry-item">
                  <span class="telemetry-label">Bearing</span>
                  <span class="telemetry-value">{{ mavlinkStore.trackingAngles.azimuth.toFixed(1) }}°</span>
                </div>
                <div class="telemetry-item">
                  <span class="telemetry-label">Elev</span>
                  <span class="telemetry-value">{{ mavlinkStore.trackingAngles.elevation.toFixed(1) }}°</span>
                </div>
                <div class="telemetry-item">
                  <span class="telemetry-label">Dist</span>
                  <span class="telemetry-value telemetry-coord">{{ formatDistance(mavlinkStore.trackingAngles.distance) }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>

        <!-- MAVLINK SERIAL MODE (Sine.link + antenna servo) -->
        <template v-if="controlMode === 'mavlink-serial'">
          <!-- Refresh ports button -->
          <div class="connection-row">
            <VBtn size="x-small" variant="text" color="primary" prepend-icon="mdi-refresh" @click="sinelinkStore.refreshPorts()">
              Scan ports
            </VBtn>
            <div class="tracking-inline">
              <VSwitch
                v-model="sinelinkStore.trackingEnabled"
                label="Auto-track"
                :disabled="!sinelinkStore.hasGcsPosition || !sinelinkStore.positionValid"
                color="success"
                density="compact"
                hide-details
              />
              <VIcon v-if="sinelinkStore.isTracking" color="success" size="14" class="tracking-icon">mdi-crosshairs-gps</VIcon>
            </div>
          </div>

          <!-- Sine.link modem (input) -->
          <div class="section-label" style="margin-top: 8px;">Sine.link (drone GPS)</div>
          <div class="connection-row">
            <VSelect
              v-if="!sinelinkStore.sinelinkConnected"
              v-model="sinelinkStore.sinelinkPort"
              :items="portItems"
              label="COM Port"
              density="compact"
              hide-details
              variant="outlined"
              style="max-width: 200px;"
            />
            <VBtn
              :color="sinelinkStore.sinelinkConnected ? (sinelinkStore.positionValid ? 'success' : 'warning') : 'primary'"
              :loading="sinelinkStore.sinelinkConnecting"
              :disabled="!sinelinkStore.sinelinkPort && !sinelinkStore.sinelinkConnected"
              size="small"
              variant="tonal"
              @click="toggleSinelinkConnection"
            >
              {{ sinelinkStore.sinelinkConnected ? (sinelinkStore.positionValid ? 'Receiving' : 'Waiting...') : 'Connect' }}
            </VBtn>
          </div>

          <!-- Antenna device (output) -->
          <div class="section-label" style="margin-top: 8px;">Antenna (servo output)</div>
          <div v-if="!sinelinkStore.antennaConnected" class="connection-row">
            <VBtnToggle
              v-model="sinelinkStore.antennaTransport"
              mandatory
              density="compact"
              variant="outlined"
              color="primary"
              style="height: 30px;"
            >
              <VBtn value="serial" size="x-small">Serial</VBtn>
              <VBtn value="udp" size="x-small">UDP</VBtn>
            </VBtnToggle>
          </div>
          <div class="connection-row">
            <!-- Serial fields -->
            <template v-if="sinelinkStore.antennaTransport === 'serial' && !sinelinkStore.antennaConnected">
              <VSelect
                v-model="sinelinkStore.antennaPort"
                :items="portItems"
                label="COM Port"
                density="compact"
                hide-details
                variant="outlined"
                style="max-width: 180px;"
              />
              <VSelect
                v-model.number="sinelinkStore.antennaBaud"
                :items="baudRateOptions"
                label="Baud"
                density="compact"
                hide-details
                variant="outlined"
                style="max-width: 100px;"
              />
            </template>
            <!-- UDP fields -->
            <template v-if="sinelinkStore.antennaTransport === 'udp' && !sinelinkStore.antennaConnected">
              <VTextField
                v-model="sinelinkStore.antennaUdpHost"
                label="Host"
                placeholder="127.0.0.1"
                density="compact"
                hide-details
                variant="outlined"
                style="max-width: 150px;"
              />
              <VTextField
                v-model.number="sinelinkStore.antennaUdpPort"
                label="Port"
                placeholder="14550"
                density="compact"
                hide-details
                variant="outlined"
                type="number"
                style="max-width: 90px;"
              />
            </template>
            <VBtn
              :color="sinelinkStore.antennaConnected ? (sinelinkStore.antennaHeartbeatReceived ? 'success' : 'warning') : 'primary'"
              :loading="sinelinkStore.antennaConnecting"
              :disabled="antennaConnectDisabled"
              size="small"
              variant="tonal"
              @click="toggleAntennaConnection"
            >
              {{ sinelinkStore.antennaConnected ? (sinelinkStore.antennaHeartbeatReceived ? 'Connected' : 'Waiting...') : 'Connect' }}
            </VBtn>
          </div>

          <!-- Loading params indicator (SineLink mode) -->
          <div v-if="sinelinkStore.antennaHeartbeatReceived && !sinelinkStore.antennaParamsLoaded" class="params-loading">
            <VProgressCircular indeterminate size="16" width="2" color="primary" />
            <span>Loading params...</span>
          </div>

          <!-- AntennaTracker controls (only after params loaded, SineLink mode) -->
          <div v-if="sinelinkStore.antennaParamsLoaded" class="tracker-controls">
            <div class="tracker-mode-row">
              <span class="section-label" style="margin: 0;">Mode: <strong>{{ trackerModeName }}</strong></span>
              <div class="tracker-mode-buttons">
                <VBtn size="x-small" variant="tonal" :color="sinelinkStore.trackerMode === 10 ? 'success' : 'default'" @click="sinelinkStore.setTrackerMode(10)">AUTO</VBtn>
                <VBtn size="x-small" variant="tonal" :color="sinelinkStore.trackerMode === 0 ? 'warning' : 'default'" @click="sinelinkStore.setTrackerMode(0)">MANUAL</VBtn>
                <VBtn size="x-small" variant="tonal" :color="sinelinkStore.trackerMode === 3 ? 'info' : 'default'" @click="sinelinkStore.setTrackerMode(3)">SERVO TEST</VBtn>
                <VBtn size="x-small" variant="tonal" :color="sinelinkStore.trackerMode === 1 ? 'error' : 'default'" @click="sinelinkStore.setTrackerMode(1)">STOP</VBtn>
              </div>
            </div>
            <div class="tracker-home-row">
              <VBtn size="x-small" variant="text" color="primary" prepend-icon="mdi-home-map-marker" @click="setTrackerHomeFromGcs">
                Set Home (GCS)
              </VBtn>
              <span v-if="sinelinkStore.trackerServo1 || sinelinkStore.trackerServo2" class="servo-info">
                S1: {{ sinelinkStore.trackerServo1 }} | S2: {{ sinelinkStore.trackerServo2 }}
              </span>
            </div>
          </div>

          <!-- GCS Position -->
          <div class="gcs-position">
            <div class="gcs-label-row">
              <span class="section-label">GCS Position</span>
              <VBtn
                size="x-small"
                variant="text"
                color="primary"
                :loading="geoLoading"
                :prepend-icon="geoError ? 'mdi-alert-circle' : 'mdi-crosshairs-gps'"
                @click="fetchGcsLocationSinelink"
              >
                {{ geoError || 'Auto' }}
              </VBtn>
            </div>
            <div class="gcs-inputs">
              <VTextField
                v-model.number="sinelinkStore.gcsLat"
                label="Lat"
                density="compact"
                hide-details
                variant="outlined"
                type="number"
                step="0.0001"
              />
              <VTextField
                v-model.number="sinelinkStore.gcsLon"
                label="Lon"
                density="compact"
                hide-details
                variant="outlined"
                type="number"
                step="0.0001"
              />
              <VTextField
                v-model.number="sinelinkStore.gcsAlt"
                label="Alt(m)"
                density="compact"
                hide-details
                variant="outlined"
                type="number"
                style="max-width: 80px;"
              />
            </div>
          </div>

          <!-- Drone telemetry -->
          <div v-if="sinelinkStore.sinelinkConnected" class="mavlink-status">
            <div class="connection-status">
              <div class="status-indicator" :class="sinelinkStore.positionValid ? 'status-ok' : 'status-waiting'">
                <span class="status-dot" />
                <span v-if="sinelinkStore.positionValid">SNS position (conf: {{ sinelinkStore.positionConfidence }})</span>
                <span v-else>Waiting for SNS data...</span>
              </div>
            </div>

            <div v-if="sinelinkStore.dronePosition" class="telemetry-feedback">
              <div class="telemetry-row">
                <div class="telemetry-item">
                  <span class="telemetry-label">Drone</span>
                  <span class="telemetry-value telemetry-coord">{{ sinelinkStore.dronePosition.lat.toFixed(4) }}°, {{ sinelinkStore.dronePosition.lon.toFixed(4) }}°</span>
                </div>
                <div class="telemetry-item">
                  <span class="telemetry-label">Alt</span>
                  <span class="telemetry-value telemetry-coord">{{ sinelinkStore.dronePosition.alt.toFixed(0) }}m</span>
                </div>
              </div>
              <div v-if="sinelinkStore.trackingAngles" class="telemetry-row" style="margin-top: 2px;">
                <div class="telemetry-item">
                  <span class="telemetry-label">Bearing</span>
                  <span class="telemetry-value">{{ sinelinkStore.trackingAngles.azimuth.toFixed(1) }}°</span>
                </div>
                <div class="telemetry-item">
                  <span class="telemetry-label">Elev</span>
                  <span class="telemetry-value">{{ sinelinkStore.trackingAngles.elevation.toFixed(1) }}°</span>
                </div>
                <div class="telemetry-item">
                  <span class="telemetry-label">Dist</span>
                  <span class="telemetry-value telemetry-coord">{{ formatDistance(sinelinkStore.trackingAngles.distance) }}</span>
                </div>
              </div>
            </div>
          </div>
        </template>
      </template>
    </div>

    <!-- Middle: Compass fills available space -->
    <div class="compass-area">
      <!-- Dead zone warning - overlaid, doesn't shift layout -->
      <div v-if="isInDeadZone" class="dead-zone-warning">
        <VIcon size="14" color="warning">mdi-alert</VIcon>
        <span>{{ t('Dead zone! 164°-196°') }}</span>
      </div>
      <div class="compass-sizer">
        <AzimuthCompass
          :azimuth="azimuthDegrees"
          :elevation="elevationDegrees"
          :arrow-color="power ? '#ff4444' : '#666666'"
          :tracker-azimuth="sinelinkStore.antennaHeartbeatReceived ? sinelinkStore.trackerYaw : -1"
          @update:azimuth="setAzimuthDegrees"
        />
      </div>
    </div>

    <!-- Bottom: Controls -->
    <div class="controls-bottom">
      <!-- Tracker compass reading -->
      <div v-if="sinelinkStore.antennaHeartbeatReceived" class="tracker-compass-info">
        <span class="tracker-compass-label">Compass:</span>
        <span class="tracker-compass-value">{{ sinelinkStore.trackerYaw.toFixed(1) }}°</span>
        <span class="tracker-compass-label">Pitch:</span>
        <span class="tracker-compass-value">{{ sinelinkStore.trackerPitch.toFixed(1) }}°</span>
      </div>
      <div class="input-row">
        <VTextField
          :model-value="azimuthDegrees"
          :label="t('Azimuth')"
          suffix="°"
          type="number"
          variant="outlined"
          density="compact"
          hide-details
          @update:model-value="handleAzimuthInput"
        />
        <VTextField
          :model-value="elevationDegrees"
          :label="t('Elevation')"
          suffix="°"
          type="number"
          variant="outlined"
          density="compact"
          hide-details
          @update:model-value="handleElevationInput"
        />
      </div>

      <template v-if="!props.compact">
        <div class="button-row">
          <VBtn color="primary" icon size="default" @mousedown="startContinuousChange('azimuth', -1)" @mouseup="stopContinuousChange" @mouseleave="stopContinuousChange">
            <VIcon>mdi-chevron-left</VIcon>
          </VBtn>
          <div class="elevation-buttons">
            <VBtn color="primary" icon size="default" @mousedown="startContinuousChange('elevation', 1)" @mouseup="stopContinuousChange" @mouseleave="stopContinuousChange">
              <VIcon>mdi-chevron-up</VIcon>
            </VBtn>
            <VBtn color="primary" icon size="default" @mousedown="startContinuousChange('elevation', -1)" @mouseup="stopContinuousChange" @mouseleave="stopContinuousChange">
              <VIcon>mdi-chevron-down</VIcon>
            </VBtn>
          </div>
          <VBtn color="primary" icon size="default" @mousedown="startContinuousChange('azimuth', 1)" @mouseup="stopContinuousChange" @mouseleave="stopContinuousChange">
            <VIcon>mdi-chevron-right</VIcon>
          </VBtn>
        </div>

        <div class="power-row">
          <VBtnToggle v-model="power" mandatory color="primary" variant="outlined" :disabled="antennaWaitingParams">
            <VBtn :value="false">
              <VIcon start>mdi-power-off</VIcon>
              {{ t('Off') }}
            </VBtn>
            <VBtn :value="true" color="success">
              <VIcon start>mdi-power</VIcon>
              {{ t('On') }}
            </VBtn>
          </VBtnToggle>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, computed } from 'vue';
import { useIntervalFn } from '@vueuse/core';
import { useRoute } from 'vue-router';
import { useT } from '@/hooks/use-t';
import { useAntennaState } from '@/hooks/use-antenna-state';
import { devices } from '@/controllers/devices';
import AzimuthCompass from '@/components/atoms/AzimuthCompass.vue';
import { useRotatorStore } from '@/store/rotator-store';
import { useMavlinkStore } from '@/store/mavlink-store';
import { useSinelinkStore } from '@/store/sinelink-store';
import { RotatorFrameBuilder } from '@/services/rotator';
import { TRACKER_MODE_NAMES } from '@/services/sinelink/mavlink-serial';

let rotatorStore: ReturnType<typeof useRotatorStore> | null = null;
try {
  rotatorStore = useRotatorStore();
} catch (e) {
  console.warn('[AzimuthController] Rotator store not available:', e);
}

const mavlinkStore = useMavlinkStore();
const sinelinkStore = useSinelinkStore();
const sinelinkFrameBuilder = new RotatorFrameBuilder();

// Ownership: floating window takes priority over main window for sending commands
// Uses timestamp-based heartbeat to avoid stale locks if floating window crashes
const FLOATING_HEARTBEAT_KEY = 'antenna-floating-heartbeat';
const FLOATING_STALE_MS = 3000; // Floating considered dead after 3s without heartbeat

const route = useRoute();
const isFloatingInstance = computed(() => route.path === '/antenna-floating');

// Reactive tick — re-evaluate isActiveSender every 500ms
const _heartbeatTick = ref(0);
setInterval(() => { _heartbeatTick.value++; }, 500);

const isActiveSender = computed(() => {
  void _heartbeatTick.value; // make computed reactive to ticks
  if (isFloatingInstance.value) return true;
  // Main window: only send when floating window heartbeat is fresh
  const ts = parseInt(localStorage.getItem(FLOATING_HEARTBEAT_KEY) || '0', 10);
  return Date.now() - ts > FLOATING_STALE_MS;
});

interface Props {
  sendInterval?: number;
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  sendInterval: 20,
  compact: false,
});

const t = useT();

const baudRateOptions = [9600, 19200, 38400, 57600, 115200, 230400, 460800, 921600];

const {
  hozRaw,
  verRaw,
  azimuthDegrees,
  elevationDegrees,
  power,
  setAzimuthDegrees,
  setElevationDegrees,
  stepAzimuth,
  stepElevation,
} = useAntennaState();

const panelExpanded = ref(false);
const continuousInterval = ref<ReturnType<typeof setInterval> | null>(null);
const shiftPressed = ref(false);

const handleAzimuthInput = (value: string | number) => {
  const deg = typeof value === 'string' ? parseInt(value, 10) : value;
  if (!isNaN(deg)) setAzimuthDegrees(deg);
};

const handleElevationInput = (value: string | number) => {
  const deg = typeof value === 'string' ? parseInt(value, 10) : value;
  if (!isNaN(deg)) setElevationDegrees(deg);
};

const startContinuousChange = (field: 'azimuth' | 'elevation', direction: number) => {
  const step = shiftPressed.value ? 50 : 5;
  const actualDelta = direction * step;
  if (field === 'azimuth') stepAzimuth(actualDelta, true);
  else stepElevation(actualDelta);
  continuousInterval.value = setInterval(() => {
    if (field === 'azimuth') stepAzimuth(actualDelta, true);
    else stepElevation(actualDelta);
  }, 50);
};

const stopContinuousChange = () => {
  if (continuousInterval.value) {
    clearInterval(continuousInterval.value);
    continuousInterval.value = null;
  }
};

const sendData = () => {
  if (!isActiveSender.value) return;
  devices.hoz = hozRaw.value;
  devices.ver = verRaw.value;
};

const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Shift') { shiftPressed.value = true; return; }
  const step = shiftPressed.value ? 50 : 5;
  switch (e.key) {
    case 'ArrowLeft': stepAzimuth(-step, true); e.preventDefault(); break;
    case 'ArrowRight': stepAzimuth(step, true); e.preventDefault(); break;
    case 'ArrowUp': stepElevation(step); e.preventDefault(); break;
    case 'ArrowDown': stepElevation(-step); e.preventDefault(); break;
  }
};

const handleKeyUp = (e: KeyboardEvent) => {
  if (e.key === 'Shift') shiftPressed.value = false;
};

useIntervalFn(sendData, props.sendInterval);

const rotatorEnabled = computed(() => rotatorStore?.rotatorEnabled ?? false);
const rotatorConnected = computed(() => rotatorStore?.isConnected ?? false);
const rotatorConnecting = computed(() => rotatorStore?.isConnecting ?? false);
const rotatorTelemetry = computed(() => rotatorStore?.telemetry ?? null);
const rotatorTelemetryConnected = computed(() => rotatorStore?.telemetryConnected ?? false);
const rotatorTimedOut = computed(() => rotatorStore?.telemetryTimedOut ?? false);

const rotatorEnabledModel = computed({
  get: () => rotatorStore?.rotatorEnabled ?? false,
  set: (v: boolean) => { if (rotatorStore) rotatorStore.rotatorEnabled = v; }
});

const rotatorHost = computed({
  get: () => rotatorStore?.configHost ?? '127.0.0.1',
  set: (v: string) => { if (rotatorStore) rotatorStore.configHost = v; }
});

const controlMode = computed({
  get: () => rotatorStore?.controlMode ?? 'udp',
  set: (v: 'udp' | 'mavlink' | 'mavlink-serial') => { if (rotatorStore) rotatorStore.controlMode = v; }
});

// Serial port items for VSelect
const portItems = computed(() =>
  sinelinkStore.availablePorts.map(p => ({
    title: `${p.path}${p.manufacturer ? ` (${p.manufacturer})` : ''}`,
    value: p.path,
  }))
);

const toggleSinelinkConnection = () => {
  if (sinelinkStore.sinelinkConnected) {
    sinelinkStore.disconnectSinelink();
  } else {
    sinelinkStore.connectSinelink();
  }
};

const antennaConnectDisabled = computed(() => {
  if (sinelinkStore.antennaConnected) return false;
  if (sinelinkStore.antennaTransport === 'serial') return !sinelinkStore.antennaPort;
  return !sinelinkStore.antennaUdpHost || !sinelinkStore.antennaUdpPort;
});

const toggleAntennaConnection = () => {
  if (sinelinkStore.antennaConnected) {
    sinelinkStore.disconnectAntenna();
  } else {
    sinelinkStore.connectAntenna();
  }
};

const fetchGcsLocationSinelink = async () => {
  geoLoading.value = true;
  geoError.value = '';

  if (navigator.geolocation) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
        });
      });
      sinelinkStore.setGcsPosition(
        parseFloat(pos.coords.latitude.toFixed(6)),
        parseFloat(pos.coords.longitude.toFixed(6)),
        Math.round(pos.coords.altitude ?? 0),
      );
      geoLoading.value = false;
      return;
    } catch { /* fall through */ }
  }

  try {
    const res = await fetch('http://ip-api.com/json/?fields=lat,lon');
    const data = await res.json();
    if (data.lat && data.lon) {
      sinelinkStore.setGcsPosition(parseFloat(data.lat.toFixed(4)), parseFloat(data.lon.toFixed(4)), 0);
    } else {
      geoError.value = 'Failed';
      setTimeout(() => { geoError.value = ''; }, 3000);
    }
  } catch {
    geoError.value = 'Failed';
    setTimeout(() => { geoError.value = ''; }, 3000);
  }
  geoLoading.value = false;
};

// Geolocation auto-fill
const geoLoading = ref(false);
const geoError = ref('');

const fetchGcsLocationViaIP = async () => {
  const res = await fetch('http://ip-api.com/json/?fields=lat,lon');
  const data = await res.json();
  if (data.lat && data.lon) {
    mavlinkStore.setGcsPosition(
      parseFloat(data.lat.toFixed(4)),
      parseFloat(data.lon.toFixed(4)),
      0,
    );
    return true;
  }
  return false;
};

const fetchGcsLocation = async () => {
  geoLoading.value = true;
  geoError.value = '';

  // Try browser geolocation first
  if (navigator.geolocation) {
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 5000,
        });
      });
      mavlinkStore.setGcsPosition(
        parseFloat(pos.coords.latitude.toFixed(6)),
        parseFloat(pos.coords.longitude.toFixed(6)),
        Math.round(pos.coords.altitude ?? 0),
      );
      geoLoading.value = false;
      return;
    } catch {
      // Fall through to IP-based
    }
  }

  // Fallback: IP-based geolocation
  try {
    const ok = await fetchGcsLocationViaIP();
    geoLoading.value = false;
    if (!ok) {
      geoError.value = 'Failed';
      setTimeout(() => { geoError.value = ''; }, 3000);
    }
  } catch {
    geoLoading.value = false;
    geoError.value = 'Failed';
    setTimeout(() => { geoError.value = ''; }, 3000);
  }
};

const mavlinkConnected = computed(() => mavlinkStore.connected);
const mavlinkPositionReceived = computed(() => mavlinkStore.positionReceived);

const toggleMavlinkConnection = () => {
  if (mavlinkStore.connected) {
    mavlinkStore.disconnect();
  } else {
    mavlinkStore.connect();
  }
};

// Antenna waiting for params — controls disabled
const antennaWaitingParams = computed(() =>
  sinelinkStore.antennaConnected && sinelinkStore.antennaHeartbeatReceived && !sinelinkStore.antennaParamsLoaded
);

// Auto power OFF when antenna connects, ON when params loaded
watch(() => sinelinkStore.antennaConnected, (connected) => {
  if (connected) {
    power.value = false;
  }
});

watch(() => sinelinkStore.antennaParamsLoaded, (loaded) => {
  if (loaded) {
    power.value = true;
  }
});

// AntennaTracker helpers
const trackerModeName = computed(() => {
  const mode = sinelinkStore.trackerMode;
  return TRACKER_MODE_NAMES[mode] ?? `UNKNOWN(${mode})`;
});

const setTrackerHomeFromGcs = () => {
  // Use GCS position from whichever mode is active
  const lat = controlMode.value === 'mavlink-serial' ? sinelinkStore.gcsLat : mavlinkStore.gcsLat;
  const lon = controlMode.value === 'mavlink-serial' ? sinelinkStore.gcsLon : mavlinkStore.gcsLon;
  const alt = controlMode.value === 'mavlink-serial' ? sinelinkStore.gcsAlt : mavlinkStore.gcsAlt;
  if (lat === 0 && lon === 0) return;
  sinelinkStore.setTrackerHome(lat, lon, alt);
};

const formatDistance = (meters: number): string => {
  if (meters >= 1000) return `${(meters / 1000).toFixed(1)}km`;
  return `${meters.toFixed(0)}m`;
};

// Forward between links: when drone position updates, forward to antenna tracker (for AUTO mode)
watch(() => mavlinkStore.dronePosition, (pos) => {
  if (!pos || !sinelinkStore.antennaConnected) return;
  if (sinelinkStore.trackerMode === 10) { // AUTO mode — tracker needs drone position
    sinelinkStore.forwardDronePosition(pos.lat, pos.lon, pos.alt, pos.alt, mavlinkStore.droneHdg);
  }
}, { deep: true });

// Auto-tracking: when MAVLink tracking is active, override compass angles + send servo if antenna connected
watch(() => mavlinkStore.trackingAngles, (angles) => {
  if (controlMode.value === 'mavlink' && mavlinkStore.isTracking && angles) {
    setAzimuthDegrees(Math.round(angles.azimuth));
    setElevationDegrees(Math.round(angles.elevation));

    // Also send MAVLink servo commands if antenna is in SERVO_TEST mode
    if (sinelinkStore.antennaConnected && sinelinkStore.trackerMode === 3) {
      const pwmValues = sinelinkFrameBuilder.getAzimuthElevationPwm(
        Math.round(angles.azimuth),
        Math.round(angles.elevation),
      );
      if (pwmValues) {
        sinelinkStore.sendServoPosition(pwmValues.azimuthPwm, Math.round(angles.elevation));
      }
    }
  }
}, { deep: true });

// Auto-tracking: Sine.link mode — override compass angles + send servo commands
watch(() => sinelinkStore.trackingAngles, (angles) => {
  if (controlMode.value === 'mavlink-serial' && sinelinkStore.isTracking && angles) {
    setAzimuthDegrees(Math.round(angles.azimuth));
    setElevationDegrees(Math.round(angles.elevation));

    // Send servo commands
    const pwmValues = sinelinkFrameBuilder.getAzimuthElevationPwm(
      Math.round(angles.azimuth),
      Math.round(angles.elevation),
    );
    if (pwmValues) {
      sinelinkStore.sendServoPosition(pwmValues.azimuthPwm, Math.round(angles.elevation));
    }
  }
}, { deep: true });

// Forward between links (SineLink mode): forward drone position to tracker for AUTO mode
watch(() => sinelinkStore.dronePosition, (pos) => {
  if (!pos || !sinelinkStore.antennaConnected) return;
  if (sinelinkStore.trackerMode === 10) { // AUTO mode
    sinelinkStore.forwardDronePosition(pos.lat, pos.lon, pos.alt, pos.alt, 0);
  }
}, { deep: true });

// When in sinelink or mavlink mode, auto-scan ports
watch(controlMode, (mode) => {
  if (mode === 'mavlink-serial' || mode === 'mavlink') {
    sinelinkStore.refreshPorts();
  }
});

// Main position watch — sends commands to rotator (UDP) or antenna (MAVLink serial)
if (rotatorStore) {
  watch([azimuthDegrees, elevationDegrees], ([az, el]) => {
    const mode = controlMode.value;
    if (mode === 'mavlink-serial') {
      console.log(`[AzimuthCtrl] watch fired: az=${az} el=${el} mode=${mode} isActiveSender=${isActiveSender.value} rotatorEnabled=${rotatorStore?.rotatorEnabled} power=${power.value} antennaConnected=${sinelinkStore.antennaConnected}`);
    }

    if (!isActiveSender.value || !rotatorStore?.rotatorEnabled || !power.value) return;

    // UDP mode — send via rotator store only
    if (mode === 'udp') {
      rotatorStore.setTargetPosition(az, el);
    }

    // MAVLink / SineLink mode — send commands based on tracker mode
    if (mode === 'mavlink' || mode === 'mavlink-serial') {
      if (mode === 'mavlink') {
        rotatorStore.setTargetPosition(az, el);
      }

      if (sinelinkStore.antennaConnected) {
        const tMode = sinelinkStore.trackerMode;
        const pwmValues = sinelinkFrameBuilder.getAzimuthElevationPwm(az, el);
        if (pwmValues) {
          if (tMode === 3) {
            // SERVO_TEST — send DO_SET_SERVO (elevationCmd = raw degrees)
            sinelinkStore.sendServoPosition(pwmValues.azimuthPwm, el);
          } else if (tMode === 0) {
            // MANUAL — send RC_CHANNELS_OVERRIDE (elevationPwm = raw degrees)
            sinelinkStore.sendRcOverride(pwmValues.azimuthPwm, el);
          }
          // AUTO (10), STOP (1) — don't send anything, ArduPilot handles it
        }
      }
    }
  }, { immediate: true });

  watch(power, (isPowerOn) => {
    if (!isActiveSender.value || !isPowerOn || !rotatorStore?.rotatorEnabled) return;

    if (controlMode.value === 'udp' || controlMode.value === 'mavlink') {
      rotatorStore.setTargetPosition(azimuthDegrees.value, elevationDegrees.value);
    }
    if (controlMode.value === 'mavlink-serial' && sinelinkStore.antennaConnected) {
      const pwmValues = sinelinkFrameBuilder.getAzimuthElevationPwm(azimuthDegrees.value, elevationDegrees.value);
      if (pwmValues) {
        sinelinkStore.sendServoPosition(pwmValues.azimuthPwm, elevationDegrees.value);
      }
    }
  });
}

const toggleRotatorConnection = () => {
  if (!rotatorStore) return;
  if (rotatorStore.isConnected) {
    rotatorStore.disconnect();
  } else {
    setAzimuthDegrees(0);
    setElevationDegrees(0);
    rotatorStore.connect();
  }
};

const isInDeadZone = computed(() => false);

// Floating window writes heartbeat every second so main window knows it's alive
let floatingHeartbeatTimer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);

  // Cleanup legacy stale flag from previous version
  localStorage.removeItem('antenna-floating-active');

  if (isFloatingInstance.value) {
    // Write heartbeat immediately + every 1s
    localStorage.setItem(FLOATING_HEARTBEAT_KEY, Date.now().toString());
    floatingHeartbeatTimer = setInterval(() => {
      localStorage.setItem(FLOATING_HEARTBEAT_KEY, Date.now().toString());
    }, 1000);
  }
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('keyup', handleKeyUp);
  stopContinuousChange();

  if (isFloatingInstance.value) {
    if (floatingHeartbeatTimer) {
      clearInterval(floatingHeartbeatTimer);
      floatingHeartbeatTimer = null;
    }
    localStorage.removeItem(FLOATING_HEARTBEAT_KEY);
  }
});
</script>

<style scoped>
.azimuth-controller {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  max-width: 600px;
  padding: 8px;
  gap: 6px;
}

/* --- Rotator panel --- */
.rotator-panel {
  flex-shrink: 0;
  padding: 8px 12px;
  background: rgba(128, 128, 128, 0.1);
  border-radius: 8px;
}

.rotator-header {
  display: flex;
  align-items: center;
  cursor: pointer;
  user-select: none;
}

.rotator-switch { flex: 0 0 auto; }
.mode-toggle { flex: 0 0 auto; margin-left: 8px; }

.collapsed-status {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
}

.status-dot-inline {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
  background: #4caf50;
  box-shadow: 0 0 4px #4caf50;
}

.expand-icon {
  margin-left: auto;
  transition: transform 0.2s;
  color: rgba(128, 128, 128, 0.5);
  flex-shrink: 0;
}

.expand-icon.expanded {
  transform: rotate(180deg);
}

.tracking-inline {
  display: flex;
  align-items: center;
  gap: 2px;
  margin-left: auto;
}

.connection-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 6px;
}

.section-label {
  font-size: 10px;
  text-transform: uppercase;
  color: rgba(128, 128, 128, 0.7);
  margin-top: 6px;
  display: block;
}

.gcs-position { margin-top: 4px; }

.gcs-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.gcs-inputs {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.gcs-inputs > * { flex: 1; }

.mavlink-status { margin-top: 6px; }

.params-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 12px;
  background: rgba(25, 118, 210, 0.08);
  border-radius: 6px;
  border: 1px solid rgba(25, 118, 210, 0.2);
  font-size: 13px;
  color: #1976d2;
}

.tracker-controls {
  margin-top: 8px;
  padding: 8px;
  background: rgba(76, 175, 80, 0.08);
  border-radius: 6px;
  border: 1px solid rgba(76, 175, 80, 0.2);
}

.tracker-mode-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 4px;
}

.tracker-mode-buttons {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.tracker-home-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
}

.servo-info {
  font-size: 11px;
  color: rgba(128, 128, 128, 0.7);
  font-family: monospace;
}

.tracker-compass-info {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background: rgba(25, 118, 210, 0.08);
  border-radius: 12px;
  margin-top: 4px;
}

.tracker-compass-label {
  font-size: 11px;
  color: rgba(128, 128, 128, 0.7);
  text-transform: uppercase;
}

.tracker-compass-value {
  font-size: 16px;
  font-weight: 600;
  color: #1976d2;
}

.tracking-icon {
  animation: pulse-dot 1s ease-in-out infinite;
}

.telemetry-coord { font-size: 13px !important; color: #1976d2 !important; }

.connection-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 12px;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}

.status-ok .status-dot { background: #4caf50; box-shadow: 0 0 6px #4caf50; }
.status-ok { color: #4caf50; }
.status-waiting .status-dot { background: #ff9800; animation: pulse-dot 1s ease-in-out infinite; }
.status-waiting { color: #ff9800; }
.status-error .status-dot { background: #f44336; animation: pulse-dot 0.5s ease-in-out infinite; }
.status-error { color: #f44336; font-weight: 500; }

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.connected-host-inline { color: rgba(128, 128, 128, 0.6); font-size: 11px; }

.telemetry-feedback {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(128, 128, 128, 0.2);
}

.telemetry-row { display: flex; gap: 16px; align-items: center; }

.telemetry-item { display: flex; flex-direction: column; align-items: center; }

.telemetry-label { font-size: 10px; color: rgba(128, 128, 128, 0.7); text-transform: uppercase; }

.telemetry-value { font-size: 16px; font-weight: 600; color: #4caf50; }
.voltage-ok { color: #4caf50; }
.voltage-low { color: #f44336; }
.telemetry-counter { color: rgba(128, 128, 128, 0.8); font-size: 14px; }

/* --- Compass area: fills all remaining vertical space --- */
.compass-area {
  flex: 1;
  min-height: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  position: relative;
}

.dead-zone-warning {
  position: absolute;
  top: 4px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 10px;
  background: rgba(251, 140, 0, 0.15);
  border: 1px solid rgba(251, 140, 0, 0.4);
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
  color: #e65100;
  white-space: nowrap;
}

.compass-sizer {
  width: 100%;
  aspect-ratio: 1 / 1;
  max-height: 100%;
  max-width: 100%;
}

/* --- Controls at bottom --- */
.controls-bottom {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: center;
}

.input-row {
  display: flex;
  gap: 8px;
  width: 100%;
}

.input-row > * {
  flex: 1;
}

.button-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.elevation-buttons {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.power-row {
  display: flex;
  justify-content: center;
}
</style>
