import { useStorage } from '@vueuse/core';
import { defineStore } from 'pinia';
import { devices } from '@/controllers/devices';
import { watch } from 'vue';


export type JRSettings = {
    baudRate: number;
    refreshRate: number;
}

export const useJrSettings = defineStore('jr-settings', () => {
    const mainJRSettings = useStorage<JRSettings>('main-jr-settings', {
        baudRate: 115200,
        refreshRate: 50,
    });

    const secondaryJRSettings = useStorage<JRSettings>('secondary-jr-settings', {
        baudRate: 115200,
        refreshRate: 50,
    });
    

    watch(mainJRSettings, (value) => {
        console.log('mainJRSettings changed', value);
        devices.setRefrashRate(value.refreshRate);
    })

    return { mainJRSettings, secondaryJRSettings };
});