<template>
  <VExpansionPanels class="container">
    <VExpansionPanel>
      <VExpansionPanelTitle>
        <div class="header-content">
          <span class="header-title">{{ t("Primary JR Settings") }}</span>
        </div>
      </VExpansionPanelTitle>
      <VExpansionPanelText>
        <JrSettingsFrom :inital-values="mainJRSettings" @save="saveHandler" />
      </VExpansionPanelText>
    </VExpansionPanel>
  </VExpansionPanels>
</template>

<script setup lang="ts">
import { useT } from "@/hooks/use-t";
import JrSettingsFrom from "../forms/JrSettingsFrom.vue";
import { useJrSettings, type JRSettings } from "@/store";
import { toRefs } from "vue";

const t = useT();
const JRSettingStore = useJrSettings();
const { mainJRSettings } = toRefs(JRSettingStore);

const saveHandler = (value: JRSettings) => {
  mainJRSettings.value = value;
};
</script>

<style scoped>
.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.v-expansion-panel-title {
  height: 64px;
}
</style>