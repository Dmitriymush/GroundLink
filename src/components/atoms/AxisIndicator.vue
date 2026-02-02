<script setup lang="ts">
defineProps<{
    axis: number,
    label: string,
}>()
</script>

<template>
    <div class="axis-indicator">
        <div class="label-container">
            <span>{{ label }}</span>
        </div>
        <v-progress-linear :model-value="axis" :max="2048" />
    </div>
</template>

<style scoped>
.axis-indicator {}

.axis-indicator .label-container {
    display: flex;
    justify-content: left;
}
</style>