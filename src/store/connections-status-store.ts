import { defineStore } from 'pinia';
import { ref } from 'vue';


export const useConnectionStatus = defineStore('connection-status', () => {
    const isRpanionConnected = ref<boolean>(false);
    const isMegaConnected = ref<boolean>(false);
    const isVideoStarted = ref<boolean>(false);

    return { isRpanionConnected, isMegaConnected, isVideoStarted }
});