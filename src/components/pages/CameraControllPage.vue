<template>
  <div class="camera-page">
    <div class="page-header">
      <span class="page-title">{{ t('Camera Control') }}</span>
      <VBtn
        color="primary"
        variant="text"
        size="small"
        icon="mdi-open-in-new"
        :title="t('Open in separate window')"
        @click="openFloatingWindow"
      />
    </div>

    <div class="page-body">
      <!-- Settings -->
      <div class="camera-config">
        <div class="config-row">
          <VTextField
            v-model="cameraStore.rtspUrl"
            label="RTSP URL"
            placeholder="rtsp://127.0.0.1:8554/stream"
            density="compact"
            hide-details
            variant="outlined"
            :disabled="cameraStore.streaming"
          />
        </div>
        <div class="config-row">
          <VTextField
            v-model="cameraStore.onvifHost"
            label="ONVIF Host"
            placeholder="127.0.0.1"
            density="compact"
            hide-details
            variant="outlined"
            :disabled="cameraStore.streaming"
            style="flex: 2;"
          />
          <VTextField
            v-model.number="cameraStore.onvifPort"
            label="Port"
            type="number"
            density="compact"
            hide-details
            variant="outlined"
            :disabled="cameraStore.streaming"
            style="flex: 1;"
          />
          <VTextField
            v-model="cameraStore.username"
            label="User"
            density="compact"
            hide-details
            variant="outlined"
            :disabled="cameraStore.streaming"
            style="flex: 1;"
          />
          <VTextField
            v-model="cameraStore.password"
            label="Pass"
            type="password"
            density="compact"
            hide-details
            variant="outlined"
            :disabled="cameraStore.streaming"
            style="flex: 1;"
          />
        </div>
        <div class="config-row">
          <VSelect
            v-model="selectedResolution"
            :items="resolutionItems"
            label="Resolution"
            density="compact"
            hide-details
            variant="outlined"
            @update:model-value="onResolutionChange"
            style="max-width: 200px;"
          />
          <VBtn
            v-if="!cameraStore.streaming"
            color="primary"
            :loading="cameraStore.connecting"
            @click="cameraStore.startStream()"
          >
            {{ t('Start Stream') }}
          </VBtn>
          <VBtn
            v-else
            color="error"
            variant="tonal"
            @click="cameraStore.stopStream()"
          >
            {{ t('Stop Stream') }}
          </VBtn>
        </div>
      </div>

      <!-- Video + PTZ -->
      <div class="camera-content">
        <div class="video-container">
          <canvas v-if="cameraStore.streaming" ref="videoCanvas" class="video-canvas"></canvas>
          <div v-else class="no-video">
            <VIcon size="64" color="grey">mdi-video-off</VIcon>
            <span>{{ t('No stream') }}</span>
          </div>
        </div>

        <!-- PTZ panel (side) -->
        <div v-if="cameraStore.streaming" class="ptz-panel">
          <span class="ptz-title">PTZ</span>
          <div class="ptz-grid">
            <div />
            <VBtn icon size="small" variant="tonal"
              @mousedown="cameraStore.ptzMove(0, 0.5, 0)" @mouseup="cameraStore.ptzStop()" @mouseleave="cameraStore.ptzStop()">
              <VIcon>mdi-chevron-up</VIcon>
            </VBtn>
            <div />
            <VBtn icon size="small" variant="tonal"
              @mousedown="cameraStore.ptzMove(-0.5, 0, 0)" @mouseup="cameraStore.ptzStop()" @mouseleave="cameraStore.ptzStop()">
              <VIcon>mdi-chevron-left</VIcon>
            </VBtn>
            <VBtn icon size="small" variant="tonal" color="warning" @click="cameraStore.ptzHome()">
              <VIcon size="16">mdi-home</VIcon>
            </VBtn>
            <VBtn icon size="small" variant="tonal"
              @mousedown="cameraStore.ptzMove(0.5, 0, 0)" @mouseup="cameraStore.ptzStop()" @mouseleave="cameraStore.ptzStop()">
              <VIcon>mdi-chevron-right</VIcon>
            </VBtn>
            <div />
            <VBtn icon size="small" variant="tonal"
              @mousedown="cameraStore.ptzMove(0, -0.5, 0)" @mouseup="cameraStore.ptzStop()" @mouseleave="cameraStore.ptzStop()">
              <VIcon>mdi-chevron-down</VIcon>
            </VBtn>
            <div />
          </div>
          <div class="ptz-zoom-row">
            <VBtn icon size="small" variant="tonal" color="info"
              @mousedown="cameraStore.ptzMove(0, 0, 0.5)" @mouseup="cameraStore.ptzStop()" @mouseleave="cameraStore.ptzStop()">
              <VIcon>mdi-magnify-plus</VIcon>
            </VBtn>
            <VBtn icon size="small" variant="tonal" color="info"
              @mousedown="cameraStore.ptzMove(0, 0, -0.5)" @mouseup="cameraStore.ptzStop()" @mouseleave="cameraStore.ptzStop()">
              <VIcon>mdi-magnify-minus</VIcon>
            </VBtn>
          </div>
        </div>
      </div>

      <!-- Error -->
      <VAlert v-if="cameraStore.error" type="error" density="compact" class="mt-2" closable @click:close="cameraStore.error = null">
        {{ cameraStore.error }}
      </VAlert>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount, nextTick } from 'vue';
import { useT } from '@/hooks/use-t';
import { ipcRenderer } from 'electron';
import { useCameraStore } from '@/store/camera-store';
import { CAMERA_RESOLUTIONS } from '@/services/camera/types';

const t = useT();
const cameraStore = useCameraStore();
const videoCanvas = ref<HTMLCanvasElement | null>(null);
let jsmpegPlayer: any = null;

const resolutionItems = CAMERA_RESOLUTIONS.map(r => ({
  title: r.label,
  value: `${r.width}x${r.height}`,
}));

const selectedResolution = ref(`${cameraStore.width}x${cameraStore.height}`);

const onResolutionChange = (val: string) => {
  const [w, h] = val.split('x').map(Number);
  cameraStore.changeResolution(w, h);
};

const openFloatingWindow = () => {
  ipcRenderer.invoke('open-camera-floating');
};

watch(() => cameraStore.activeWsPort, async (port) => {
  if (port > 0) {
    await nextTick();
    createPlayer(port);
  } else {
    destroyPlayer();
  }
});

function createPlayer(port: number): void {
  destroyPlayer();
  if (!videoCanvas.value) return;
  try {
    const JSMpeg = require('jsmpeg-player');
    jsmpegPlayer = new JSMpeg.Player(`ws://localhost:${port}`, {
      canvas: videoCanvas.value,
    });
  } catch (e) {
    console.error('[Camera] jsmpeg failed:', e);
  }
}

function destroyPlayer(): void {
  if (jsmpegPlayer) {
    try { if (jsmpegPlayer.destroy) jsmpegPlayer.destroy(); } catch (_) {}
    jsmpegPlayer = null;
  }
}

onBeforeUnmount(() => { destroyPlayer(); });
</script>

<style scoped>
.camera-page {
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

.page-title { font-weight: 500; font-size: 16px; }

.page-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.camera-config {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 12px;
}

.config-row { display: flex; gap: 8px; align-items: center; }

.camera-content {
  flex: 1;
  min-height: 0;
  display: flex;
  gap: 12px;
}

.video-container {
  flex: 1;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.video-canvas { width: 100%; height: 100%; object-fit: contain; }

.no-video {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #666;
}

.ptz-panel {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
  padding: 8px;
  background: rgba(128,128,128,0.1);
  border-radius: 8px;
}

.ptz-title { font-size: 11px; text-transform: uppercase; color: rgba(128,128,128,0.7); }

.ptz-grid {
  display: grid;
  grid-template-columns: repeat(3, 36px);
  grid-template-rows: repeat(3, 36px);
  gap: 2px;
  place-items: center;
}

.ptz-zoom-row { display: flex; gap: 4px; }
</style>
