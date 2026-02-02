<template>
  <v-chip :color="chipColor" size="small" class="mx-1" :pill="!text">
    <v-tooltip :text="tooltip" activator="parent" />
    <v-icon :icon="displayIcon" size="x-small" :class="{ 'mr-1': text }" />
    {{ text }}
  </v-chip>
</template>

<script lang="ts" setup>
import { computed } from "vue";

type Props = {
  status: boolean;
  tooltip: string;
  text?: string;
  icon?: string;
};

const props = defineProps<Props>();

const chipColor = computed(() => (props.status ? "success" : "error"));

const displayIcon = computed(() => props.icon || "mdi-connection");
</script>
