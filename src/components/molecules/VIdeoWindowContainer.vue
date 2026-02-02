<script setup lang="ts">
import { onBeforeUnmount, ref, computed } from "vue";
import { useT } from "@/hooks/use-t";
import { video } from "@/controllers/video";
import { onMounted } from "vue";
import { useMenuStore } from "@/store/menu-store";

const t = useT();
const videoStatus = ref<boolean>(false);
const menuStore = useMenuStore();

const openVideoText = computed(() =>
  videoStatus.value ? t("Video starded") : t("Open video")
);

const startVideoHandle = () => {
  video.start();
};

const stopVideoHandle = () => {
  video.stop();
};

const setVideoActive = (): void => {
  videoStatus.value = true;
};

const setVideoStatusFalse = (): void => {
  videoStatus.value = false;
};

const openButtonClasses = computed(() => ({
  started: videoStatus.value,
}));

onMounted(() => {
  video.on("data", setVideoActive);
  video.on("close", setVideoStatusFalse);

  process.on("exit", () => {
    video.stop();
  });
});

onBeforeUnmount(() => {
  video.stop();
  video.off("data", setVideoActive);
  video.off("close", setVideoStatusFalse);
});
</script>

<template>
  <div
    class="open-video"
    :class="{ 'open-video--collapsed': menuStore.isCollapsed }"
  >
    <VBtn
      variant="outlined"
      v-if="!videoStatus"
      class="button"
      color="save"
      @click="startVideoHandle"
      :icon="menuStore.isCollapsed"
    >
      <VIcon v-if="menuStore.isCollapsed">mdi-video</VIcon>
      <span v-else>{{ t("Open video") }}</span>
    </VBtn>

    <VBtn
      v-else
      variant="outlined"
      class="button"
      color="warning"
      @click="stopVideoHandle"
      :icon="menuStore.isCollapsed"
    >
      <VIcon v-if="menuStore.isCollapsed">mdi-video-off</VIcon>
      <span v-else>{{ t("Stop video") }}</span>
    </VBtn>
  </div>
</template>

<style scoped>
.open-video {
  margin: 5px;
}

.button {
  width: 100%;
  font-size: 24px;
  transition: all 0.3s ease;
  border-radius: var(--v-btn-height);
}

.open-video--collapsed .button {
  width: 40px;
  min-width: 40px;
  height: 40px;
  padding: 0;
  margin: 0 auto;
}

.open-video--collapsed :deep(.v-icon) {
  margin-right: 0;
}
</style>
