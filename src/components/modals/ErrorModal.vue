<template>
  <VDialog :modelValue="!!error" persistent>
    <VCard>
      <VCardTitle class="text-error">{{ t("Error") }}</VCardTitle>

      <VCardText>{{ error }}</VCardText>

      <VCardActions>
        <VBtn color="primary" @click="$emit('close')" variant="elevated">
          {{ t("Close") }}
        </VBtn>
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
  error?: string | null;
};

defineProps<Props>();
defineEmits(["close"]);

const t = useT();
</script>
