<script setup lang="ts">
import { useT } from "@/hooks/use-t";
import { useConnectionStatus } from "@/store";
import StatusIcon from "./StatusIcon.vue";
import { devices } from "@/controllers/devices";
import { ref } from "vue";
const t = useT();

const connectionStatus = useConnectionStatus();
const joysticStatus = ref<boolean>(false);

devices.on("status", (status) => {
  joysticStatus.value = status;
});
</script>

<template>
  <div class="status-container">
    <StatusIcon
      :status="connectionStatus.isRpanionConnected"
      :tooltip="
        t(
          connectionStatus.isRpanionConnected
            ? 'Has connection'
            : 'No connection'
        )
      "
      :text="t('Rpanion server')"
      icon="mdi-server-network"
    />

    <StatusIcon
      :status="connectionStatus.isMegaConnected"
      :tooltip="
        t(connectionStatus.isMegaConnected ? 'Has connection' : 'No connection')
      "
      :text="t('Megapolis server')"
      icon="mdi-database"
    />

    <StatusIcon
      :status="joysticStatus"
      :tooltip="t(joysticStatus ? 'RC enabled' : 'RC disabled')"
      :text="t('Radio controll')"
      icon="mdi-gamepad-variant-outline"
    />

    <StatusIcon
      :status="connectionStatus.isVideoStarted"
      :tooltip="
        t(connectionStatus.isVideoStarted ? 'Video running' : 'No video info')
      "
      :text="t('Video status')"
      icon="mdi-video"
    />
  </div>
</template>

<style scoped>
.status-container {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
}
</style>
