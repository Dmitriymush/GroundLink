<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { VContainer, VProgressLinear } from "vuetify/components";
import StatusIcon from "../atoms/StatusIcon.vue";
import VulicCard from "../molecules/VulicCard.vue";
import { useAppSeetingsStore } from "@/store/app-settings-store";
import { useDroneConnection, useDrones, useDrone, useChangeDroneLeadState, useUnloadDrone } from "@/hooks/use-drone-api";
import type { Drone, LeadState } from "@/services/api/drone-service";

const { selectedConnection } = useAppSeetingsStore();
const vuliksOptimizedList = ref<Drone[]>([]);

const { data: isServerAlive } = useDroneConnection(selectedConnection.value?.vulikHost, selectedConnection.value?.vulikPort);

const {
  data: vulicsList,
  isPending: listLoading,
  refetch: loadVulics,
} = useDrones(selectedConnection.value?.vulikHost, selectedConnection.value?.vulikPort);

const { data: currentDrone, isPending: vulikLoading, refetch: loadVulik } = useDrone(
  vuliksOptimizedList.value[0]?.id || '',
  selectedConnection.value?.vulikHost,
  selectedConnection.value?.vulikPort
);

const { mutate: unloadDrone, isPending: unloadLoading } = useUnloadDrone(
  selectedConnection.value?.vulikHost,
  selectedConnection.value?.vulikPort
);

const { mutate: changeLeadState, isPending: changeLeadStateLoading } = useChangeDroneLeadState(
  selectedConnection.value?.vulikHost,
  selectedConnection.value?.vulikPort
);

const loading = computed(
  () =>
    listLoading.value ||
    unloadLoading.value ||
    changeLeadStateLoading.value ||
    vulikLoading.value
);

const clickOpenLead = (vulik: Drone) => {
  console.info("Open lead", vulik);
  changeLeadState({ droneId: vulik.id, leadState: LeadState.open });
};
const clickCloseLead = (vulik: Drone) => {
  console.info("Close lead", vulik);
  changeLeadState({ droneId: vulik.id, leadState: LeadState.close });
};
const clickUnloadDrone = (vulik: Drone) => {
  console.info("Unload drone", vulik);
  unloadDrone(vulik.id);
};

onMounted(async () => {
  await loadVulics();
  vuliksOptimizedList.value = vulicsList.value.vuliks;
});

watch(vulicsList, () => {
  vuliksOptimizedList.value = vulicsList.value.vuliks;
});
watch(isServerAlive, (newValue) => {
  if (newValue) {
    loadVulics();
  }
});
</script>

<template>
  <VContainer>
    <VProgressLinear v-if="loading" indeterminate />
    <StatusIcon :status="isServerAlive as boolean" tooltip="Connection status">
      S
    </StatusIcon>

    {{ selectedConnection?.vulikHost }}:{{ selectedConnection?.vulikPort }}

    <VulicCard
      v-for="vulic in vuliksOptimizedList"
      :key="vulic.id"
      :vulic="vulic"
      :loading="loading"
      @onCloseLead="clickCloseLead"
      @onOpenLead="clickOpenLead"
      @onUnloadDrone="clickUnloadDrone"
    />
  </VContainer>
</template>
