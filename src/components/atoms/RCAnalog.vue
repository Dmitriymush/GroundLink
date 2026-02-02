<template>
  <VCard style="width: 400px">
    <VCardTitle>{{ label }} {{ pwmValue }}</VCardTitle>
    <VCardText>
      <div style="display: flex">
        <VBtn color="primary" class="margin" icon @click="backButtonClick">
          <VIcon>mdi-chevron-left</VIcon>
        </VBtn>
        <VSlider
          color="primary"
          class="margin"
          :modelValue="value"
          :min="0"
          :max="2047"
          @update:modelValue="emitChange"
          hideDetails
        ></VSlider>
        <VBtn color="primary" class="margin" icon @click="plusButtonClick">
          <v-icon>mdi-chevron-right</v-icon>
        </VBtn>
      </div>

      <div>
        <VBtn :color="value === 1024 ? 'primary': 'inherit'" @click="emitChange(1024)">MID (1500)</VBtn>
      </div>
    </VCardText>
  </VCard>
</template>

<script setup lang="ts">
import { mapValue } from '@/utils';
import { computed } from 'vue';
import { VBtn } from 'vuetify/components';

type Props = {
  label: string;
  value: number;
};

type Emits = {
  (event: 'update:value', value: number): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const pwmValue = computed(() => mapValue(props.value, 0, 2047, 1000, 2000));

const emitChange = (value: number): void => {
  console.log('set analog value', props.label, props.value)
  emit('update:value', Math.round(value));
}

const backButtonClick = () => {
  if (props.value > 0) {
    emitChange(props.value - 10);
  } else {
    emitChange(2047)
  }
};

const plusButtonClick = () => {
  if (props.value < 2047) {
    emitChange(props.value + 10);
  } else {
    emitChange(2047);
  }
};
</script>

<style scoped>
.margin {
  margin: 5px;
}
</style>
