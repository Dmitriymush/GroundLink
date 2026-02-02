<template>
  <VContainer class="antenna-control" fluid>
    <!-- Instruction Title -->
    <VRow justify="center" class="text-center mb-4">
      <VCol cols="12" md="8">
        <h2 class="font-weight-medium">
          {{ t('Antenna Control System') }}
        </h2>
        <p class="text-subtitle-1">
          {{
            t(
              'Use arrow keys or drag on compass to control antenna. Hold Shift for faster movement.'
            )
          }}
        </p>
      </VCol>
    </VRow>

    <!-- Azimuth Controller -->
    <VRow justify="center">
      <VCol cols="12" md="8" lg="6">
        <AzimuthController :compass-size="350" :send-interval="20" />
      </VCol>
    </VRow>
  </VContainer>
</template>

<script setup lang="ts">
import { useT } from '@/hooks/use-t';
import AzimuthController from '@/components/molecules/AzimuthController.vue';

const t = useT();
</script>

<style scoped>
.antenna-control {
  padding-top: 24px;
  padding-bottom: 24px;
}
</style>