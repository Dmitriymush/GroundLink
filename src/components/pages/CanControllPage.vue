<template>
  <VContainer class="container">
    <VAlert v-if="connectionError" color="red">{{
      t("Failed connect to megapolis")
    }}</VAlert>
    <VProgressCircular v-if="isPending" />

    <div class="sub-container">
      <CanDevice
        v-for="device in canStore.devices"
        v-key="device.id"
        :device="device"
      />
    </div>
  </VContainer>
</template>

<script setup lang="ts">
import { useCanStore } from "@/store";
import { ref, watch } from "vue";
import CanDevice from "../molecules/CanDevice.vue";
import { VAlert, VProgressCircular } from "vuetify/lib/components/index";
import { useT } from "@/hooks/use-t";
import { useCanDevices } from "@/hooks/use-hardware-api";

const canStore = useCanStore();
const t = useT();
const connectionError = ref(false);

const { data, isPending } = useCanDevices();

watch(data, (newData) => {
  if (newData.length) {
    connectionError.value = false;
    canStore.devices = newData;
    return;
  }

  canStore.devices = canStore.devices.map((device) => ({
    ...device,
    online: false,
  }));
  connectionError.value = true;
});
</script>

<style scoped>
.container {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  flex-direction: column;
}

.sub-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  flex-direction: row;
  margin-top: 20px;
}
</style>
