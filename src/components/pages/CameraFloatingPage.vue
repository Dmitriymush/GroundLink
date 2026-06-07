<template>
  <v-theme-provider theme="dark">
    <div class="camera-floating">
      <!-- Toolbar -->
      <div class="camera-toolbar" style="-webkit-app-region: drag;">
        <span class="camera-title">Camera</span>
        <div style="-webkit-app-region: no-drag;" class="toolbar-actions">
          <VBtn v-if="cameraStore.streaming" icon size="x-small" variant="text" @click="toggleSettings" :title="showSettings ? 'Hide settings' : 'Settings'">
            <VIcon size="14">{{ showSettings ? 'mdi-chevron-up' : 'mdi-cog' }}</VIcon>
          </VBtn>
          <VBtn icon size="x-small" variant="text" @click="closeWindow" title="Close">
            <VIcon size="16">mdi-close</VIcon>
          </VBtn>
        </div>
      </div>

      <!-- Settings panel (collapsible when streaming) -->
      <div v-if="!cameraStore.streaming || showSettings" class="camera-settings">
        <VTextField
          v-model="cameraStore.rtspUrl"
          label="RTSP URL"
          placeholder="rtsp://127.0.0.1:8554/stream"
          density="compact"
          hide-details
          variant="outlined"
          :disabled="cameraStore.streaming"
        />
        <div class="settings-row">
          <VSelect
            v-model="selectedResolution"
            :items="resolutionItems"
            label="Resolution"
            density="compact"
            hide-details
            variant="outlined"
            @update:model-value="onResolutionChange"
          />
          <VBtn
            v-if="!cameraStore.streaming"
            color="primary"
            :loading="cameraStore.connecting"
            @click="cameraStore.startStream()"
            style="min-width: 100px;"
          >
            Connect
          </VBtn>
          <VBtn
            v-else
            color="error"
            variant="tonal"
            @click="cameraStore.stopStream()"
            style="min-width: 100px;"
          >
            Stop
          </VBtn>
        </div>
      </div>

      <!-- Video area -->
      <div class="camera-video-area" :class="{ 'no-video': !cameraStore.streaming }">
        <canvas v-if="cameraStore.streaming" ref="videoCanvas" class="video-canvas"></canvas>
        <div v-else class="no-video-placeholder">
          <VIcon size="48" color="grey">mdi-video-off</VIcon>
          <span>No stream</span>
        </div>

        <!-- PTZ overlay (bottom-left) -->
        <div v-if="cameraStore.streaming" class="ptz-overlay">
          <div class="ptz-grid">
            <div />
            <VBtn icon size="x-small" variant="tonal" color="white"
              @mousedown="cameraStore.ptzMove(0, 0.5, 0)" @mouseup="cameraStore.ptzStop()" @mouseleave="cameraStore.ptzStop()">
              <VIcon size="16">mdi-chevron-up</VIcon>
            </VBtn>
            <div />
            <VBtn icon size="x-small" variant="tonal" color="white"
              @mousedown="cameraStore.ptzMove(-0.5, 0, 0)" @mouseup="cameraStore.ptzStop()" @mouseleave="cameraStore.ptzStop()">
              <VIcon size="16">mdi-chevron-left</VIcon>
            </VBtn>
            <VBtn icon size="x-small" variant="tonal" color="warning"
              @click="cameraStore.ptzHome()">
              <VIcon size="12">mdi-home</VIcon>
            </VBtn>
            <VBtn icon size="x-small" variant="tonal" color="white"
              @mousedown="cameraStore.ptzMove(0.5, 0, 0)" @mouseup="cameraStore.ptzStop()" @mouseleave="cameraStore.ptzStop()">
              <VIcon size="16">mdi-chevron-right</VIcon>
            </VBtn>
            <div />
            <VBtn icon size="x-small" variant="tonal" color="white"
              @mousedown="cameraStore.ptzMove(0, -0.5, 0)" @mouseup="cameraStore.ptzStop()" @mouseleave="cameraStore.ptzStop()">
              <VIcon size="16">mdi-chevron-down</VIcon>
            </VBtn>
            <div />
          </div>
          <!-- Zoom -->
          <div class="ptz-zoom">
            <VBtn icon size="x-small" variant="tonal" color="info"
              @mousedown="cameraStore.ptzMove(0, 0, 0.5)" @mouseup="cameraStore.ptzStop()" @mouseleave="cameraStore.ptzStop()">
              <VIcon size="14">mdi-plus</VIcon>
            </VBtn>
            <VBtn icon size="x-small" variant="tonal" color="info"
              @mousedown="cameraStore.ptzMove(0, 0, -0.5)" @mouseup="cameraStore.ptzStop()" @mouseleave="cameraStore.ptzStop()">
              <VIcon size="14">mdi-minus</VIcon>
            </VBtn>
          </div>
        </div>
      </div>

      <!-- Status bar -->
      <div class="camera-status">
        <span class="status-dot" :class="cameraStore.streaming ? 'dot-ok' : cameraStore.connecting ? 'dot-wait' : 'dot-off'" />
        <span>{{ cameraStore.streaming ? `${cameraStore.width}x${cameraStore.height}` : cameraStore.connecting ? 'Connecting...' : 'Disconnected' }}</span>
        <span v-if="cameraStore.error" class="status-error">{{ cameraStore.error }}</span>
      </div>
    </div>
  </v-theme-provider>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount, nextTick } from 'vue';
import { ipcRenderer } from 'electron';
import { useCameraStore } from '@/store/camera-store';
import { CAMERA_RESOLUTIONS } from '@/services/camera/types';

const cameraStore = useCameraStore();
const videoCanvas = ref<HTMLCanvasElement | null>(null);
const showSettings = ref(false);
let jsmpegPlayer: any = null;

const resolutionItems = CAMERA_RESOLUTIONS.map(r => ({
  title: r.label,
  value: `${r.width}x${r.height}`,
}));

const selectedResolution = ref(`${cameraStore.width}x${cameraStore.height}`);

const toggleSettings = () => { showSettings.value = !showSettings.value; };

const onResolutionChange = (val: string) => {
  const [w, h] = val.split('x').map(Number);
  cameraStore.changeResolution(w, h);
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
    console.log('[Camera] jsmpeg player created');
  } catch (e) {
    console.error('[Camera] jsmpeg player failed:', e);
  }
}

function destroyPlayer(): void {
  if (jsmpegPlayer) {
    try { if (jsmpegPlayer.destroy) jsmpegPlayer.destroy(); } catch (_) {}
    jsmpegPlayer = null;
  }
}

const closeWindow = () => {
  cameraStore.stopStream();
  ipcRenderer.invoke('close-current-window');
};

onBeforeUnmount(() => { destroyPlayer(); });
</script>

<style scoped>
.camera-floating {
  height: 100vh;
  overflow: hidden;
  background: #111;
  color: #fff;
  display: flex;
  flex-direction: column;
}

.camera-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 8px;
  background: rgba(0,0,0,0.6);
  min-height: 28px;
  flex-shrink: 0;
}

.camera-title { font-size: 11px; color: rgba(255,255,255,0.5); }
.toolbar-actions { display: flex; gap: 2px; }

.camera-settings {
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
  background: rgba(0,0,0,0.3);
}

.settings-row { display: flex; gap: 6px; align-items: center; }

.camera-video-area {
  flex: 1;
  position: relative;
  background: #000;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-canvas { width: 100%; height: 100%; object-fit: contain; }

.no-video-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #666;
  font-size: 12px;
}

.ptz-overlay {
  position: absolute;
  bottom: 6px;
  left: 6px;
  display: flex;
  gap: 6px;
  align-items: flex-end;
  background: rgba(0,0,0,0.4);
  border-radius: 8px;
  padding: 4px;
}

.ptz-grid {
  display: grid;
  grid-template-columns: repeat(3, 28px);
  grid-template-rows: repeat(3, 28px);
  gap: 1px;
  place-items: center;
}

.ptz-zoom {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.camera-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 3px 8px;
  background: rgba(0,0,0,0.4);
  font-size: 10px;
  color: rgba(255,255,255,0.5);
  flex-shrink: 0;
}

.status-dot { width: 6px; height: 6px; border-radius: 50%; }
.dot-ok { background: #4caf50; }
.dot-wait { background: #ff9800; animation: pulse 1s infinite; }
.dot-off { background: #555; }
.status-error { color: #f44336; margin-left: auto; }

@keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
</style>
