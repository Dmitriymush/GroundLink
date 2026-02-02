<script setup lang="ts">
import { useDroneControll } from "@/hooks/drone-controll";
import { useT } from "@/hooks/use-t";
import { virtualJR } from "@/controllers/virtualJR";
import { onMounted, watch } from "vue";
import RCSwitch from "@/components/atoms/RCSwitch.vue";

type Props = {
  externalEnable?: boolean;
};

const props = defineProps<Props>();

const t = useT();
const {
  droneControllChannel,
  droneControllEnable,
  droneControllValue,
  restoreState,
} = useDroneControll();

const channels = Object.keys(virtualJR.channelsMap);

const selectChannel = (value: string): void => {
  droneControllChannel.value = value;
  restoreState();
};

const setValue = (value: number): void => {
  droneControllValue.value = value;
  restoreState();
};

watch(droneControllEnable, () => {
  restoreState();
});

watch(droneControllChannel, () => {
  restoreState();
});

watch(() => props.externalEnable, () => {
  droneControllEnable.value = props.externalEnable;
});

onMounted(() => {
  restoreState();
  if (props.externalEnable != null) {
    droneControllEnable.value = props.externalEnable;
  }
});
</script>

<template>
  <VContainer style="padding: 0;">
    <div class="settings-container">
      <div class="settings">
        <VSwitch
          inset
          v-if="!externalEnable"
          :label="t('Enable drone switch controll')"
          v-model="droneControllEnable"
          color="primary"
        />

        <VSelect
          v-if="droneControllEnable"
          :label="t('Channel')"
          :items="channels"
          variant="outlined"
          density="comfortable"
          :modelValue="droneControllChannel"
          @update:modelValue="selectChannel"
        />
      </div>
    </div>

    <div v-if="droneControllEnable">
      <RCSwitch
        :label="droneControllChannel"
        :position="6"
        :value="droneControllValue"
        limited
        @update:value="setValue"
      />
    </div>
  </VContainer>
</template>

<style scoped>
.settings-container {
  display: flex;
  width: 100%;
}

.settings-container .settings {
  display: flex;
  width: 100%;
  justify-content: space-between;
}
</style>
