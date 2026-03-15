<template>
  <v-theme-provider theme="dark">
    <div class="floating-antenna" ref="rootRef">
      <!-- Drag handle / toolbar -->
      <div class="floating-toolbar" style="-webkit-app-region: drag;">
        <span class="floating-title">{{ t('Antenna Control') }}</span>
        <div style="-webkit-app-region: no-drag;" class="toolbar-actions">
          <VIcon
            size="16"
            class="opacity-icon"
            :title="t('Opacity')"
          >mdi-opacity</VIcon>
          <input
            type="range"
            v-model.number="opacityPercent"
            min="20"
            max="100"
            step="5"
            class="opacity-range"
            :title="`${opacityPercent}%`"
          />
          <VBtn
            icon
            size="x-small"
            variant="text"
            @click="closeWindow"
            :title="t('Close')"
          >
            <VIcon size="16">mdi-close</VIcon>
          </VBtn>
        </div>
      </div>

      <!-- Compact content - fills remaining height -->
      <div class="floating-content">
        <AzimuthController :send-interval="20" :compact="isCompact" />
      </div>
    </div>
  </v-theme-provider>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue';
import { useT } from '@/hooks/use-t';
import { useElementSize } from '@vueuse/core';
import AzimuthController from '@/components/molecules/AzimuthController.vue';
import { ipcRenderer } from 'electron';

const t = useT();

const rootRef = ref<HTMLElement | null>(null);
const { height: rootHeight } = useElementSize(rootRef);
const isCompact = computed(() => rootHeight.value < 400);

const opacityPercent = ref(100);

watch(opacityPercent, (val) => {
  ipcRenderer.invoke('set-window-opacity', val / 100);
});

const closeWindow = () => {
  ipcRenderer.invoke('close-current-window');
};
</script>

<style scoped>
.floating-antenna {
  height: 100vh;
  overflow: hidden;
  background: #1e1e1e;
  color: #ffffff;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
}

.floating-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 4px 8px;
  background: rgba(0, 0, 0, 0.5);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  min-height: 32px;
  flex-shrink: 0;
}

.floating-title {
  font-size: 12px;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.6);
  white-space: nowrap;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.opacity-icon {
  color: rgba(255, 255, 255, 0.4);
}

.opacity-range {
  width: 80px;
  height: 4px;
  -webkit-appearance: none;
  appearance: none;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 2px;
  outline: none;
  cursor: pointer;
}

.opacity-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: #457ec7;
  cursor: pointer;
}

.floating-content {
  flex: 1;
  min-height: 0;
  padding: 4px;
  overflow: hidden;
}

/* Compact overrides for floating mode */
.floating-content :deep(.azimuth-controller) {
  max-width: 100%;
}
</style>
