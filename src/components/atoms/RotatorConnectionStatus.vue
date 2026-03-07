<script setup lang="ts">
import { computed } from 'vue';
import { useT } from '@/hooks/use-t';
import { useRotatorStore } from '@/store/rotator-store';

const t = useT();
const rotatorStore = useRotatorStore();

const statusIcon = computed(() => {
  switch (rotatorStore.connectionState) {
    case 'connected':
      return 'mdi-wifi';
    case 'connecting':
      return 'mdi-wifi-sync';
    case 'error':
      return 'mdi-wifi-alert';
    default:
      return 'mdi-wifi-off';
  }
});

const statusColor = computed(() => {
  switch (rotatorStore.connectionState) {
    case 'connected':
      return 'success';
    case 'connecting':
      return 'warning';
    case 'error':
      return 'error';
    default:
      return 'grey';
  }
});

const statusTooltip = computed(() => {
  if (!rotatorStore.rotatorEnabled) {
    return t('Rotator disabled');
  }
  switch (rotatorStore.connectionState) {
    case 'connected':
      return t('Rotator connected');
    case 'connecting':
      return t('Connecting to rotator...');
    case 'error':
      return rotatorStore.lastError?.message || t('Connection error');
    default:
      return t('Rotator disconnected');
  }
});

const toggleConnection = () => {
  if (rotatorStore.isConnected) {
    rotatorStore.disconnect();
  } else if (!rotatorStore.isConnecting) {
    rotatorStore.connect();
  }
};
</script>

<template>
  <VTooltip location="bottom">
    <template #activator="{ props }">
      <VBtn
        v-bind="props"
        :icon="statusIcon"
        :color="statusColor"
        variant="text"
        size="small"
        :loading="rotatorStore.isConnecting"
        @click="toggleConnection"
      />
    </template>
    <span>{{ statusTooltip }}</span>
  </VTooltip>
</template>

<style scoped>
</style>
