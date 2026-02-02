<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from "vue";
import { useMutation } from "@tanstack/vue-query";
import { useT } from "@/hooks/use-t";
import { useRPanionConnection } from "@/hooks/use-rpanion-api";
import {
  VDialog,
  VCard,
  VCardTitle,
  VCardText,
  VCardActions,
  VBtn,
  VProgressLinear,
} from "vuetify/components";

type Props = {
  open: boolean;
};

type Emits = {
  (e: "save", ip: string | null): void;
};

const IP_LIST = [
  "10.0.2.100",
  "10.7.0.2",
  "10.7.0.3",
  "10.7.0.4",
  "10.7.0.5",
  "10.7.0.6",
  "10.7.0.7",
  "10.7.0.8",
  "10.7.0.9",
  "10.7.0.10",
  "10.7.0.11",
  "10.7.0.12",
  "10.7.0.13",
  "10.7.0.14",
  "10.7.0.15",
  "10.7.0.16",
  "10.7.0.17",
  "10.7.0.18",
  "10.7.0.19",
  "10.7.0.20",
  "10,7.0.21",
  "10,7.0.22",
  "10,7.0.23",
  "10,7.0.24",
  "10,7.0.25",
  "10,7.0.26",
  "10.7.0.27",
  "10.7.0.28",
  "10.7.0.29",
  "10.7.0.30",
  "10.7.0.31",
];

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const t = useT();
const checkingState = ref<boolean>(false);
const currentIp = ref<string>("");
const progress = ref<number>(0);

const findIpAddress = async () => {
  checkingState.value = true;

  const ipList = [...IP_LIST];

  while (ipList.length > 0) {
    const ip = ipList.shift();

    currentIp.value = ip || "";
    progress.value = ((IP_LIST.length - ipList.length) * 100) / IP_LIST.length;

    // Simple ping test using unified HTTP client
    try {
      const { HttpClient } = await import('@/services/api/http-client');
      const client = new HttpClient({ baseURL: `http://${ip}:5000`, debug: false });
      await client.ping();
      emit("save", currentIp.value);
      return;
    } catch (error) {
      // IP not reachable, continue to next
    }

    if (!checkingState.value) {
      return;
    }
  }

  checkingState.value = false;
  emit("save", null);
};

const { isError, error, mutate } = useMutation({
  mutationFn: findIpAddress,
});

const startHandle = async () => {
  if (checkingState.value) {
    return;
  }

  mutate();
};

watch(
  () => props.open,
  (val) => {
    if (!val) {
      checkingState.value = false;
      currentIp.value = "";
    } else {
      startHandle();
    }
  }
);

onBeforeUnmount(() => {
  checkingState.value = false;
  currentIp.value = "";
});
</script>

<template>
  <VDialog
    width="500"
    :model-value="open"
    persistent
    @update:model-value="$emit('save', null)"
  >
    <VCard>
      <VCardTitle>
        {{ t("Auto ip search") }}
      </VCardTitle>

      <VCardText>
        <span>{{ currentIp }}</span>

        <VProgressLinear :model-value="progress"></VProgressLinear>
      </VCardText>

      <VCardActions>
        <VBtn color="decline" @click="$emit('save', null)">{{ t("Cancel") }}</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>
