<script setup lang="ts">
import { ref, computed, watch, onErrorCaptured } from 'vue';
import { useT } from '@/hooks/use-t';
import { debounce } from 'lodash';
import { DEFAULT_ROTATOR_CONFIG } from '@/services/rotator/types';

const t = useT();
const hasError = ref(false);
const errorMessage = ref('');

// Import store directly
import { useRotatorStore } from '@/store/rotator-store';

// Try to initialize the store
let rotatorStore: ReturnType<typeof useRotatorStore> | null = null;
try {
  rotatorStore = useRotatorStore();
  console.log('[RotatorSettings] Store initialized');
} catch (e: any) {
  console.error('[RotatorSettings] Store init error:', e);
  hasError.value = true;
  errorMessage.value = e?.message || String(e);
}

// Local form state (with fallbacks)
const formState = ref({
  host: rotatorStore?.configHost ?? DEFAULT_ROTATOR_CONFIG.host,
  port: rotatorStore?.configPort ?? DEFAULT_ROTATOR_CONFIG.port,
  localPort: rotatorStore?.configLocalPort ?? DEFAULT_ROTATOR_CONFIG.localPort,
  transmitterId: rotatorStore?.configTransmitterId ?? DEFAULT_ROTATOR_CONFIG.transmitterId,
  receiverId: rotatorStore?.configReceiverId ?? DEFAULT_ROTATOR_CONFIG.receiverId,
  sendIntervalMs: rotatorStore?.configSendIntervalMs ?? DEFAULT_ROTATOR_CONFIG.sendIntervalMs,
});

// Only setup watchers if store loaded
if (rotatorStore) {
  watch(
    () => rotatorStore.config,
    (newConfig: any) => {
      formState.value = {
        host: newConfig.host,
        port: newConfig.port,
        localPort: newConfig.localPort,
        transmitterId: newConfig.transmitterId,
        receiverId: newConfig.receiverId,
        sendIntervalMs: newConfig.sendIntervalMs,
      };
    },
    { immediate: true }
  );
}

const saveConfig = () => {
  rotatorStore?.updateConfig(formState.value);
};

const autoSave = debounce(saveConfig, 500, { trailing: true });

watch(() => formState.value.host, autoSave);
watch(() => formState.value.port, autoSave);
watch(() => formState.value.localPort, autoSave);
watch(() => formState.value.transmitterId, autoSave);
watch(() => formState.value.receiverId, autoSave);
watch(() => formState.value.sendIntervalMs, autoSave);

const toggleConnection = () => {
  if (!rotatorStore) return;
  if (rotatorStore.isConnected) {
    rotatorStore.disconnect();
  } else {
    rotatorStore.connect();
  }
};

const resetToDefaults = () => {
  formState.value = { ...DEFAULT_ROTATOR_CONFIG };
  rotatorStore?.resetConfig();
};

const connectionStatusColor = computed(() => {
  if (!rotatorStore) return 'grey';
  switch (rotatorStore.connectionState) {
    case 'connected': return 'success';
    case 'connecting': return 'warning';
    case 'error': return 'error';
    default: return 'grey';
  }
});

const connectionStatusText = computed(() => {
  if (!rotatorStore) return t('Не завантажено');
  switch (rotatorStore.connectionState) {
    case 'connected': return t('Підключено');
    case 'connecting': return t('Підключення...');
    case 'error': return t('Помилка');
    default: return t('Відключено');
  }
});

const isConnected = computed(() => rotatorStore?.isConnected ?? false);
const isConnecting = computed(() => rotatorStore?.isConnecting ?? false);
const rotatorEnabled = computed({
  get: () => rotatorStore?.rotatorEnabled ?? false,
  set: (v: boolean) => { if (rotatorStore) rotatorStore.rotatorEnabled = v; }
});
</script>

<template>
  <VExpansionPanels class="rotator-settings">
    <VExpansionPanel>
      <VExpansionPanelTitle>
        <div class="header-content">
          <span class="header-title">{{ t('Rotator Settings') }}</span>
          <VChip :color="connectionStatusColor" size="small" class="status-chip">
            {{ connectionStatusText }}
          </VChip>
        </div>
      </VExpansionPanelTitle>
      <VExpansionPanelText>
        <!-- Error display -->
        <VAlert v-if="hasError" type="error" class="mb-4">
          Store error: {{ errorMessage }}
        </VAlert>

        <!-- Enable/Disable Switch -->
        <VRow align="center" class="mb-4">
          <VCol cols="12">
            <VSwitch
              v-model="rotatorEnabled"
              :label="t('Enable Rotator Control')"
              color="primary"
              hide-details
              :disabled="hasError"
            />
          </VCol>
        </VRow>

        <!-- Connection Settings -->
        <VRow>
          <VCol cols="12" sm="6">
            <VTextField
              v-model="formState.host"
              :label="t('WIFI232-B2 IP Address')"
              placeholder="192.168.1.200"
              variant="outlined"
              hide-details
              :disabled="isConnected"
            />
          </VCol>
          <VCol cols="12" sm="6">
            <VTextField
              v-model.number="formState.port"
              :label="t('UDP Port')"
              placeholder="24448"
              type="number"
              variant="outlined"
              hide-details
              :disabled="isConnected"
            />
          </VCol>
        </VRow>

        <VRow>
          <VCol cols="12" sm="6">
            <VTextField
              v-model.number="formState.localPort"
              :label="t('Local Port (Telemetry)')"
              placeholder="24449"
              type="number"
              variant="outlined"
              hide-details
              :disabled="isConnected"
            />
          </VCol>
          <VCol cols="12" sm="6">
            <VTextField
              v-model.number="formState.sendIntervalMs"
              :label="t('Send Interval (ms)')"
              placeholder="500"
              type="number"
              variant="outlined"
              hide-details
              :min="100"
              :max="5000"
            />
          </VCol>
        </VRow>

        <!-- Protocol IDs -->
        <VRow>
          <VCol cols="12" sm="6">
            <VTextField
              v-model.number="formState.transmitterId"
              :label="t('Transmitter ID')"
              placeholder="101"
              type="number"
              variant="outlined"
              hide-details
              :disabled="isConnected"
            />
          </VCol>
          <VCol cols="12" sm="6">
            <VTextField
              v-model.number="formState.receiverId"
              :label="t('Receiver ID')"
              placeholder="102"
              type="number"
              variant="outlined"
              hide-details
              :disabled="isConnected"
            />
          </VCol>
        </VRow>

        <!-- Statistics -->
        <VRow class="mt-4" v-if="isConnected && rotatorStore">
          <VCol cols="12">
            <div class="stats-row">
              <span>{{ t('Commands Sent') }}: {{ rotatorStore.commandsSent }}</span>
              <span>{{ t('Telemetry Received') }}: {{ rotatorStore.telemetryReceived }}</span>
            </div>
          </VCol>
        </VRow>

        <!-- Telemetry Display -->
        <VRow v-if="rotatorStore?.telemetry" class="mt-2">
          <VCol cols="12">
            <VAlert type="info" density="compact" variant="tonal">
              <div class="telemetry-info">
                <span>{{ t('Compass') }}: {{ rotatorStore.telemetry.compassDegrees.toFixed(1) }}°</span>
                <span>{{ t('Voltage') }}: {{ rotatorStore.telemetry.voltage.toFixed(2) }}V</span>
              </div>
            </VAlert>
          </VCol>
        </VRow>

        <!-- Error Display -->
        <VRow v-if="rotatorStore?.lastError" class="mt-2">
          <VCol cols="12">
            <VAlert type="error" density="compact" closable @click:close="rotatorStore?.clearError()">
              {{ rotatorStore.lastError.message }}
            </VAlert>
          </VCol>
        </VRow>

        <!-- Action Buttons -->
        <VRow class="mt-4">
          <VCol cols="12" class="d-flex gap-2">
            <VBtn
              :color="isConnected ? 'error' : 'primary'"
              :loading="isConnecting"
              :disabled="hasError"
              @click="toggleConnection"
            >
              {{ isConnected ? t('Відключити') : t('Підключити') }}
            </VBtn>
            <VBtn
              variant="outlined"
              color="secondary"
              @click="resetToDefaults"
              :disabled="isConnected"
            >
              {{ t('Reset to Defaults') }}
            </VBtn>
          </VCol>
        </VRow>
      </VExpansionPanelText>
    </VExpansionPanel>
  </VExpansionPanels>
</template>

<style scoped>
.rotator-settings {
  margin-bottom: 16px;
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.header-title {
  font-weight: 500;
}

.status-chip {
  margin-left: auto;
}

.stats-row {
  display: flex;
  gap: 24px;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.7);
}

.telemetry-info {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}

.gap-2 {
  gap: 8px;
}
</style>
