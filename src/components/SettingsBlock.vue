<script setup lang="ts">
import { onBeforeMount, ref, watch } from 'vue';
import { useT } from "../hooks/use-t";
import { type socketSettings } from '../types/settings-block';

const props = defineProps({
  host: { type: String, default: '' },
  port: { type: Number, default: 0 }
});

const emit = defineEmits<{
  (e: 'save', value: socketSettings): void
}>()

const notification = ref(false);
const t = useT();

const host = ref(props.host);
const port = ref<number | null>(props.port);

const loadStoredSettings = (): void => {
  host.value = String(window.localStorage.getItem("host") || '');
  port.value = Number(window.localStorage.getItem("port")) || null;

  if (host.value && port.value) {
    emit('save', {
      host: host.value,
      port: port.value,
    })
  }
};

const saveHandle = (): void => {
  window.localStorage.setItem('host', host.value);
  window.localStorage.setItem('port', String(port.value));

  notification.value = true;
  emit('save', { host: host.value, port: port.value || 0 });
};

onBeforeMount(() => loadStoredSettings());

watch(() => props.port, () => {
  port.value = props.port;
})

watch(() => props.host, () => {
  host.value = props.host
})
</script>

<template>
  <v-card>
    <v-card-title>
      {{ t('Settings') }}
    </v-card-title>
    <v-card-text>
      <v-text-field label="Host" v-model.trim="host" variant="outlined" placeholder="127.0.0.1" />

      <v-text-field label="Port" type="number" v-model="port" variant="outlined" placeholder="27015" />
    </v-card-text>

    <v-card-actions>
      <v-btn variant="elevated" block @click="saveHandle">{{ t('Save') }}</v-btn>
    </v-card-actions>

    <v-snackbar v-model="notification">
      {{ t('Saved') }}
    </v-snackbar>
  </v-card>
</template>

<style scoped></style>