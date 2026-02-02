<template>
  <VDialog :modelValue="open" persistent width="700">
    <VCard>
      <VCardTitle>{{ t("Vulik presets") }}</VCardTitle>

      <VCardText>
        <div v-for="preset in presets" :key="preset.name" class="preset-item">
          <VBtn color="primary" @click="selectPreset(preset)">
            {{ preset.name }} | {{ preset.host }}:{{ preset.port }}
          </VBtn>
        </div>
      </VCardText>

      <VCardActions>
        <VBtn color="decline" @click="emit('close')">{{ t("Cancel") }}</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<script lang="ts" setup>
import { useT } from "@/hooks/use-t";
import { useAppSeetingsStore } from "@/store/app-settings-store";
import { getVulikPresets } from "@/utils/vulik-presets";

type Props = {
  open: boolean;
};

type Preset = {
  name: string;
  host: string;
  port: number;
};

type Emits = {
  (e: "close"): void;
  (e: "save", host: string, port: number): void;
};

const props = defineProps<Props>();
const emit = defineEmits<Emits>();
const t = useT();
const store = useAppSeetingsStore();

const presets = getVulikPresets();

const selectPreset = (preset: Preset) => {
  // Update the current connection with the new Vulik settings
  const updatedConnection = {
    ...store.selectedConnection,
    vulikHost: preset.host,
    vulikPort: preset.port,
  };

  emit("save", preset.host, preset.port);
};
</script>

<style scoped>
.preset-item {
  margin: 10px 0;
}
</style>
