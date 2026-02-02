<template>
  <VCard>
    <VCardTitle>{{ label }}</VCardTitle>
    <VCardText>
      <!-- <VBtn
        :color="value <= 0 ? 'green' : 'inherit'"
        @click="$emit('update:value', 0)"
        style="margin: 5px"
        >LOW (1000)</VBtn
      >
      <VBtn
        v-if="!limited"
        :color="value === 1024 ? 'yellow' : 'inherit'"
        @click="$emit('update:value', 1024)"
        style="margin: 5px"
        >MID (1500)</VBtn
      >
      <VBtn
        :color="value >= 2047 ? 'red' : 'inherit'"
        @click="$emit('update:value', 2047)"
        style="margin: 5px"
        >HIGHT (2000)</VBtn
      > -->

      <VBtn
        v-for="button of buttons"
        :key="button.id"
        :value="button.value"
        style="margin: 5px"
        :color="value === button.value ? 'primary' : 'inherit'"
        @click="$emit('update:value', button.value)"
      >
        {{ button.label }}
      </VBtn>
    </VCardText>
  </VCard>
</template>

<script setup lang="ts">
import { defineProps, defineEmits, computed } from "vue";

type Props = {
  value: number;
  label: string;
  limited: boolean,
  position?: number;
};

type Emits = {
  (e: "update:value", v: number): void;
};

const props = defineProps<Props>();
defineEmits<Emits>();

const positions = props.position || 3;

const buttons = computed(() => {
  const buttons = [];
  const k = (2000 - 1000) / (positions -1);
  const km = 2047 / (positions -1);
  for (let i = 0; i < positions; i++) {
    buttons.push({
      id: i,
      label: 1000 + (k * i),
      value: Math.round(km * i),
    })
  }

  return buttons;
})
</script>
