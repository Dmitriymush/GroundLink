<script setup lang="ts">
import { useT } from '@/hooks/use-t';
import { useStorage } from '@vueuse/core';
import { shell } from "electron";

const t = useT();
const host = useStorage<string| null>('host', null);

const clickHandle = () => {
    shell.openExternal(`http://${host.value}:3000/`)
}
</script>

<template>
    <div class="root">
        <VBtn color="primary" @click=clickHandle>
            {{ t('Go to site') }}
        </VBtn>
    </div>
</template>

<style scoped>
.root  {
  margin: 10px;
  display: flex;
  /* Center the button instead of aligning it to the end */
  justify-content: center;
}
</style>