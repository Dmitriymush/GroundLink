<template>
  <VContainer class="remote-control-container v-container" fluid>
    <VRow dense>
      <VCol cols="12" md="6">
        <VCard flat class="pa-4">
          <joystic-select
              v-model:active-joystic="selectedJoystic"
              :allow-all-devices="allowAllDevices"
              @disable="selectedJoystic = null"
          />
        </VCard>
      </VCol>

      <VCol cols="12" md="6">
        <VCard flat class="pa-4">
          <VSwitch
              inset
              v-model="allowAllDevices"
              :label="t('Allow all devices')"
              color="primary"
              hide-details
          />
        </VCard>
      </VCol>
    </VRow>

    <VideoSettingsContainer :is-advanced="false" minimal class="block-card"/>

    <VExpansionPanels v-model="panel" multiple>
      <VExpansionPanel :readonly="!droneControllEnable" value="DCC" class="block-card">
        <VExpansionPanelTitle>
          <div class="header-content">
            <span class="header-title">{{ t("Drone Channel Control") }}</span>
              <VSwitch
                  inset
                  v-model="droneControllEnable"
                  color="primary"
                  @update:modelValue="(val) => togglePanel('DCC', !!val)"
                  hide-details
                  @click.stop
              />
          </div>
        </VExpansionPanelTitle>
        <VExpansionPanelText>
          <ChanellControll :external-enable="true" />
        </VExpansionPanelText>
      </VExpansionPanel>

      <VExpansionPanel :readonly="!showControlls" value="JCA" class="block-card">
        <VExpansionPanelTitle>
          <div class="header-content">
            <span class="header-title">{{ t("Joystick Channel Activity") }}</span>
            <VSwitch
                inset
                v-model="showControlls"
                color="primary"
                hide-details
                @update:modelValue="(val) => togglePanel('JCA', !!val)"
                @click.stop
            />
          </div>
        </VExpansionPanelTitle>
        <VExpansionPanelText>
          <joystic-controlls />
        </VExpansionPanelText>
      </VExpansionPanel>
    </VExpansionPanels>
  </VContainer>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from "vue";
import JoysticControlls from "../remote_controll/JoysticControlls.vue";
import { devices } from "@/controllers/devices";
import JoysticSelect from "../remote_controll/JoysticSelect.vue";
import type { Device } from "node-hid";
import { useT } from "@/hooks/use-t";
import ChanellControll from "../molecules/ChanellControll.vue";
import VideoSettingsContainer from "../molecules/settings/VideoSettingsContainer.vue";
import { useDroneControll } from "@/hooks/drone-controll";

const status = ref(false);
const selectedJoystic = ref<any>();
const showControlls = ref<boolean>(true);
const t = useT();
const allowAllDevices = ref<boolean>(false);

const {
  droneControllEnable,
} = useDroneControll();
const state = Buffer.alloc(1);

const setJoysticStatus = (currentStatus: boolean): void => {
  status.value = currentStatus;
};

const panel = ref<string[]>([]);

if (droneControllEnable) {

  panel.value.push('DCC');
}

if (showControlls) {

  panel.value.push('JCA');
}

const togglePanel = (panelId: string, isEnabled: boolean) => {
  if (!Array.isArray(panel.value)) {
    panel.value = [];
  }

  if (isEnabled) {
    if (!panel.value.includes(panelId)) {
      panel.value.push(panelId);
    }
  } else {
    panel.value = panel.value.filter(id => id !== panelId);
  }
};

watch(selectedJoystic, (joystic: Device) => {
  console.log("selectedJoystic", joystic);

  if (state[0] === 0x01) {
    state[0] = 0x00
    return;
  }

  devices.stop();
  devices.setDevice(joystic);
});

onMounted(() => {
  devices.on("status", setJoysticStatus);
  state[0] = 0x01;
  selectedJoystic.value = devices.device;
});

onBeforeUnmount(() => {
  devices.off("status", setJoysticStatus);
});
</script>

<style scoped>

.remote-control-container {
    width: 100%;
    padding: 10px;
    margin-top: 30px;
}

.remote-control-container .v-card {
  height: 100%;
}

</style>
