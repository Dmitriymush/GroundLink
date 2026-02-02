<template>
    <v-card :color="show ? 'green' : 'red'" v-if="show">
        <v-card-text>
            {{ t('Drone manual channel controll active') }}
        </v-card-text>
    </v-card>
</template>

<script setup lang="ts">
import { useDroneControll } from '@/hooks/drone-controll';
import { useT } from '@/hooks/use-t';
import { useRcControllStore } from '@/store'
import { computed } from 'vue';

const { droneControllEnable } = useDroneControll();
const rcDroneStore = useRcControllStore();

const t = useT();

const show = computed(() => (
    rcDroneStore.status && droneControllEnable
))
</script>