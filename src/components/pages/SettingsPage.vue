<script setup lang="ts">
import { ref, reactive, onBeforeMount, watch, computed } from "vue";
import { useT } from "@/hooks/use-t";
import { useStorage } from "@vueuse/core";
import { debounce } from "lodash";
import HostSearchModal from "../molecules/HostSearchModal.vue";
import OwnIpSearchModal from "../molecules/OwnIpSearchModal.vue";
import VideoSettingsContainer from "@/components/molecules/settings/VideoSettingsContainer.vue";
import TelemetrySettingsContainer from "@/components/molecules/settings/TelemetrySettingsContainer.vue";
import RpiSystemSettings from "@/components/molecules/settings/RpiSystemSettings.vue";
import SiteSettings from "../molecules/settings/SiteSettings.vue";
import { FEATURES } from "@/constants/features";
import { getAllowedFeatures } from "@/utils";
import { useAppSeetingsStore } from "@/store";
import ConnectionSettings from "@/components/molecules/settings/ConnectionSettings.vue";
import MixerSettings from "../molecules/settings/MixerSettings.vue";
import MainJrSettings from "../molecules/settings/MainJrSettings.vue";
import ModemControllSettings from "../molecules/settings/ModemControllSettings.vue";

const DEFAULT_PORT = 27015;
const DEFAULT_SECOND_PORT = 27016;

const appSettingsStore = useAppSeetingsStore();

const t = useT();
const openSearchModal = ref<boolean>(false);
const openOwnIpSearchModal = ref<boolean>(false);
const storageHost = useStorage<string>("host", null);
const storagePort = useStorage<number>("port", 27015);
const storageOwnIp = useStorage<string>("own-ip", null);
const storageSecondPort = useStorage<number>("second-port", 27016);

const initalValues = reactive({
  host: storageHost.value || "",
  port: storagePort.value || DEFAULT_PORT,
  ownIp: storageOwnIp.value || "",
  secondPort: storageSecondPort.value || DEFAULT_SECOND_PORT,
});

const allowedFeatures = getAllowedFeatures();

const restoreValues = () => {
  initalValues.host = storageHost.value || "";
  initalValues.port = storagePort.value || DEFAULT_PORT;
  initalValues.ownIp = storageOwnIp.value || "";
  initalValues.secondPort = storageSecondPort.value || DEFAULT_SECOND_PORT;
};

onBeforeMount(() => {
  restoreValues();
});

const autoPortHandle = () => {
  initalValues.port = DEFAULT_PORT;
};

const autoHostHandle = (ip: string | null) => {
  openSearchModal.value = false;

  if (ip != null) {
    initalValues.host = ip;
    storageHost.value = ip;
  }
};

const autoOwnHostHandle = (ip: string | null) => {
  openOwnIpSearchModal.value = false;

  if (ip != null) {
    initalValues.ownIp = ip;
    storageOwnIp.value = ip;
  }
};

const saveHandle = () => {
  storageHost.value = initalValues.host;
  storagePort.value = initalValues.port;
  storageOwnIp.value = initalValues.ownIp;
  storageSecondPort.value = initalValues.secondPort;
};

const autoSave = debounce(saveHandle, 5e2, { trailing: true });

const isTelemetryAvalible = computed(() =>
  allowedFeatures.includes(FEATURES.TELEMETRY)
);

const isRemoteControllAvalible = computed(() => {
  return allowedFeatures.includes(FEATURES.REMOTE_CONTROLL);
});

const isModemControllAvalible = computed(() => {
  return allowedFeatures.includes(FEATURES.MODEM_CONTROLL);
});

watch(() => initalValues.host, autoSave);

watch(() => initalValues.port, autoSave);

watch(() => initalValues.ownIp, autoSave);

watch(() => initalValues.secondPort, autoSave);

watch(
  () => appSettingsStore.selectedConnection,
  () => {
    setTimeout(() => restoreValues(), 1);
  }
);
</script>

<template>
  <VContainer fluid>
    <!-- Header -->
    <div class="header-title settings-header">
      <div class="title">
        <span>{{ t("Settings") }}</span>
      </div>
      <div class="advanced-switch">
        <VBtnToggle
            v-model="appSettingsStore.isDevMode"
            mandatory
            class="advanced-toggle"
        >
          <VBtn
              variant="outlined"
              :value="false"
              color="primary"
          >
            <VIcon
                icon="mdi-widgets"
                start
            ></VIcon>
            {{ t("ЗВИЧАЙНI") }}
          </VBtn>
          <VBtn
              variant="outlined"
              :value="true"
              color="primary"
          >
            {{ t("Advanced") }}
            <VIcon
                icon="mdi-wrench"
                end
            ></VIcon>
          </VBtn>
        </VBtnToggle>
      </div>
    </div>

    <!-- Combined Quick Access Block -->
    <div class="settings-container">
      <VCard outlined class="block-card">
        <VCardTitle class="header-title">
          {{ t("Quick Access Settings") }}
        </VCardTitle>
        <VCardText class="quick-access-text">
          <VRow dense justify="center">
            <VCol cols="12" md="6">
              <ConnectionSettings />
            </VCol>
            <VCol cols="12" md="6">
              <SiteSettings />
            </VCol>
          </VRow>
        </VCardText>
      </VCard>

      <!-- Other Blocks arranged in two columns on larger screens -->
      <VRow>
        <VCol cols="12" md="6">
          <!-- Connection Settings Block -->
          <VExpansionPanels class="block-card connection-settings-root" v-if="appSettingsStore.isDevMode">
            <VExpansionPanel>
              <VExpansionPanelTitle>
                <div class="header-content">
                  <span class="header-title">{{ t("Connection Settings") }}</span>
                  <!-- Optional: add a status indicator here if needed -->
                </div>
              </VExpansionPanelTitle>
              <VExpansionPanelText>
                <VRow align="center">
                  <VCol cols="12" sm="6">
                    <div class="input-group">
                      <VTextField
                          variant="outlined"
                          label="Host"
                          placeholder="Host"
                          hide-details
                          v-model="initalValues.host"
                      />
                      <VBtn color="primary" class="auto-btn" @click="openSearchModal = true">
                        {{ t("Auto") }}
                      </VBtn>
                    </div>
                  </VCol>
                  <VCol cols="12" sm="6" v-if="appSettingsStore.isDevMode">
                    <div class="input-group">
                      <VTextField
                          variant="outlined"
                          label="Operator IP"
                          placeholder="IP"
                          hide-details
                          v-model="initalValues.ownIp"
                      />
                      <VBtn color="primary" class="auto-btn" @click="openOwnIpSearchModal = true">
                        {{ t("Auto") }}
                      </VBtn>
                    </div>
                  </VCol>
                  <VCol cols="12" sm="6" v-if="appSettingsStore.isDevMode">
                    <div class="input-group">
                      <VTextField
                          variant="outlined"
                          label="Port"
                          type="number"
                          placeholder="27015"
                          hide-details
                          v-model="initalValues.port"
                      />
                      <VBtn color="primary" class="auto-btn" @click="autoPortHandle">
                        {{ t("Auto") }}
                      </VBtn>
                    </div>
                  </VCol>
                  <VCol cols="12" sm="6" v-if="appSettingsStore.isDevMode">
                    <div class="input-group">
                      <VTextField
                          variant="outlined"
                          label="Second Port"
                          type="number"
                          placeholder="27016"
                          hide-details
                          v-model="initalValues.secondPort"
                      />
                    </div>
                  </VCol>
                </VRow>
              </VExpansionPanelText>
            </VExpansionPanel>
          </VExpansionPanels>

          <RpiSystemSettings class="block-card"/>

          <MixerSettings class="block-card"/>

          <MainJrSettings class="block-card"/>

          <!-- Save Button Block -->
        </VCol>

        <VCol cols="12" md="6">

          <!-- Video Settings Block -->
          <VideoSettingsContainer class="block-card" :is-advances-settings="appSettingsStore.isDevMode" />

          <ModemControllSettings class="block-card"/>
          <!-- Telemetry Settings Block -->
          <TelemetrySettingsContainer v-if="isTelemetryAvalible" class="block-card"
              :is-advances-settings="appSettingsStore.isDevMode"
          />

          <!-- Remote Control Blocks -->
        </VCol>
      </VRow>
    </div>

    <div class="save-section">
      <VBtn color="save" class="save-btn" @click="saveHandle">{{ t("Save") }}</VBtn>
    </div>

    <!-- Modals -->
    <HostSearchModal :open="openSearchModal" @save="autoHostHandle" />
    <OwnIpSearchModal
        :open="openOwnIpSearchModal"
        :is-advanced="appSettingsStore.isDevMode"
        @save="autoOwnHostHandle"
    />
  </VContainer>
</template>

<style scoped>

.v-container {
  display: flex;
  flex-direction: column;
}

.settings-container {
  display: flex;
  flex-direction: column;
  height: 90%;
  max-height: 90%;
  overflow-x: hidden;
  overflow-y: auto;
}

.quick-access-text {
  text-align: center;
}

.settings-header {
  display: flex;
  gap: 24px;
  align-items: center;
  margin-bottom: 24px;
}

.title span {
  font-size: 24px;
  font-weight: bold;
}


.input-group {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}

.auto-btn {
  margin-left: 8px;
}

.save-section {
  position: relative;
  text-align: center;
  margin-top: 16px;
  border: 100px;
  width: 100%;
  z-index: 1000;
  padding: 8px 16px;
  bottom: 0;
  align-self: flex-end;
}

.save-btn {
  height: 100%;
  padding: 12px 24px;
  font-size: 18px;
}

@media (min-width: 768px) {
  .input-group {
    margin-bottom: 20px;
  }
}
</style>