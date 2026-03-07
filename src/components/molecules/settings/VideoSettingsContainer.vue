<script setup lang="ts">
import { ref, watch, onMounted, reactive, computed, toRefs } from "vue";
import { useStorage } from "@vueuse/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/vue-query";
import { useT } from "@/hooks/use-t";
import { type BaseVideoSettings } from "@/constants/video-settings";
import { useAppSeetingsStore, useConnectionStatus } from "@/store";
import { sleep } from "@/utils";
import { VBtn, VSelect, VSwitch } from "vuetify/components";
import {
  useRPanionVideoSettings,
  useChangeRPanionVideoSettings,
  useRPanionVideoSettingsList,
  useFixRPanionVideo,
  useStopRPanionVideo,
  useRPanionConnection
} from "@/hooks/use-rpanion-api";
import type { VideoSettings, Dev } from "@/services/api/rpanion-service";

enum ACTIONS {
  START,
  STOP,
  RESTART,
}

type Props = {
  isAdvanced?: boolean;
  minimal?: boolean;
};

defineProps<Props>();

const t = useT();
const storageHost = useStorage<string>("host", null);
const storageOwnIp = useStorage<string>("own-ip", null);
const queryClient = useQueryClient();
const videoDevices = ref<Dev[]>([]);
const videoSettingsList = ref<BaseVideoSettings[]>([]);
const selectedVideoSettings = ref<BaseVideoSettings | null>(null);
const connectionStatusStore = useConnectionStatus();
const appSettingsStore = useAppSeetingsStore();
const { isVideoStarted } = toRefs(connectionStatusStore);
const { isDevMode } = toRefs(appSettingsStore);

const BITRATES = [500, 1000, 1500, 2000, 3000, 4000, 5000];

const splitVideoSettings = computed(() => {
  const list = videoSettingsList.value;
  const middle = Math.ceil(list.length / 2);

  return {
    firstColumn: list.slice(0, middle),
    secondColumn: list.slice(middle),
  };
});

async function loadVideoConfig(): Promise<BaseVideoSettings[]> {
  // @ts-ignore
  const isElectron = !!(window && window.process && window.process.versions && window.process.versions.electron);

  if (isElectron) {
    // @ts-ignore
    const { readFileSync } = window.require ? window.require('fs') : require('fs');
    // __dirname points to 'dist' in Electron prod, so assets is next to it
    const { join } = window.require ? window.require('path') : require('path');
    const configPath = join(__dirname, 'assets', 'video-config-buttons.json');
    try {
      const raw = readFileSync(configPath, 'utf8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('Failed to read config file with fs:', err);
      return [];
    }
  } else {
    try {
      const { HttpClient } = await import('@/services/api/http-client');
      const client = new HttpClient({ baseURL: '', debug: false });
      const response = await client.get('/assets/video-config-buttons.json');
      return response.data;
    } catch (err) {
      console.error('Failed to fetch config over HTTP:', err);
      return [];
    }
  }
}

const getTooltipText = (setting: BaseVideoSettings): string => {
  const resolution = `${setting.width}x${setting.height}`;
  const fps = `${setting.fps}${t("fps")}`;
  const bitrate =
    setting.format === "video/x-h264"
      ? t("bitrate unlimited")
      : `${setting.bitrate}${t("kbps")}`;
  return `${resolution}, ${fps}, ${bitrate}`;
};

const settings = reactive({
  videoDevice: "",
  videoResoluton: "",
  host: "",
  port: 0,
});

const isAdvancedMode = ref(false);
const selectedBitrate = ref(0);
const selectedReslution = ref("");

const { data: connectionStatus } = useRPanionConnection(storageHost.value);

const {
  data: videoSettings,
  isFetching: isSettingsLoading,
  isError: isSettingsError,
  refetch: refetchSettings,
} = useRPanionVideoSettings(storageHost.value);

const { data: videoSettingsListData } = useRPanionVideoSettingsList(storageHost.value);

const { mutate: mutateVideoSettings, isPending } = useChangeRPanionVideoSettings(storageHost.value);

const { mutate: mutateStopVideo, isPending: isStoppingVideo } = useStopRPanionVideo(storageHost.value);

const { mutate: hardStopVideo, isPending: isHardStopProcessing } = useFixRPanionVideo(storageHost.value);

const isUnstableDevices = computed(() => {
  return videoDevices.value.some((dev) => dev.value.includes("/dev/video"));
});

const normalVideoStop = async () => {
  await mutateStopVideo();
};

const selectVideoSettingsHandle = async (videoSettinng: BaseVideoSettings) => {
  await mutateStopVideo();
  await sleep(1e3);
  selectedVideoSettings.value = videoSettinng;
  mutateVideoSettings(true);
};

const isActitionsDisabled = computed(() => {
  return isSettingsLoading.value || isHardStopProcessing.value;
});

const isVideoProcessing = computed(() => {
  return (
    isPending.value ||
    isStoppingVideo.value ||
    isHardStopProcessing.value ||
    isSettingsLoading.value
  );
});

const isSettingSelected = (setting: BaseVideoSettings) => {
  if (!videoSettings.value) return false;

  return (
    setting.width === videoSettings.value.width &&
    setting.height === videoSettings.value.height &&
    setting.format === videoSettings.value.format &&
    setting.bitrate === Number(videoSettings.value?.bitrate)
  );
};

const manualResulutions = computed(() => {
  if (!videoSettings.value?._devices) {
    return [];
  }

  return videoSettings.value._devices
    .find(({ value }) => value !== "testsrc")
    ?.caps.filter((cap) => cap.label.includes("jpeg"))
    .map((cap) => cap.label.split(" ")[0])
    .filter((res) => +res.split("x")[0] <= 1000);
});

const createManualSettings = (): BaseVideoSettings => ({
  label: "manual",
  width: +selectedReslution.value.split("x")[0],
  height: +selectedReslution.value.split("x")[1],
  bitrate: selectedBitrate.value,
  fps: 30,
  format: "image/jpeg",
});

const applyManualSettings = () => {
  selectedVideoSettings.value = createManualSettings();
  selectVideoSettingsHandle(selectedVideoSettings.value);
  console.log("Apply manual resolution");
};

watch(videoSettings, async () => {
  isVideoStarted.value = videoSettings.value?._status || false;

  if (videoSettings.value?.useUDPIP) {
    settings.host = videoSettings.value.useUDPIP;
  }

  if (videoSettings.value?.useUDPPort) {
    settings.port = videoSettings.value.useUDPPort;
  }

  if (videoSettings.value?._devices) {
    videoDevices.value = videoSettings.value._devices;
    try {
      const list = await loadVideoConfig();
      videoSettingsList.value = list.length ? list : (videoSettingsListData.value || []);
    } catch (err) {
      videoSettingsList.value = videoSettingsListData.value || [];
    }

    selectedVideoSettings.value =
        videoSettingsList.value.find(
            (vs) => vs.width === videoSettings.value.width
        ) || null;
  }
});

watch(connectionStatus, () => {
  if (connectionStatus.value) {
    console.log("CONNECTED");
    refetchSettings();
  } else {
    console.log("DISCONNECTED");
  }
});

onMounted(async () => {
  try {
    const list = await loadVideoConfig();
    videoSettingsList.value = list.length ? list : (videoSettingsListData.value || []);
  } catch (err) {
    videoSettingsList.value = videoSettingsListData.value || [];
  }
});

</script>

<template>
    <VExpansionPanels class="video-settings-root">
      <VExpansionPanel>
        <VExpansionPanelTitle>
          <div class="header-content">
            <span class="header-title">{{ t("Video Settings") }}</span>
            <VChip
                v-if="!connectionStatus"
                color="warning"
                dense
                text
                class="status-chip"
            >
              {{ t("Missed connection, video settings not available") }}
            </VChip>
          </div>
        </VExpansionPanelTitle>
        <VExpansionPanelText>

          <h4 v-if="connectionStatus && !isAdvanced">{{ t("Video settings") }}</h4>

          <div class="main-container">
            <!-- First Row: Video Presets and Actions -->
            <div class="first-row" v-if="splitVideoSettings || connectionStatus || isAdvanced">
              <!-- Video Presets -->
              <div class="presets-columns">
                <!-- First Column -->
                <div class="presets-column">
                  <VTooltip
                    v-for="setting in splitVideoSettings.firstColumn"
                    :key="setting.label"
                    :text="getTooltipText(setting)"
                  >
                    <template v-slot:activator="{ props }">
                      <VBtn
                        v-bind="props"
                        class="video-settings-button"
                        :color="isSettingSelected(setting) ? 'save' : 'inherit'"
                        :loading="isVideoProcessing"
                        @click="selectVideoSettingsHandle(setting)"
                      >
                        {{ t(setting.label) }}
                      </VBtn>
                    </template>
                  </VTooltip>
                </div>
                <!-- Second Column -->
                <div class="presets-column">
                  <VTooltip
                    v-for="setting in splitVideoSettings.secondColumn"
                    :key="setting.label"
                    :text="getTooltipText(setting)"
                  >
                    <template v-slot:activator="{ props }">
                      <VBtn
                        v-bind="props"
                        class="video-settings-button"
                        :color="isSettingSelected(setting) ? 'green' : 'inherit'"
                        :loading="isVideoProcessing"
                        @click="selectVideoSettingsHandle(setting)"
                      >
                        {{ t(setting.label) }}
                      </VBtn>
                    </template>
                  </VTooltip>
                </div>
              </div>

              <!-- Video Actions -->
              <div class="actions-column">
                <VBtn
                  class="video-settings-button"
                  color="warning"
                  @click="normalVideoStop"
                  :loading="isVideoProcessing"
                >
                  {{ t("Stop video") }}
                </VBtn>

                <VBtn
                  v-if="isDevMode"
                  class="video-settings-button"
                  color="warning"
                  @click="hardStopVideo"
                  :disabled="isActitionsDisabled"
                >
                  {{ t("Hard video stop") }}
                </VBtn>
              </div>
            </div>

            <!-- Second Row: Manual Settings -->
            <div class="second-row">
              <VSwitch
                inset
                v-model="isAdvancedMode"
                :label="t('Manual model, may efect on latency')"
                class="video-settings-button"
                color="primary"
              ></VSwitch>

              <div v-if="isAdvancedMode" class="manual-settings">
                <VSelect
                  variant="outlined"
                  v-model="selectedBitrate"
                  :items="BITRATES"
                  :label="t('Bitrate')"
                />
                <VSelect
                  variant="outlined"
                  v-model="selectedReslution"
                  :items="manualResulutions"
                  :label="t('Resolution')"
                />

                <div v-if="selectedBitrate && selectedReslution">
                  <VBtn color="save" :loading="isVideoProcessing" @click="applyManualSettings">{{
                    t("Apply")
                  }}</VBtn>
                </div>
              </div>
            </div>

            <div
              class="indicator-block"
              v-if="
                !minimal && !isUnstableDevices && (connectionStatus || isAdvanced)
              "
            >
              <div>
                <VAlert :color="isVideoStarted ? 'green' : 'red'" class="alert">
                  <span v-if="isVideoStarted">{{ t("Video starded") }}</span>
                  <span v-else>{{ t("Video not started") }}</span>
                  <VProgressCircular
                    v-if="isSettingsLoading"
                    class="loading-indicator"
                    indeterminate
                  ></VProgressCircular>
                </VAlert>
              </div>

              <VBtn v-if="isSettingsError" color="red">
                {{ t("Error, click for try again") }}
              </VBtn>
            </div>
          </div>
        </VExpansionPanelText>
      </VExpansionPanel>
    </VExpansionPanels>
</template>

<style scoped>
.root {
  padding: 10px;
}

.video-settings-button {
  margin: 0;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  text-align: left;
  padding: 0 16px;
  min-width: 160px;
  width: 100%;
}

/* Custom Header for Expansion Panel */
.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.main-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.first-row {
  display: flex;
  gap: 20px;
  align-items: flex-start;
}

.presets-columns {
  display: flex;
  gap: 20px;
  width: 100%;
}

.presets-column {
  display: flex;
  flex-direction: column;
  gap: 10px;
  flex: 1;
}

.actions-column {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.second-row {
  border-top: 1px solid #ccc;
  padding-top: 20px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.manual-settings {
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.loading-indicator {
  margin-left: 10px;
}

.v-expansion-panel-title {
  height: 64px;
}
</style>
