<template>
  <VCard class="azimuth-controller" color="background" elevation="2">
    <VCardText>
      <!-- Rotator control panel (independent from Settings page) -->
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
          <!-- Host input (only when not connected) -->
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
            :color="rotatorConnected ? 'success' : 'primary'"
            :loading="rotatorConnecting"
            size="small"
            variant="tonal"
            @click="toggleRotatorConnection"
          >
            {{ rotatorConnected ? t('Connected') : t('Connect') }}
          </VBtn>
        </div>
        <!-- Telemetry feedback from rotator -->
        <div v-if="rotatorConnected && rotatorTelemetry" class="telemetry-feedback">
          <span class="feedback-label">{{ t('Actual') }}:</span>
          <span class="feedback-value">{{ rotatorTelemetry.compassDegrees.toFixed(0) }}°</span>
          <span class="feedback-voltage">{{ rotatorTelemetry.voltage.toFixed(1) }}V</span>
          <span class="feedback-commands">{{ t('Sent') }}: {{ rotatorStore.commandsSent }}</span>
        </div>
        <!-- Show host when connected -->
        <div v-if="rotatorConnected" class="connected-host">
          {{ rotatorHost }}:{{ rotatorStore.configPort }}
        </div>
      </div>

      <!-- Dead zone warning (like Pascal app) -->
      <VAlert
        v-if="isInDeadZone"
        type="warning"
        density="compact"
        class="mb-2"
      >
        {{ t('Dead zone! Azimuth 164-196 degrees is not reachable.') }}
      </VAlert>

      <!-- Compass Grid -->
      <div class="compass-container">
        <AzimuthCompass
          :size="compassSize"
          :azimuth="azimuthDegrees"
          :elevation="elevationDegrees"
          :arrow-color="power ? '#ff4444' : '#666666'"
          @update:azimuth="setAzimuthDegrees"
        />
      </div>

      <!-- Value displays -->
      <VRow class="mt-4" dense>
        <VCol cols="6">
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
        </VCol>
        <VCol cols="6">
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
        </VCol>
      </VRow>

      <!-- Control buttons -->
      <VRow class="mt-4" justify="center" align="center" dense>
        <!-- Left arrow -->
        <VCol cols="auto">
          <VBtn
            color="primary"
            icon
            size="large"
            @mousedown="startContinuousChange('azimuth', -1)"
            @mouseup="stopContinuousChange"
            @mouseleave="stopContinuousChange"
          >
            <VIcon>mdi-chevron-left</VIcon>
          </VBtn>
        </VCol>

        <!-- Up/Down arrows stacked -->
        <VCol cols="auto">
          <div class="elevation-buttons">
            <VBtn
              color="primary"
              icon
              size="large"
              @mousedown="startContinuousChange('elevation', 1)"
              @mouseup="stopContinuousChange"
              @mouseleave="stopContinuousChange"
            >
              <VIcon>mdi-chevron-up</VIcon>
            </VBtn>
            <VBtn
              color="primary"
              icon
              size="large"
              @mousedown="startContinuousChange('elevation', -1)"
              @mouseup="stopContinuousChange"
              @mouseleave="stopContinuousChange"
            >
              <VIcon>mdi-chevron-down</VIcon>
            </VBtn>
          </div>
        </VCol>

        <!-- Right arrow -->
        <VCol cols="auto">
          <VBtn
            color="primary"
            icon
            size="large"
            @mousedown="startContinuousChange('azimuth', 1)"
            @mouseup="stopContinuousChange"
            @mouseleave="stopContinuousChange"
          >
            <VIcon>mdi-chevron-right</VIcon>
          </VBtn>
        </VCol>
      </VRow>

      <!-- Power toggle buttons -->
      <VRow class="mt-4" justify="center" dense>
        <VCol cols="auto">
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
        </VCol>
      </VRow>
    </VCardText>
  </VCard>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch, computed } from 'vue';
import { useIntervalFn } from '@vueuse/core';
import { useT } from '@/hooks/use-t';
import { useAntennaState } from '@/hooks/use-antenna-state';
import { devices } from '@/controllers/devices';
import AzimuthCompass from '@/components/atoms/AzimuthCompass.vue';

// Optional rotator integration - loads lazily and doesn't break if unavailable
const RotatorConnectionStatus = defineAsyncComponent(() =>
  import('@/components/atoms/RotatorConnectionStatus.vue')
);

import { defineAsyncComponent } from 'vue';

// Import rotator store
import { useRotatorStore } from '@/store/rotator-store';

// Try to initialize rotator store, but don't break if it fails
let rotatorStore: ReturnType<typeof useRotatorStore> | null = null;
try {
  rotatorStore = useRotatorStore();
  console.log('[AzimuthController] Rotator store loaded');
} catch (e) {
  console.warn('[AzimuthController] Rotator store not available:', e);
}

interface Props {
  compassSize?: number;
  sendInterval?: number; // ms between device updates
}

const props = withDefaults(defineProps<Props>(), {
  compassSize: 300,
  sendInterval: 20,
});

const t = useT();

// Use shared antenna state
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

// Continuous change state
const continuousInterval = ref<ReturnType<typeof setInterval> | null>(null);
const shiftPressed = ref(false);

// Handle text input
const handleAzimuthInput = (value: string | number) => {
  const deg = typeof value === 'string' ? parseInt(value, 10) : value;
  if (!isNaN(deg)) {
    setAzimuthDegrees(deg);
  }
};

const handleElevationInput = (value: string | number) => {
  const deg = typeof value === 'string' ? parseInt(value, 10) : value;
  if (!isNaN(deg)) {
    setElevationDegrees(deg);
  }
};

// Continuous change handlers (for holding button)
const startContinuousChange = (
  field: 'azimuth' | 'elevation',
  direction: number
) => {
  const step = shiftPressed.value ? 50 : 5;
  const actualDelta = direction * step;

  if (field === 'azimuth') {
    stepAzimuth(actualDelta, true);
  } else {
    stepElevation(actualDelta);
  }

  continuousInterval.value = setInterval(() => {
    if (field === 'azimuth') {
      stepAzimuth(actualDelta, true);
    } else {
      stepElevation(actualDelta);
    }
  }, 50);
};

const stopContinuousChange = () => {
  if (continuousInterval.value) {
    clearInterval(continuousInterval.value);
    continuousInterval.value = null;
  }
};

// Send data to hardware
const sendData = () => {
  devices.hoz = hozRaw.value;
  devices.ver = verRaw.value;
};

// Keyboard handling
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === 'Shift') {
    shiftPressed.value = true;
    return;
  }

  const step = shiftPressed.value ? 50 : 5;

  switch (e.key) {
    case 'ArrowLeft':
      stepAzimuth(-step, true);
      e.preventDefault();
      break;
    case 'ArrowRight':
      stepAzimuth(step, true);
      e.preventDefault();
      break;
    case 'ArrowUp':
      stepElevation(step);
      e.preventDefault();
      break;
    case 'ArrowDown':
      stepElevation(-step);
      e.preventDefault();
      break;
  }
};

const handleKeyUp = (e: KeyboardEvent) => {
  if (e.key === 'Shift') {
    shiftPressed.value = false;
  }
};

// Setup interval for sending data
useIntervalFn(sendData, props.sendInterval);

// Watch position changes and send to rotator (only if rotator store is available)
if (rotatorStore) {
  watch(
    [azimuthDegrees, elevationDegrees],
    ([az, el]) => {
      if (rotatorStore?.rotatorEnabled && power.value) {
        rotatorStore.setTargetPosition(az, el);
      }
    },
    { immediate: true }
  );

  watch(power, (isPowerOn) => {
    if (isPowerOn && rotatorStore?.rotatorEnabled) {
      rotatorStore.setTargetPosition(azimuthDegrees.value, elevationDegrees.value);
    }
  });
}

// Helper to safely check rotator state
const rotatorEnabled = computed(() => rotatorStore?.rotatorEnabled ?? false);
const rotatorConnected = computed(() => rotatorStore?.isConnected ?? false);
const rotatorConnecting = computed(() => rotatorStore?.isConnecting ?? false);
const rotatorTelemetry = computed(() => rotatorStore?.telemetry ?? null);

// Two-way binding for rotator enable switch
const rotatorEnabledModel = computed({
  get: () => rotatorStore?.rotatorEnabled ?? false,
  set: (v: boolean) => {
    if (rotatorStore) {
      rotatorStore.rotatorEnabled = v;
    }
  }
});

// Two-way binding for rotator host
const rotatorHost = computed({
  get: () => rotatorStore?.configHost ?? '127.0.0.1',
  set: (v: string) => {
    if (rotatorStore) {
      rotatorStore.configHost = v;
    }
  }
});

// Toggle rotator connection
const toggleRotatorConnection = () => {
  if (!rotatorStore) return;
  if (rotatorStore.isConnected) {
    rotatorStore.disconnect();
  } else {
    rotatorStore.connect();
  }
};

// Check if current azimuth is in dead zone (like Pascal app warning)
const isInDeadZone = computed(() => {
  const az = azimuthDegrees.value;
  return az > 164 && az < 196;
});

// Lifecycle
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
  padding: 16px;
  border-radius: 12px;
}

.rotator-panel {
  margin-bottom: 12px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.rotator-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.rotator-switch {
  flex: 0 0 auto;
}

.telemetry-feedback {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 12px;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.feedback-label {
  color: rgba(255, 255, 255, 0.5);
}

.feedback-value {
  color: #4caf50;
  font-weight: 500;
}

.feedback-voltage {
  color: rgba(255, 255, 255, 0.7);
}

.feedback-commands {
  color: rgba(255, 255, 255, 0.5);
  margin-left: auto;
}

.connected-host {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  margin-top: 4px;
}

.compass-container {
  display: flex;
  justify-content: center;
  align-items: center;
}

.elevation-buttons {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
</style>