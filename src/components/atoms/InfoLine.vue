<script setup lang="ts">
defineProps<{
  label: string;
}>();
</script>

<template>
  <div class="info-line">
    <div>{{ label }}</div>
    <div>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.info-line {
  display: flex;
  width: 100%;
  justify-content: space-between;
  align-content: center;
}
</style>
