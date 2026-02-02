<template>
    <status :status="status" :title="t('Joystic status')" />
</template>

<script setup lang="ts">
import { useT } from '@/hooks/use-t';
import Status from '@/components/atoms/Status.vue';

defineProps<{
    status: boolean
}>()

const t = useT();
</script>