<script setup lang="ts">
import { useT } from "@/hooks/use-t";
import NavigationMenuItem from "@/components/atoms/NavigationMenuItem.vue";
import { ROUTERS } from "@/router";
import VideoWindowContainer from "./VIdeoWindowContainer.vue";
import { getAllowedFeatures } from "@/utils";
import { FEATURES } from "@/constants/features";
import { computed } from "vue";
import { useMenuStore } from "@/store/menu-store";

const menuStore = useMenuStore();
const t = useT();

const allowedFeatures = getAllowedFeatures();

console.log(allowedFeatures);

const isRemoteControllAvalible = computed(() =>
  allowedFeatures.includes(FEATURES.REMOTE_CONTROLL)
);

const isAntenaControllAvalible = computed(() =>
  allowedFeatures.includes(FEATURES.ANTENA_CONTROLL)
);

const isBeeAvalible = computed(() => allowedFeatures.includes(FEATURES.BEE));

const isBombAvalible = computed(() => allowedFeatures.includes(FEATURES.BOMB));
const isSecondJRAvalible = computed(() =>
  allowedFeatures.includes(FEATURES.SECOND_JR_ANTENNA_CONTROLL)
);
const isCanControllAvalible = computed(() =>
  allowedFeatures.includes(FEATURES.CAN_CONTROLL)
);
const isVulikControllAvalible = computed(() =>
  allowedFeatures.includes(FEATURES.VULIK_CONTROLL)
);
</script>

<template>
  <v-list :class="['menu', { 'menu--collapsed': menuStore.isCollapsed }]">
    <v-divider />

    <NavigationMenuItem
      v-if="isRemoteControllAvalible"
      :title="t('Remote controll')"
      :href="ROUTERS.REMOTE_CONTROLL_V2"
    />

    <NavigationMenuItem
      v-if="isBombAvalible"
      :title="t('Detonate')"
      :href="ROUTERS.DETONATE"
    />

    <NavigationMenuItem
      v-if="isAntenaControllAvalible"
      :title="t('Antenna controll')"
      :href="ROUTERS.ANTENA_CONTROLL"
    />

    <NavigationMenuItem
      v-if="isBeeAvalible"
      :title="t('Bee')"
      :href="ROUTERS.BEE"
    />

    <NavigationMenuItem
      v-if="isSecondJRAvalible"
      :title="t('Second JR')"
      :href="ROUTERS.SECOND_JR_ANTENNA_CONTROLL"
    />

    <NavigationMenuItem
      v-if="isCanControllAvalible"
      :title="t('Bee V2')"
      :href="ROUTERS.CAN_CONTROLL"
    />

    <NavigationMenuItem
      v-if="isVulikControllAvalible"
      :title="t('Vulic controll')"
      :href="ROUTERS.VULIK_CONTROLL"
    />

    <NavigationMenuItem :title="t('Settings')" :href="ROUTERS.SETTINGS" />

    <v-divider />
    <VideoWindowContainer />
  </v-list>
</template>

<style>
.menu {
  width: 300px;
  height: 100vh;
  transition: width 0.3s ease;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.menu--collapsed {
  width: 64px;
}

:deep(.v-list-item-title) {
  opacity: 1;
  transition: opacity 0.3s ease;
}

.menu--collapsed :deep(.v-list-item-title) {
  opacity: 0;
  width: 0;
  height: 0;
  overflow: hidden;
}
</style>
