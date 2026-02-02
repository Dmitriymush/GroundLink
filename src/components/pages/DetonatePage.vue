<script setup lang="ts">
import detonateContainer from '../detonate/DetonateContainer.vue';
import { useT } from '@/hooks/use-t';

const t = useT();

defineProps<{
  protectSwitch: boolean,
  detonateSwitch: boolean,
}>()

defineEmits<{
  (e: 'detonate'): void,
  (e: 'update:protectSwitch', v: boolean): void,
}>()

</script>

<template>
  <detonate-container>
    <template #default>
      <v-switch :label="t('Protect switch')" :value="!protectSwitch" :color="!protectSwitch ? 'green' : 'red'" 
        @click="$emit('update:protectSwitch', !protectSwitch)"
      />
      <v-alert v-if="protectSwitch" :text="t('Warning, protection is off')" variant="outlined" type="warning"
        class="bomb-alert" />
    </template>

    <template #mainAction>
      <v-btn v-if="protectSwitch" class="detonate-button" @click="$emit('detonate')" :disabled="!protectSwitch" :color="detonateSwitch ? 'red' : 'green'">
        {{ detonateSwitch ? t('Cancel') : t('Make cool') }}
      </v-btn>
    </template>
  </detonate-container>
</template>

<style scoped>
  .detonate-button {
    width: 100%;
    height: 100px;
  }
</style>