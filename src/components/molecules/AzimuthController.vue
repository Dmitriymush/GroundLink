<template>
  <VCard class="azimuth-controller" color="background" elevation="2">
    <VCardText>
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
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useIntervalFn } from '@vueuse/core';
import { useT } from '@/hooks/use-t';
import { useAntennaState } from '@/hooks/use-antenna-state';
import { devices } from '@/controllers/devices';
import AzimuthCompass from '@/components/atoms/AzimuthCompass.vue';

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