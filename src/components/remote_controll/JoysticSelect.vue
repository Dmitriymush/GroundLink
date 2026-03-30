<script setup lang="ts">
import { useT } from "@/hooks/use-t";
import type { Device } from "node-hid";
import { computed, ref, onMounted, onBeforeUnmount, watch } from "vue";
import { devices } from "@/controllers/devices";

const props = defineProps<{
  activeJoystic: Device | undefined | null;
  allowAllDevices: boolean;
}>();
defineEmits<{
  (e: "update:activeJoystic", v: Device): void;
  (e: "disable", v: void): void;
}>();

const t = useT();
const loading = ref<boolean>(false);
const joystics = ref<Device[]>([]);
const timeout = ref<any>(null);
const closed = ref<boolean>(false);

const getDevices = async (): Promise<void> => {
  if (closed.value) {
    return;
  }

  loading.value = true;
  joystics.value = await devices.getDevices();

  if (props.allowAllDevices) {
    loading.value = false;
  } else {
    joystics.value = joystics.value.filter((device: Device) =>
      devices.allowedDevicesVendors.includes(device.vendorId)
    );
  }

  if (!joystics.value.length) {
    timeout.value = setTimeout(() => getDevices(), 1e3);
    return;
  }

  loading.value = false;
};

const options = computed(() =>
  joystics.value.map((v: Device) => ({
    title: v.product,
    value: v,
  }))
);

watch(() => props.allowAllDevices, getDevices);

onMounted(() => {
  getDevices();
});

onBeforeUnmount(() => {
  closed.value = true;
  clearTimeout(timeout.value);
});
</script>

<template>
  <div class="input">
    <v-select
      :placeholder="t('Select joystick')"
      :loading="loading"
      :items="options"
      :model-value="activeJoystic"
      variant="outlined"
      @update:model-value="$emit('update:activeJoystic', $event)"
    />
    <VBtn class="button" color="red" v-if="activeJoystic" @click="$emit('disable')">{{ t('OFF') }}</VBtn>
  </div>
</template>

<style scoped>
.input {
    display: flex;
}

.button {
    margin-left: 10px;
    height: 55px !important;
}
</style>