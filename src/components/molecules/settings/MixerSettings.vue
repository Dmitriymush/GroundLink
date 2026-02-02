<template>
  <VExpansionPanels class="container">
    <VExpansionPanel>
      <VExpansionPanelTitle>
        <div class="header-content">
          <span class="header-title">{{ t("Mixer Settings") }}</span>
          <!-- Optional: You can add a status badge here if needed -->
          <!-- <v-chip v-if="someStatus" color="warning" dense text class="status-chip">
            {{ t("Status") }}
          </v-chip> -->
        </div>
      </VExpansionPanelTitle>
      <VExpansionPanelText>
        <div
            v-for="(channel, index) in settings"
            :key="index"
            class="mixer-line"
        >
          <VSelect
              variant="outlined"
              class="mixer-control"
              label="Input"
              :model-value="channel.input"
              :items="channels"
              hide-details
              @update:modelValue="changeInputHandle(channel)($event || '')"
          />
          <!-- Replace checkbox with toggle switch -->
          <VSwitch
              inset
              class="mixer-control"
              label="Reverse"
              :model-value="channel.reverse"
              color="primary"
              hide-details
              @update:modelValue="changeReverseHandle(channel)($event || false)"
          />
          <VSelect
            variant="outlined"
            label="Output"
            :model-value="channel.output"
            hide-details
            disabled
          />
        </div>
      </VExpansionPanelText>
    </VExpansionPanel>
  </VExpansionPanels>
</template>

<script setup lang="ts">
import type { Mix } from "@/controllers/rc-mixes";
import { useMixerStettings } from "@/store/mixer-settings-store";
import { computed, toRefs } from "vue";
import {
  VCheckbox,
  VSelect,
  VExpansionPanels,
  VExpansionPanel,
  VExpansionPanelTitle,
  VExpansionPanelText
} from "vuetify/components";
import { useT } from "@/hooks/use-t";

// If useT returns a function directly, assign it like so:
const t = useT();

const mixerSettings = useMixerStettings();
const { setMix } = mixerSettings;
const { mixes } = toRefs(mixerSettings);

const settings = computed(() => {
  return mixes.value || [];
});

const channels = computed(() => {
  return mixes.value?.map((mix) => mix.output) || [];
});

const changeInputHandle = (mix: Mix) => (value: string) => {
  setMix({ ...mix, input: value });
};

const changeReverseHandle = (mix: Mix) => (value: boolean) => {
  setMix({ ...mix, reverse: value });
};
</script>

<style scoped>

/* Custom Header Styling */
.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

/* Mixer Line Styling */
.mixer-line {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #eee;
}

.mixer-line:last-child {
  border-bottom: none;
}

.mixer-control {
  width: 100%;
}

.v-expansion-panel-title {
  height: 64px;
}
</style>