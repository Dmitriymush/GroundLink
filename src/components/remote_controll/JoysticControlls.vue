<script setup lang="ts">
import { onBeforeUnmount } from 'vue';
import { onBeforeMount } from 'vue';
import { reactive } from 'vue';
import AxisIndicator from '../atoms/AxisIndicator.vue';
import { devices } from '@/controllers/devices'
import type { Channels } from '@/controllers/devices';

const axis = reactive({
    aleron: 0,
    evelon: 0,
    throttle: 0,
    yaw: 0,
    arm: 0,
    mode: 0,
    aux2: 0,
    aux3: 0,
    aux4: 0,
    aux5: 0,
    aux6: 0,
    aux7: 0,
    aux8: 0,
    aux9: 0,
    aux10: 0,
    aux11: 0,
    aux12: 0,
});

const dataHandle = (channels: Channels): void => {
    axis.aleron = channels.roll;
    axis.evelon = channels.pitch;
    axis.throttle = channels.throttle;
    axis.yaw = channels.yaw;
    axis.arm = channels.arm;
    axis.mode = channels.mode;
    axis.aux3 = channels.aux3;
    axis.aux4 = channels.aux4;
    axis.aux5 = channels.aux5;
    axis.aux6 = channels.aux6;
    axis.aux7 = channels.aux7;
    axis.aux8 = channels.aux8;
    axis.aux9 = channels.aux9;
    axis.aux10 = channels.aux10;
    axis.aux11 = channels.aux11;
    axis.aux12 = channels.aux12;
}

onBeforeMount(() => {
    devices.on('data', dataHandle);
});

onBeforeUnmount(() => {
    devices.off('data', dataHandle);
});

</script>

<template>
    <div class="joystic-controlls">
        <axis-indicator :axis="axis.aleron" label="(CH1) ROLL"/>
        <axis-indicator :axis="axis.evelon" label="(CH2) PITCH"/>
        <axis-indicator :axis="axis.throttle" label="(CH3) THROTTLE"/>
        <axis-indicator :axis="axis.yaw" label="(CH4) YAW"/>
        <axis-indicator :axis="axis.arm" label="(CH5) ARM"/>
        <axis-indicator :axis="axis.mode" label="(CH6) MODE"/>
        <axis-indicator :axis="axis.aux3" label="(CH7) AUX 3"/>
        <axis-indicator :axis="axis.aux4" label="(CH8) AUX 4" />
        <axis-indicator :axis="axis.aux5" label="(CH9) AUX 5" />
        <axis-indicator :axis="axis.aux6" label="(CH10) AUX 6" />
        <axis-indicator :axis="axis.aux7" label="(CH11) AUX 7" />
        <axis-indicator :axis="axis.aux8" label="(CH12) AUX 8" />
        <axis-indicator :axis="axis.aux9" label="(CH13) AUX 9" />
        <axis-indicator :axis="axis.aux10" label="(CH14) AUX 10" />
        <axis-indicator :axis="axis.aux11" label="(CH15) AUX 11" />
        <axis-indicator :axis="axis.aux12" label="(CH16) AUX 12" />
    </div>
</template>

<style scoped>
.joystic-controlls {

}

.joystic-controlls > * {
    margin-top: 5px;
}
</style>