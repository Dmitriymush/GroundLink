<script setup lang="ts">
import { onMounted, watch } from 'vue';
import { useQuery } from '@tanstack/vue-query';
import { useStorage } from '@vueuse/core';
import Status from '@/components/atoms/Status.vue';
import { useConnectionStatus } from '@/store';
import { useRPanionConnection } from '@/hooks/use-rpanion-api';
import { useHardwareConnection } from '@/hooks/use-hardware-api';

const storageHost = useStorage<string>('host', null);
const connectionStatusStore = useConnectionStatus();

const { isLoading, data: rpanionConnectionStatus } = useRPanionConnection(storageHost.value);

const { data: megaConnectionStatus } = useHardwareConnection(storageHost.value);

onMounted(() => {
  connectionStatusStore.isRpanionConnected = rpanionConnectionStatus.value;
  connectionStatusStore.isMegaConnected = megaConnectionStatus.value;
});

watch(rpanionConnectionStatus, (value) => {
  connectionStatusStore.isRpanionConnected = value;
});

watch(megaConnectionStatus, (value) => {
  connectionStatusStore.isMegaConnected = value; 
});
</script>

<template>
  <Status :loading="isLoading"/>
</template>

<style scoped>

</style>