<script setup lang="ts">
import Menu from "./components/molecules/Menu.vue";
import TopBar from "./components/molecules/TopBar.vue";

import { socket } from "./controllers/socket";
import { virtualJR } from "./controllers/virtualJR";
import { computed, onBeforeMount, onBeforeUnmount, ref, watch } from "vue";
import { useRoute } from "vue-router";
import { useStorage } from "@vueuse/core";
import { checkContent } from "@/utils/installer";
import { useDroneControll } from "./hooks/drone-controll";
// TODO: Replace with new unified services when available
import { useMixerStettings } from "./store/mixer-settings-store";
import { useAppSeetingsStore } from "@/store/app-settings-store";

if (!import.meta.env.VITE_APP_INGORE_SECURE) {
  console.log("Secure check");
  checkContent();
}

const hostStorage = useStorage<string>("host", null);
const storagePort = useStorage<number>("port", 27015);
const secondPort = useStorage<number>("second-port", 27016);
const isInstalled = ref<boolean>(false);
const { restoreState } = useDroneControll();
const { restoreValues } = useMixerStettings();
const appSettingsStore = useAppSeetingsStore();
const route = useRoute();
const isFloatingWindow = computed(() => route.path === '/antenna-floating');

virtualJR.socket?.connect(hostStorage.value, secondPort.value);

watch(hostStorage, () => {
  socket.changeAddress(hostStorage.value, storagePort.value);
  virtualJR.socket?.connect(hostStorage.value, secondPort.value);
  // TODO: setHost(hostStorage.value, storagePort.value);
});

watch(
  () => appSettingsStore.selectedConnection,
  (newConnection) => {
    console.info("Selected connection", newConnection);
    // TODO: setHostV2(newConnection);
  }
);

watch(secondPort, () => {
  virtualJR.socket?.connect(hostStorage.value, secondPort.value);
});

onBeforeMount(async () => {
  socket.startLoop();
  socket.changeAddress(hostStorage.value, storagePort.value);
  // TODO: setHost(hostStorage.value, storagePort.value);
  // TODO: setHostV2(appSettingsStore.selectedConnection);

  if (import.meta.env.VITE_APP_INGORE_SECURE) {
    console.log("Ignoring secure check");
    isInstalled.value = true;
    return;
  }
  isInstalled.value = await checkContent();
  restoreState();
  restoreValues();
});

onBeforeUnmount(() => {
  socket.stopLoop();
});
</script>

<template>
  <v-app v-if="isInstalled" full-height>
    <template v-if="isFloatingWindow">
      <router-view></router-view>
    </template>
    <template v-else>
      <TopBar />
      <div class="app">
        <Menu />
        <router-view></router-view>
      </div>
    </template>
  </v-app>

  <div v-else>...</div>
</template>

<style scoped>
  .app {
    display: flex;
    flex-direction: row;
    height: calc(100vh - 48px);
    overflow: hidden;
  }

  :deep(.v-main) {
    flex: 1;
    overflow: auto;
    padding-top: 0;
  }

  :deep(.v-list) {
    padding-top: 0;
  }

  .app .v-container {
    max-width: 100%;
    overflow: auto;
  }

  .v-toolbar__append {
    gap: 24px;
  }

  ::v-deep .block-card {
    margin-bottom: 24px;
  }

  ::v-deep .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
  }

  ::v-deep .header-title {
    font-size: 20px;
    font-weight: bold;
  }

  ::v-deep .v-expansion-panel-title {
    height: 64px;
  }

  ::v-deep .status-chip {
    font-size: 14px;
    padding: 4px 8px;
    border-radius: 4px;
    margin: 1px 4px;
    width: fit-content;
  }
</style>

<!--color: #dc4600;-->
