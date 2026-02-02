<template>
  <VContainer>
    <VCard>
      <VCardTitle>{{ t("Second JR") }}</VCardTitle>

      <VCardText>
        <div class="analog-container">
          <RCAnalog
            v-for="channel in analogChannels"
            :key="channel.ch"
            :label="t('Channel') + ' ' + channel.ch"
            :value="channel.value"
            style="margin: 10px;"
            @update:value="changeValue(channel.ch, $event)"
          />
        </div>

        <VDivider></VDivider>

        <div class="switches-container">
          <RCSwitch
            v-for="channel in switchChannels"
            :key="channel.ch"
            :label="t('Channel') + ' ' + channel.ch"
            :value="channel.value"
            :limited="channel.limited || false"
            style="margin: 10px;"
            @update:value="changeValue(channel.ch, $event)"
          />
        </div>
      </VCardText>
    </VCard>
  </VContainer>
</template>

<script lang="ts" setup>
import RCSwitch from "@/components/atoms/RCSwitch.vue";
import { useT } from "@/hooks/use-t";
import { useSessionStorage } from "@vueuse/core";
import { computed } from "vue";
import RCAnalog from "../atoms/RCAnalog.vue";
import { virtualJR } from '@/controllers/virtualJR';

const t = useT();

const channels = useSessionStorage("channels", [
  { ch: 1, value: 1024 },
  { ch: 2, value: 1024 },
  { ch: 3, value: 1024 },
  { ch: 4, value: 1024 },
  { ch: 5, value: 0 },
  { ch: 6, value: 0 },
  { ch: 7, value: 0 },
  { ch: 8, value: 0 },
  { ch: 9, value: 0, limited: true },
  { ch: 10, value: 0, limited: true },
  { ch: 11, value: 0, limited: true },
  { ch: 12, value: 0, limited: true },
]);

const channesMap = virtualJR.channelsMap;

const switchChannels = computed(() => channels.value.filter((v, i) => i >= 4));
const analogChannels = computed(() => channels.value.filter((v, i) => i < 4));

const setValues = () => {
  virtualJR.setChannel(channesMap.CH1, channels.value[0].value);
  virtualJR.setChannel(channesMap.CH2, channels.value[1].value);
  virtualJR.setChannel(channesMap.CH3, channels.value[2].value);
  virtualJR.setChannel(channesMap.CH4, channels.value[3].value);
  virtualJR.setChannel(channesMap.CH5, channels.value[4].value);
  virtualJR.setChannel(channesMap.CH6, channels.value[5].value);
  virtualJR.setChannel(channesMap.CH7, channels.value[6].value);
  virtualJR.setChannel(channesMap.CH8, channels.value[7].value);
  virtualJR.setChannel(channesMap.CH9, channels.value[8].value);
  virtualJR.setChannel(channesMap.CH10, channels.value[9].value);
  virtualJR.setChannel(channesMap.CH11, channels.value[10].value);
  virtualJR.setChannel(channesMap.CH12, channels.value[11].value);
}

const changeValue = (ch: number, value: number) => {
  channels.value = channels.value.map((v) => (v.ch === ch ? { ...v, value } : v));
  setValues();
};

setValues();
virtualJR.start();
</script>

<style scoped>
.switches-container {
  display: flex; flex-wrap: wrap; justify-content: center;
}

.analog-container {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
}
</style>
