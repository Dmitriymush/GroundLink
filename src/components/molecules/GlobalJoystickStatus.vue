<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
import { devices } from '@/controllers/devices';
import { useT } from '@/hooks/use-t';
import { useRcControllStore } from '@/store'

const rcControllStore = useRcControllStore();
const t = useT();

const setStatus = (val: boolean): void => {
    rcControllStore.status = val;
    console.log('set status', val);
}

onMounted(() => {
    devices.on('status', setStatus)
});

onBeforeUnmount(() => {
    devices.off('status', setStatus);
    devices.stop();
})
</script>

<template>
    <v-card :color="rcControllStore.status ? 'green' : 'red'" v-if="rcControllStore.status">
        <v-card-text>
            {{ t('Remote controll active') }}
        </v-card-text>
    </v-card>
</template>

<style scoped></style>