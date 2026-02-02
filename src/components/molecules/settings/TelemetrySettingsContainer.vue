<template>
  <VExpansionPanels class="container">
    <VExpansionPanel>
      <VExpansionPanelTitle>
        <div class="header-content">
          <span class="header-title">{{ t("Telemetry settings") }}</span>
          <!-- Show a chip if the PC isn’t set for this module -->
          <div class="status-container">
            <VChip
                v-if="isSettingsDirrefend"
                color="warning"
                dense
                text
                class="status-chip"
            >
              {{ t("Your PC not set for this module") }}
            </VChip>
            <VChip
                :color="statusColor"
                dense
                text
                class="status-chip"
            >
              <span>{{ statusText }}</span>
              <VProgressCircular
                  v-if="isFetching"
                  class="loading-indicator"
                  indeterminate
                  size="20"
              ></VProgressCircular>
            </VChip>
          </div>
        </div>
      </VExpansionPanelTitle>
      <VExpansionPanelText>

        <VRow class="buttons-row" dense>
          <VCol cols="6">
            <VBtn
                class="button"
                v-if="!telemerySettings.telemetryStatus"
                :loading="isSomethisLoading"
                block
                @click="startStopTelemetry(true)"
                color="primary"
            >
              {{ t("Enable telemetry") }}
            </VBtn>
            <VBtn
                class="button"
                v-else
                :loading="isSomethisLoading"
                block
                @click="startStopTelemetry(false)"
                color="primary"
            >
              {{ t("Disable telemetry") }}
            </VBtn>
          </VCol>
          <VCol cols="6">
            <VBtn
                class="button"
                color="warning"
                v-if="isError"
                @click="refetch"
                :loading="isFetching"
                block
            >
              {{ t("SHOW Error") }}
            </VBtn>
          </VCol>
        </VRow>

        <!-- Status Alert Row -->

        <!-- Advanced Settings: Data Table -->
        <VRow v-if="isAdvancesSettings" dense>
          <VCol cols="12">
            <VDataTable
                :headers="table.headers"
                :items="table.data"
                :loading="isFetching"
            />
          </VCol>
        </VRow>
      </VExpansionPanelText>
    </VExpansionPanel>
  </VExpansionPanels>
</template>

<script lang="ts" setup>
import { useT } from '@/hooks/use-t';
import { useStorage } from '@vueuse/core';
import { computed } from 'vue';
import { 
  useRPanionTelemetrySettings, 
  useChangeRPanionTelemetrySettings 
} from '@/hooks/use-rpanion-api';
import type { TelemetrySettings } from '@/services/api/rpanion-service';

const t = useT();
const storageHost = useStorage<string>('host', null);
const ownIp = useStorage<string>('own-ip', null);

type Props = {
    isAdvancesSettings: boolean,
}

defineProps<Props>();

const { data: telemerySettings, isFetching, isError, refetch } = useRPanionTelemetrySettings(storageHost.value);

const { mutate: startStopTelemetry, isPending: isSettingsChangesLoading, isError: isSettingsChangeError } = useChangeRPanionTelemetrySettings(storageHost.value);

const isSomethisLoading = computed(() => (
    isFetching.value || isSettingsChangesLoading.value
))

const isSettingsDirrefend = computed(() => {
    return !telemerySettings.value.outputs.some(o => o.IPPort.includes(ownIp.value));
})

const statusColor = computed(() => {
    if (telemerySettings.value.telemetryStatus) {
        return 'green'
    }

    if (!telemerySettings.value.telemetryStatus) {
        return 'red';
    }

    return '';
});

const statusText = computed(() => {
    if (telemerySettings.value.telemetryStatus) {
        return t('Telemetry started');
    }

    if (!telemerySettings.value.telemetryStatus) {
        return t('Telemetry not started');
    }

    return '';
})


const table = computed(() => {
    const headers = [
        { title: 'Key', key: 'key' },
        { title: 'Value', value: 'value' }
    ];
    const dataObject = { ...telemerySettings.value };

    const data = Object.entries(dataObject).map(([key, value]) => ({
        key, value
    }))

    return {
        headers,
        data,
    }
});

</script>

<style scoped>

/* Header Styling (consistent with other blocks) */
.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

/* Buttons Row Styling */
.buttons-row {
  margin-bottom: 16px;
}
.buttons-row > .v-col {
  padding: 8px;
}
.button {
  margin: 5px;
}

/* Status Alert Row Styling */
.status-row {
  margin-bottom: 16px;
}
.status-alert {
  display: flex;
  justify-content: center;
  align-items: center;
}
.loading-indicator {
  margin-left: 8px;
}

/* Input Section Styling */
.input-row {
  margin-top: 16px;
}
.input-row > .v-col {
  padding: 8px;
}

.v-expansion-panel-title {
  height: 64px;
}

.status-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}
</style>