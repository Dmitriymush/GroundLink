<template>
  <VTooltip :text="tooltip" location="bottom">
    <template v-slot:activator="{ props }">
      <VIcon
        v-bind="props"
        class="action-icon"
        size="small"
        @click.stop="$emit('click')"
      >
        {{ icon }}
      </VIcon>
    </template>
  </VTooltip>
</template>

<script setup lang="ts">
import { VIcon, VTooltip } from "vuetify/components";

defineProps<{
  icon: string;
  tooltip: string;
}>();

defineEmits(["click"]);
</script>

<style scoped>
.action-icon {
  cursor: pointer;
  transition: all 0.2s ease;
  opacity: 0.7;
  padding: 4px;
  border-radius: 4px;
}

.action-icon:hover {
  opacity: 1;
  background-color: rgba(76, 175, 80, 0.1);
  color: rgb(76, 175, 80);
}

.action-icon:active {
  background-color: rgba(76, 175, 80, 0.2);
  transform: scale(0.95);
}
</style>
