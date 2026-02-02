<script setup lang="ts">
import { ref } from "vue";
import { useT } from "@/hooks/use-t";
import { useInitiatorConnection, useInitiatorDevicesList, useSetInitiatorDeviceCommand } from "@/hooks/use-initiator-api";
import type { Device } from "@/services/api/initiator-service";

type ErrorResponse = {
  error: string;
};
import { useAppSeetingsStore } from "@/store/app-settings-store";
import { storeToRefs } from "pinia";
import ErrorModal from "@/components/modals/ErrorModal.vue";
import ConfigmModal from "@/components/modals/ConfigmModal.vue";

const t = useT();
const error = ref<string | null>(null);
const isGlobalResetting = ref(false);
const deviceStates = ref<{
  [key: string]: {
    fuseReleased: boolean;
    isDetonating: boolean;
    fuseLoading: boolean;
    detonateLoading: boolean;
  };
}>({});
const confirmationDevice = ref<Device | null>(null);

const appSettingsStore = useAppSeetingsStore();
const { selectedConnection } = storeToRefs(appSettingsStore);

// Ping query to check connection status
const { data: isConnectionOk } = useInitiatorConnection(
  selectedConnection.value?.initiatorServerEndpoint
);

const { data: devices, isLoading } = useInitiatorDevicesList(
  selectedConnection.value?.initiatorServerEndpoint
);

const initDeviceState = (device: Device) => {
  if (!deviceStates.value[device.id]) {
    deviceStates.value[device.id] = {
      fuseReleased: false,
      isDetonating: false,
      fuseLoading: false,
      detonateLoading: false,
    };
  }
};

const { mutate: setDeviceCommand, isPending: commandLoading } = useSetInitiatorDeviceCommand(
  selectedConnection.value?.initiatorServerEndpoint
);

const toggleFuse = async (device: Device) => {
  try {
    initDeviceState(device);
    deviceStates.value[device.id].fuseLoading = true;
    const newState = !deviceStates.value[device.id].fuseReleased;
    
    setDeviceCommand({
      deviceId: device.id,
      command: newState ? "release_fuse" : "lock_fuse"
    });
    
    deviceStates.value[device.id].fuseReleased = newState;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Fuse operation failed";
  } finally {
    deviceStates.value[device.id].fuseLoading = false;
  }
};

const openConfirmation = (device: Device) => {
  initDeviceState(device);
  if (deviceStates.value[device.id].fuseReleased) {
    confirmationDevice.value = device;
  }
};

const detonate = async (device: Device) => {
  try {
    initDeviceState(device);
    deviceStates.value[device.id].detonateLoading = true;
    setDeviceCommand({
      deviceId: device.id,
      command: "1800,0,1800"
    });
    deviceStates.value[device.id].isDetonating = true;
    confirmationDevice.value = null;
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Detonation failed";
    deviceStates.value[device.id].isDetonating = false;
    confirmationDevice.value = null;
  } finally {
    deviceStates.value[device.id].detonateLoading = false;
  }
};

const cancelDetonation = () => {
  confirmationDevice.value = null;
};

const resetAll = async () => {
  try {
    isGlobalResetting.value = true;
    // TODO: Add broadcast command hook when available
    // await intiatorApi.broadcastCommand("");

    for (const device of devices.value!) {
      setDeviceCommand({
        deviceId: device.id,
        command: ""
      });

      if (deviceStates.value[device.id]) {
        deviceStates.value[device.id].fuseReleased = false;
        deviceStates.value[device.id].isDetonating = false;
      }
    }
    // Reset all device states
  } catch (err) {
    error.value = err instanceof Error ? err.message : "Reset failed";
  } finally {
    isGlobalResetting.value = false;
  }
};

const closeError = () => {
  error.value = null;
};
</script>

<template>
  <v-container class="bomb-page">
    <v-row>
      <v-col v-if="isLoading" cols="12" class="text-center">
        <v-progress-circular indeterminate color="primary" />
      </v-col>
      <v-col
        cols="12"
        class="d-flex px-4 gap-4"
        style="justify-content: space-between"
      >
        <v-chip
          :color="isConnectionOk ? 'success' : 'error'"
          size="small"
          class="font-weight-medium elevation-2"
        >
          {{ t(isConnectionOk ? "Has connection" : "No connection") }}
        </v-chip>
        <v-btn
          variant="text"
          :loading="isGlobalResetting"
          :disabled="isLoading || !selectedConnection?.initiatorServerEndpoint"
          :prepend-icon="isGlobalResetting ? undefined : 'mdi-refresh'"
          @click="resetAll"
        >
          {{ t("Reset all devices") }}
        </v-btn>
      </v-col>

      <v-col
        v-if="!selectedConnection?.initiatorServerEndpoint"
        cols="12"
        class="text-center"
      >
        <v-alert type="warning">
          {{ t("Please configure connection settings first") }}
        </v-alert>
      </v-col>

      <v-col v-for="device in devices" :key="device.id" cols="12" sm="6" md="4">
        <v-card class="pa-4">
          <v-card-title class="text-center">
            {{ device.id }}
          </v-card-title>

          <v-card-text>
            <v-row justify="center" class="mb-6">
              <v-col cols="12" class="text-center">
                <v-switch
                  :model-value="deviceStates[device.id]?.fuseReleased ?? false"
                  :label="t('Release fuse')"
                  :loading="deviceStates[device.id]?.fuseLoading"
                  color="error"
                  hide-details
                  @update:model-value="() => toggleFuse(device)"
                />
              </v-col>
            </v-row>

            <v-row justify="center">
              <v-col cols="12" class="text-center">
                <v-btn
                  :disabled="
                    !deviceStates[device.id]?.fuseReleased ||
                    deviceStates[device.id]?.isDetonating
                  "
                  color="error"
                  size="x-large"
                  :loading="deviceStates[device.id]?.detonateLoading"
                  @click="() => openConfirmation(device)"
                >
                  {{
                    deviceStates[device.id]?.isDetonating
                      ? t("Detonate in process")
                      : t("Detonate")
                  }}
                </v-btn>

                <div
                  v-if="deviceStates[device.id]?.fuseReleased"
                  class="text-error mt-4"
                >
                  {{ t("Warning! Fuse is released") }}
                </div>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <ErrorModal :error="error" @close="closeError" />
    <ConfigmModal
      v-if="confirmationDevice"
      :text="t('Are you sure you want to detonate this device?')"
      @on-success="() => detonate(confirmationDevice!)"
      @on-cancel="cancelDetonation"
    />
  </v-container>
</template>

<style scoped>
.bomb-page {
  height: 100%;
  display: flex;
}
</style>
