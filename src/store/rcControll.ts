import { defineStore } from 'pinia';
import { ref } from 'vue';


export const useRcControllStore = defineStore('rcControll', () => {
    const status = ref<boolean>(false);

    return { status }
});