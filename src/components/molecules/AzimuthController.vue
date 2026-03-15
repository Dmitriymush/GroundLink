<template>
  <div class="azimuth-controller">
    <!-- Top: Rotator panel -->
    <div class="rotator-panel" v-if="rotatorStore">
      <div class="rotator-header">
        <VSwitch
          v-model="rotatorEnabledModel"
          :label="t('Rotator')"
          color="primary"
          density="compact"
          hide-details
          class="rotator-switch"
        />
        <VTextField
          v-if="rotatorEnabled && !rotatorConnected"
          v-model="rotatorHost"
          placeholder="127.0.0.1"
          density="compact"
          hide-details
          variant="outlined"
          class="rotator-host-input"
          style="max-width: 140px; margin: 0 8px;"
        />
        <VBtn
          v-if="rotatorEnabled"
          :color="rotatorTelemetryConnected ? 'success' : rotatorTimedOut ? 'error' : rotatorConnected ? 'warning' : 'primary'"
          :loading="rotatorConnecting"
          size="small"
          variant="tonal"
          @click="toggleRotatorConnection"
        >
          {{ rotatorTelemetryConnected ? t('Connected') : rotatorTimedOut ? t('No response') : rotatorConnected ? t('Waiting...') : t('Connect') }}
        </VBtn>
      </div>

      <div v-if="rotatorConnected" class="connection-status">
        <div class="status-indicator" :class="rotatorTelemetryConnected ? 'status-ok' : rotatorTimedOut ? 'status-error' : 'status-waiting'">
          <span class="status-dot" />
          <span v-if="rotatorTelemetryConnected">{{ t('Device connected') }}</span>
          <span v-else-if="rotatorTimedOut">{{ t('Device not responding! Check connection.') }}</span>
          <span v-else>{{ t('Waiting for device response...') }}</span>
        </div>
        <span class="connected-host-inline">{{ rotatorHost }}:{{ rotatorStore.configPort }}</span>
      </div>

      <div v-if="rotatorTelemetryConnected && rotatorTelemetry" class="telemetry-feedback">
        <div class="telemetry-row">
          <div class="telemetry-item">
            <span class="telemetry-label">{{ t('Azimuth') }}</span>
            <span class="telemetry-value">{{ rotatorTelemetry.compassDegrees.toFixed(1) }}°</span>
          </div>
          <div class="telemetry-item" v-if="rotatorTelemetry.voltage > 0">
            <span class="telemetry-label">{{ t('Battery') }}</span>
            <span class="telemetry-value" :class="rotatorTelemetry.voltage < 11 ? 'voltage-low' : 'voltage-ok'">
              {{ rotatorTelemetry.voltage.toFixed(1) }}V
            </span>
          </div>
          <div class="telemetry-item">
            <span class="telemetry-label">{{ t('Sent') }}</span>
            <span class="telemetry-value telemetry-counter">{{ rotatorStore.commandsSent }}</span>
          </div>
        </div>
      </div>
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
          @update:azimuth="setAzimuthDegrees"
        />
      </div>
    </div>

    <!-- Bottom: Controls -->
    <div class="controls-bottom">
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
          <VBtnToggle v-model="power" mandatory color="primary" variant="outlined">
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
import { useT } from '@/hooks/use-t';
import { useAntennaState } from '@/hooks/use-antenna-state';
import { devices } from '@/controllers/devices';
import AzimuthCompass from '@/components/atoms/AzimuthCompass.vue';
import { useRotatorStore } from '@/store/rotator-store';

let rotatorStore: ReturnType<typeof useRotatorStore> | null = null;
try {
  rotatorStore = useRotatorStore();
} catch (e) {
  console.warn('[AzimuthController] Rotator store not available:', e);
}

interface Props {
  sendInterval?: number;
  compact?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  sendInterval: 20,
  compact: false,
});

const t = useT();

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

if (rotatorStore) {
  watch([azimuthDegrees, elevationDegrees], ([az, el]) => {
    if (rotatorStore?.rotatorEnabled && power.value) rotatorStore.setTargetPosition(az, el);
  }, { immediate: true });

  watch(power, (isPowerOn) => {
    if (isPowerOn && rotatorStore?.rotatorEnabled) rotatorStore.setTargetPosition(azimuthDegrees.value, elevationDegrees.value);
  });
}

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

const isInDeadZone = computed(() => {
  const az = azimuthDegrees.value;
  return az > 164 && az < 196;
});

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keyup', handleKeyUp);
});

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeyDown);
  document.removeEventListener('keyup', handleKeyUp);
  stopContinuousChange();
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
  justify-content: space-between;
  align-items: center;
}

.rotator-switch { flex: 0 0 auto; }

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
