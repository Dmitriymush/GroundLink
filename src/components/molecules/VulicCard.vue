<script setup lang="ts">
import { LeadState, type Vulik } from "@/controllers/api/vulik-api";
import { VCardTitle, VCardText, VCardActions, VBtn, VCard } from "vuetify/components";
import InfoLine from "../atoms/InfoLine.vue";
import { useT } from "@/hooks/use-t";
import { computed, ref } from "vue";

type Props = {
  vulic: Vulik;
  loading: boolean;
};

type Emits = {
  (e: "onOpenLead", v: Vulik): void;
  (e: "onCloseLead", v: Vulik): void;
  (e: "onUnloadDrone", v: Vulik): void;
};

const props = defineProps<Props>();
const emits = defineEmits<Emits>();

const t = useT();
const isOpenAvaliable = computed(() => {
  if (props.vulic.leadState === LeadState.stuck) {
    return true;
  }

  if (props.vulic.dronesCount == 0 && props.vulic.leadState == LeadState.close) {
    return true;
  }

  return false;
});

const isCloseAvalible = computed(() => {
  if (props.vulic.leadState === LeadState.stuck) {
    return true;
  }

  if (props.vulic.dronesCount == 0 && props.vulic.leadState == LeadState.open) {
    return true;
  }

  if (props.vulic.droneReady && props.vulic.leadState === LeadState.open) {
    return true;
  }

  return false;
});
</script>

<template>
  <VCard class="vulik-card" :loading="loading">
    <VCardTitle>Vulic ID: {{ vulic.id }}</VCardTitle>
    <VCardText>
      <InfoLine :label="t('Drones count')">{{ vulic.dronesCount }}</InfoLine>
      <InfoLine :label="t('Lead state')">{{ vulic.leadState }}</InfoLine>
      <InfoLine :label="t('Drone ready')">{{ vulic.droneReady }}</InfoLine>
    </VCardText>
    <VCardActions>
      <VBtn v-if="vulic.dronesCount > 0" color="red" :disabled="loading" @click="$emit('onUnloadDrone', vulic)">
        {{ t("Unload drone") }}
      </VBtn>
      <VBtn v-if="isCloseAvalible" color="green" :disabled="loading" @click="$emit('onCloseLead', vulic)">
        {{ t("Close lead") }}
      </VBtn>
      <VBtn v-if="isOpenAvaliable" color="green" :disabled="loading" @click="$emit('onOpenLead', vulic)">
        {{ t("Open lead") }}
      </VBtn>
    </VCardActions>
  </VCard>
</template>

<style scoped>
.vulik-card {
  max-width: 400px;
  margin: 10px;
}
</style>
