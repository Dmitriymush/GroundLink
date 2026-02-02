<script setup lang="ts">
import ConnectionStatus from "../ConnectionStatus.vue";
import { useMenuStore } from "@/store/menu-store";
import logo from "../../assets/vue.svg";
import { computed, getCurrentInstance } from 'vue';
import { useAppSeetingsStore } from '@/store'; // adjust path

const appSettingsStore = useAppSeetingsStore();
const { proxy } = getCurrentInstance()!;
const menuStore = useMenuStore();

const isDark = computed(() => appSettingsStore.isDarkMode);

const toggleDarkMode = () => {
  appSettingsStore.isDarkMode = !appSettingsStore.isDarkMode;
  ((proxy as any).$vuetify.theme.global.name as any) = appSettingsStore.isDarkMode ? 'dark' : 'light'
};
</script>

<template>
  <div class="top-bar">
    <div class="top-bar__start">
      <VBtn icon variant="text" class="menu-btn" @click="menuStore.toggleMenu">
        <VIcon>mdi-menu</VIcon>
      </VBtn>
<!--      <VImg :src="logo" width="130px" contain class="ml-2"></VImg>-->
    </div>
    <div class="top-bar__end">
        <VBtn
            icon
            variant="text"
            @click="toggleDarkMode"
        >
          <VIcon>
            {{ isDark ? 'mdi-weather-sunny' : 'mdi-weather-night' }}
          </VIcon>
        </VBtn>
      <ConnectionStatus />
    </div>
  </div>
</template>

<style scoped>
.top-bar {
  height: 48px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 5px;
  background-color: rgb(var(--v-theme-surface));
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.top-bar__start,
.top-bar__end {
  display: flex;
  align-items: center;
}

.menu-btn {
  margin-right: 8px;
}
</style>
