<template>
  <div class="antenna-page">
    <!-- Header -->
    <div class="page-header">
      <h2>{{ t('Antenna Control') }}</h2>
      <p class="page-subtitle">
        {{ t('Use arrow keys or drag on compass to control antenna. Hold Shift for faster movement.') }}
      </p>
      <VBtn
        color="primary"
        variant="tonal"
        size="small"
        prepend-icon="mdi-open-in-new"
        @click="openFloatingWindow"
      >
        {{ t('Open in separate window') }}
      </VBtn>
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
  text-align: center;
  padding-bottom: 8px;
}

.page-header h2 {
  margin: 0;
  font-weight: 500;
  font-size: 20px;
}

.page-subtitle {
  margin: 4px 0 8px;
  font-size: 13px;
  opacity: 0.7;
}

.page-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
