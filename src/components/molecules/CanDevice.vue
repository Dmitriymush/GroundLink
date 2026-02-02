<template>
  <VCard class="card">
    <VCardTitle class="card-title">
      <div>{{ type }} {{ device.id }}</div>
      <div>
        <StatusIcon :tooltip="statusText" :status="device.online" />
      </div>
    </VCardTitle>
    <VCardText>
      <div class="battery-info">
        <div>{{ t("Battery voltage") }}</div>
        <div>{{ device.droneVoltage }}V</div>
      </div>

      <div class="battery-info" v-if="isBox">
        <div>{{ t("Drone enable state") }}</div>
        <div>{{ device.droneState ? t("Enabled") : t("Disabled") }}</div>
      </div>

      <div class="battery-info" v-if="isBox">
        <div>{{ t("Box enable state") }}</div>
        <div>{{ device.relayState ? t("Enabled") : t("Disabled") }}</div>
      </div>

      <div class="battery-info" v-if="isBox">
        <div>{{ t("Lead state") }}</div>
        <div>{{ device.leadOpen ? t("Open") : t("Closed") }}</div>
      </div>

      <div class="battery-info" v-if="device.type === CAN_DEVICE_TYPE.ANTENA">
        <div>{{ t("Anten enable state") }}</div>
        <div>{{ device.relayState ? t("Enabled") : t("Disabled") }}</div>
      </div>

      <div class="battery-info" v-if="false">
        <div>{{ t("Cartridge state") }}</div>
        <div>{{ device.cartridgeState }}</div>
      </div>
    </VCardText>

    <VCardActions class="card-actions">
      <div
        v-if="
          device.type === CAN_DEVICE_TYPE.BOX ||
          device.type === CAN_DEVICE_TYPE.REUSABLE_BOX
        "
      >
        <VBtn
          class="action-button"
          :loading="isPending"
          :color="!device.relayState ? 'red' : 'green'"
          :disabled="!device.online"
          variant="outlined"
          @click="changeBoxState"
        >
          {{ openBoxText }}
        </VBtn>

        <VBtn
          class="action-button"
          :color="!device.droneState ? 'red' : 'green'"
          :disabled="!device.online"
          :loading="isPending"
          variant="outlined"
          @click="changeDroneState"
        >
          {{ openDroneText }}
        </VBtn>

        <VBtn
          class="action-button"
          variant="outlined"
          :color="!device.leadOpen ? 'red' : 'green'"
          :loading="isPending"
          :disabled="!device.online"
          @click="changeLeadState"
        >
          {{ !device.leadOpen ? t("Open lead") : t("Close lead") }}
        </VBtn>

        <VBtn
          v-if="false"
          color="warning"
          @click="testCartrigde"
          :loading="isPending"
          disabled
        >
          {{ t("Test cartrigde") }}
        </VBtn>
      </div>

      <div v-if="device.type === CAN_DEVICE_TYPE.ANTENA">
        <VBtn
          :color="!device.relayState ? 'warning' : 'save'"
          :disabled="!device.online"
          variant="outlined"
          @click="enableAntenna"
          :loading="isPending"
        >
          {{ enableAntenaText }}
        </VBtn>
      </div>
    </VCardActions>

    <audio ref="audio" src="/alert.mp3"></audio>
    <audio ref="audioConnected" src="/connected.mp3"></audio>

    <ConfigmModal
      :text="confirmModal.text"
      @onSuccess="confirmModal.onSuccess"
      @onCancel="confirmModal.onCancel"
    />
  </VCard>
</template>

<script setup lang="ts">
import { CAN_DEVICE_TYPE } from "@/constants/can-devices";
import { useT } from "@/hooks/use-t";
import type { CanDevice } from "@/store";
import { computed, reactive, ref, watch } from "vue";
import StatusIcon from "../atoms/StatusIcon.vue";
import { sleep } from "@/utils";
import { VBtn } from "vuetify/components";
import ConfigmModal from "../modals/ConfigmModal.vue";
import { 
  useTestCanCartridge, 
  useChangeCanRelayState, 
  useChangeCanLeadState 
} from "@/hooks/use-hardware-api";

type Props = {
  device: CanDevice;
};

const t = useT();
const props = defineProps<Props>();
const audio = ref<HTMLAudioElement | null>(null);
const audioConnected = ref<HTMLAudioElement | null>(null);
const confirmModal = reactive({
  text: "",
  onSuccess: () => void 0,
  onCancel: () => void 0,
});

const { mutate: testCartridge, isPending: testCartridgeLoading } = useTestCanCartridge();
const { mutate: changeCanRelayState, isPending: changeRelayLoading } = useChangeCanRelayState();
const { mutate: changeCanLeadState, isPending: changeLeadLoading } = useChangeCanLeadState();

const isPending = computed(() => 
  testCartridgeLoading.value || changeRelayLoading.value || changeLeadLoading.value
);

const executeAction = async (type: string) => {
  switch (type) {
    case "cartridge":
      testCartridge(props.device.id);
      break;

    case "box":
    case "drone":
      const relayState =
        type === "box" ? !props.device.relayState : !props.device.droneState;
      changeCanRelayState({ type, id: props.device.id, state: relayState });
      break;
      
    case "lead":
      changeCanLeadState({ id: props.device.id, state: !props.device.leadOpen });
      break;
  }

  await sleep(2e3);
};

const type = computed(() => {
  switch (props.device.type) {
    case CAN_DEVICE_TYPE.BOX:
      return t("Box");
    case CAN_DEVICE_TYPE.REUSABLE_BOX:
      return t("Reusable box");
    case CAN_DEVICE_TYPE.ANTENA:
      return t("Antena");

    default:
      return "";
  }
});

const openBoxText = computed(() => {
  switch (props.device.type) {
    case CAN_DEVICE_TYPE.BOX:
      return !props.device.relayState ? t("Open box") : t("Close box");
    case CAN_DEVICE_TYPE.REUSABLE_BOX:
      return !props.device.relayState ? t("Eject lead") : t("Ejected");
  }
  return !props.device.relayState ? t("Open box") : t("Close box");
});

const openDroneText = computed(() => {
  return !props.device.droneState ? t("Enable drone") : t("Disable drone");
});

const enableAntenaText = computed(() => {
  return !props.device.relayState ? t("Enable antena") : t("Disable antena");
});

const statusText = computed(() => {
  return props.device.online ? t("Online") : t("Offline");
});

const isBox = computed(() => {
  return [CAN_DEVICE_TYPE.BOX, CAN_DEVICE_TYPE.REUSABLE_BOX].includes(
    props.device.type
  );
});

const changeBoxState = () => {
  if (props.device.relayState) {
    return executeAction("box");
  }

  confirmModal.text = t(
    "This actions will eject you box using cartridge, this action cannot be undone"
  );
  confirmModal.onSuccess = () => {
    executeAction("box");
    confirmModal.text = "";
  };
  confirmModal.onCancel = () => {
    confirmModal.text = "";
  };
};

const changeDroneState = () => {
  executeAction("drone");
};

const testCartrigde = () => {
  executeAction("cartridge");
};

const changeLeadState = () => {
  confirmModal.text = props.device.leadOpen
    ? t("This will close the lead, are you sure ?")
    : t("This will open the lead, are you sure ?");
  confirmModal.onSuccess = () => {
    executeAction("lead");
    confirmModal.text = "";
  };
  confirmModal.onCancel = () => {
    confirmModal.text = "";
  };
};

const enableAntenna = async () => {
  await Promise.all([executeAction("box"), executeAction("drone")]);
};

watch(
  () => props.device.online,
  (online) => {
    if (!online) {
      audio.value?.play();
    } else {
      audioConnected.value?.play();
    }
  }
);
</script>

<style scoped>
.card {
  margin-bottom: 20px;
  max-width: 400px;
  min-width: 350px;
  margin: 10px;
  display: flex;
  flex-direction: column;
  height: fit-content;
  min-height: 180px;
}

.card-actions {
  display: flex;
  justify-content: center;
}

.card-title {
  display: flex;
  justify-content: space-between;
  text-align: left;
}

.battery-info {
  display: flex;
  justify-content: space-between;
}

.action-button {
  margin: 5px;
}
</style>
