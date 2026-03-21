<template>
  <div class="antenna-page">
    <!-- Header -->
    <div class="page-header">
      <span class="page-title">{{ t('Antenna Control') }}</span>
      <VBtn
        color="primary"
        variant="text"
        size="small"
        icon="mdi-open-in-new"
        :title="t('Open in separate window')"
        @click="openFloatingWindow"
      />
    </div>

    <!-- Controller fills remaining space -->
    <div class="page-body">
      <AzimuthController :send-interval="20" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { useT } from '@/hooks/use-t';
import { ipcRenderer } from 'electron';
import AzimuthController from '@/components/molecules/AzimuthController.vue';

const t = useT();

const openFloatingWindow = () => {
  ipcRenderer.invoke('open-antenna-floating');
};
</script>

<style scoped>
.antenna-page {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 12px 16px;
  overflow: hidden;
}

.page-header {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-bottom: 4px;
}

.page-title {
  font-weight: 500;
  font-size: 16px;
}

.page-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
