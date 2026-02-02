<template>
  <remote-controll-container>
    <template #actions>
      <joystic-status :status="status" />
      <v-switch
        v-model="showControlls"
        :label="t('Show controlls')"
        hide-details
      />
      <v-switch
        v-model="allowAllDevices"
        :label="t('Allow all devices')"
        :color="allowAllDevices? 'red' :'inherit'"
        hide-details
      />

      <v-btn color="red" v-if="selectedJoystic" @click="selectedJoystic = null">
          {{  t('Disable remote controll') }}
      </v-btn>
    </template>

    <template #menu>
      <joystic-select 
        v-model:active-joystic="selectedJoystic" 
        :allow-all-devices="allowAllDevices"  
      />
      <joystic-controlls v-if="showControlls"/>
    </template>
  </remote-controll-container>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, onBeforeUnmount } from 'vue';
import RemoteControllContainer from '@/components/remote_controll/RemoteControllContainer.vue';
import JoysticControlls from '../remote_controll/JoysticControlls.vue';
import JoysticStatus from '../remote_controll/JoysticStatus.vue';
import { devices } from '@/controllers/devices';
import JoysticSelect from '../remote_controll/JoysticSelect.vue';
import type { Device } from 'node-hid';
import { useT } from '@/hooks/use-t';


const status = ref(false);
const selectedJoystic = ref<any>();
const showControlls = ref<boolean>(false);
const t = useT();
const allowAllDevices = ref<boolean>(false);


const setJoysticStatus = (currentStatus: boolean): void => {
  status.value = currentStatus
}

watch(selectedJoystic, (joystic: Device) => {
  console.log('selectedJoystic', joystic);
  devices.stop();
  devices.setDevice(joystic);
})

onMounted(() => {
  devices.on('status', setJoysticStatus)
  selectedJoystic.value = devices.device
});

onBeforeUnmount(() => {
  devices.off('status', setJoysticStatus);
})

</script>

<style scoped>
</style>