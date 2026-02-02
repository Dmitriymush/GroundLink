<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useT } from "../hooks/use-t";
import { ACTIONS } from "../constants/actions";
import Joystick from "./atoms/joystick.vue";
import DetonatePage from './pages/DetonatePage.vue'
import RemoteControllPage from './pages/RemoteControllPage.vue';

const t = useT();
const action = ref(null);
const protectSwitch = ref(false);
const detonateSwitch = ref(false);

const emit = defineEmits<{
  (e: 'detonate'): void,
  (e: 'cancel'): void,
  (e: 'arm', value: boolean): void
}>()

const actions = [
  { name: t('Remote controll'), value: ACTIONS.REMOTE },
  { name: t('Detonate'), value: ACTIONS.DETONATE },
]

const isDetonate = computed(() => action.value === ACTIONS.DETONATE);
const isRemoteControll = computed(() => action.value === ACTIONS.REMOTE);

watch(protectSwitch, (state: boolean): void => {
  emit('arm', state);

  if (!state) {
    detonateSwitch.value = false;
    emit("cancel");
  }
});

watch(detonateSwitch, (state: boolean): void => {
  if (!state) {
    emit('cancel');
  } else {
    emit('detonate')
  }
})
</script>

<template>
  <v-card class="root">
    <v-card-title>
      {{ t('Actions') }}
    </v-card-title>

    <v-card-text>
      <v-select :label="t('Select type')" :items="actions" variant="outlined" item-title="name" item-value="value"
        v-model="action" />

      <v-divider />

      <detonate-page
        v-if="isDetonate"
        v-model:protectSwitch="protectSwitch"
        :detonate-switch="detonateSwitch"
        @detonate="detonateSwitch = !detonateSwitch"
      />

      <remote-controll-page v-if="isRemoteControll"/>
    </v-card-text>
  </v-card>
</template>

<style scoped>
.root {
  min-width: 700px;
}


.bomb-alert {
  margin: 10px;
}

.bomb-button {
  max-width: 700px;
}
</style>