<script lang="ts" setup>
import { ref, computed } from 'vue';
import { useT } from '@/hooks/use-t';
import { onBeforeUnmount } from 'vue';
import { video } from '@/controllers/video';
import { onMounted } from 'vue';


const t = useT();
const videoStatus = ref<boolean>(false);

const openVideoText = computed(() => videoStatus.value ? t('Video starded') : t('Open video'));

const clickVideoHandle = () => {
    video.start();
};

const resetVideoHandle = () => {
    video.stop();
    video.start();
};

const setVideoActive = (): void => {
    videoStatus.value = true;
}

const setVideoStatusFalse = (): void => {
    videoStatus.value = false;
}

const openButtonClasses = computed(() => ({
    'started': videoStatus.value
}))

onMounted(() => {
    video.on('data', setVideoActive);
    video.on('close', setVideoStatusFalse);
})

onBeforeUnmount(() => {
    video.stop();
    video.off('data', setVideoActive);
    video.off('close', setVideoStatusFalse);
})
</script>

<template>
    <div class="open-video-button">
        <v-btn 
            class="open"
            :class="openButtonClasses"
            :color="!videoStatus ? 'green' : 'red'" 
            :disabled="videoStatus"
            @click="clickVideoHandle"
        >
            {{ openVideoText }}
        </v-btn>

        <v-btn 
            v-if="videoStatus" 
            color="red" 
            class="reset"
            @click="resetVideoHandle"
        >
            <v-icon icon="mdi-cached" />
        </v-btn>
    </div>
</template>

<style scoped>
.open-video-button {
  margin-top: 10px;
  display: flex;
  width: 100%;
}

.open-video-button .open {
    width: 100%;
}

.open-video-button .reset {
    margin-left: 10px;
}

.open-video-button .started {
    width: 74% !important;
}
</style>