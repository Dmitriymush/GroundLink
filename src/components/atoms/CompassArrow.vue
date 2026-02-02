<template>
  <g
    class="compass-arrow"
    :style="{
      transform: `rotate(${azimuth}deg)`,
      transformOrigin: `${center}px ${center}px`,
      transition: shouldAnimate ? 'transform 0.15s ease-out' : 'none'
    }"
  >
    <!-- Glow effect filter -->
    <defs>
      <filter id="arrow-glow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur stdDeviation="3" result="coloredBlur" />
        <feMerge>
          <feMergeNode in="coloredBlur" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    </defs>

    <!-- Arrow glow (background) -->
    <line
      :x1="center"
      :y1="center"
      :x2="center"
      :y2="center - length"
      :stroke="color"
      stroke-width="6"
      stroke-linecap="round"
      opacity="0.3"
      filter="url(#arrow-glow)"
    />

    <!-- Arrow shaft -->
    <line
      :x1="center"
      :y1="center"
      :x2="center"
      :y2="center - length"
      :stroke="color"
      stroke-width="3"
      stroke-linecap="round"
    />

    <!-- Arrow head (triangle) -->
    <polygon :points="arrowHeadPoints" :fill="color" />
  </g>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';

interface Props {
  center: number;
  azimuth: number; // 0-359 degrees
  length: number; // Arrow length in pixels
  color?: string;
  animated?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  color: '#ff4444',
  animated: true,
});

const shouldAnimate = ref(props.animated);

// Handle 359->0 and 0->359 wraparound to avoid 359-degree spin
watch(
  () => props.azimuth,
  (newVal, oldVal) => {
    if (oldVal === undefined) return;
    const diff = Math.abs(newVal - oldVal);
    // Disable animation for large jumps (wraparound)
    if (diff > 180) {
      shouldAnimate.value = false;
      setTimeout(() => {
        shouldAnimate.value = props.animated;
      }, 20);
    }
  }
);

// Calculate arrow head points (triangle at tip)
const arrowHeadPoints = computed(() => {
  const tipY = props.center - props.length;
  const headSize = 12;
  return `
    ${props.center},${tipY}
    ${props.center - headSize / 2},${tipY + headSize}
    ${props.center + headSize / 2},${tipY + headSize}
  `;
});
</script>

<style scoped>
.compass-arrow {
  pointer-events: none;
}
</style>