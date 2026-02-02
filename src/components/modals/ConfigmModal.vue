<template>
  <VDialog :modelValue="!!text" persistent width="700">
    <VCard>
      <VCardTitle>{{ t("Are you sure ?") }}</VCardTitle>

      <VCardText>{{ text }}</VCardText>

      <VCardActions>
        <VBtn color="green" @click="$emit('onCancel')" variant="elevated">
          No
        </VBtn>
        <VBtn color="red" @click="$emit('onSuccess')">Yes</VBtn>
      </VCardActions>
    </VCard>
  </VDialog>
</template>

<script setup lang="ts">
import { useT } from "@/hooks/use-t";
import {
  VBtn,
  VCard,
  VCardActions,
  VCardTitle,
  VDialog,
} from "vuetify/components";

type Props = {
  text: string;
};

defineProps<Props>();
defineEmits(["onSuccess", "onCancel"]);

const t = useT();
</script>
