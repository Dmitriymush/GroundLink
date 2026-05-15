<template>
  <svg
    ref="svgRef"
    :viewBox="`0 0 ${size} ${size}`"
    class="azimuth-compass"
    @mousedown="handleMouseDown"
    @mousemove="handleMouseMove"
    @mouseup="handleMouseUp"
    @mouseleave="handleMouseUp"
  >
    <!-- Background circle -->
    <circle
      :cx="center"
      :cy="center"
      :r="radius"
      fill="#1a1a2e"
      stroke="#4a4a6a"
      stroke-width="2"
    />

    <!-- Concentric reference circles -->
    <circle
      v-for="i in concentricCircles"
      :key="`ring-${i}`"
      :cx="center"
      :cy="center"
      :r="(radius / (concentricCircles + 1)) * i"
      fill="none"
      stroke="#3a3a5a"
      stroke-width="1"
      stroke-dasharray="4,4"
      opacity="0.5"
    />

    <!-- Major tick marks (every 30 degrees) -->
    <line
      v-for="angle in majorAngles"
      :key="`major-${angle}`"
      :x1="center + Math.sin(toRadians(angle)) * (radius - tickMajorLength)"
      :y1="center - Math.cos(toRadians(angle)) * (radius - tickMajorLength)"
      :x2="center + Math.sin(toRadians(angle)) * radius"
      :y2="center - Math.cos(toRadians(angle)) * radius"
      stroke="#8a8aaa"
      stroke-width="2"
    />

    <!-- Minor tick marks (every 10 degrees, excluding major) -->
    <line
      v-for="angle in minorAngles"
      :key="`minor-${angle}`"
      :x1="center + Math.sin(toRadians(angle)) * (radius - tickMinorLength)"
      :y1="center - Math.cos(toRadians(angle)) * (radius - tickMinorLength)"
      :x2="center + Math.sin(toRadians(angle)) * radius"
      :y2="center - Math.cos(toRadians(angle)) * radius"
      stroke="#5a5a7a"
      stroke-width="1"
    />

    <!-- Cardinal direction labels -->
    <text
      v-for="cardinal in cardinalPoints"
      :key="cardinal.label"
      :x="center + Math.sin(toRadians(cardinal.angle)) * (radius - labelOffset)"
      :y="center - Math.cos(toRadians(cardinal.angle)) * (radius - labelOffset)"
      text-anchor="middle"
      dominant-baseline="middle"
      fill="#ffffff"
      font-size="16"
      font-weight="bold"
    >
      {{ cardinal.label }}
    </text>

    <!-- Degree labels (every 30 degrees, excluding cardinals) -->
    <text
      v-for="angle in degreeLabels"
      :key="`deg-${angle}`"
      :x="center + Math.sin(toRadians(angle)) * (radius - degreeOffset)"
      :y="center - Math.cos(toRadians(angle)) * (radius - degreeOffset)"
      text-anchor="middle"
      dominant-baseline="middle"
      fill="#aaaacc"
      font-size="11"
    >
      {{ angle }}°
    </text>

    <!-- Center point -->
    <circle :cx="center" :cy="center" r="5" fill="#ffffff" />

    <!-- Tracker actual position (blue arrow, non-interactive) -->
    <CompassArrow
      v-if="trackerAzimuth >= 0"
      :center="center"
      :azimuth="trackerAzimuth"
      :length="radius * 0.65"
      color="#1976d2"
      :animated="true"
    />

    <!-- Target arrow indicator (red, interactive) -->
    <CompassArrow
      :center="center"
      :azimuth="azimuth"
      :length="arrowLength"
      :color="arrowColor"
      :animated="!isDragging"
    />
  </svg>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import CompassArrow from './CompassArrow.vue';

interface Props {
  size?: number;
  azimuth: number; // 0-359 degrees
  elevation?: number; // 0-90 degrees (optional, for arrow length)
  concentricCircles?: number;
  interactive?: boolean;
  arrowColor?: string;
  /** Actual tracker heading (blue arrow, non-interactive). -1 = hidden */
  trackerAzimuth?: number;
}

interface Emits {
  (e: 'update:azimuth', value: number): void;
  (e: 'dragStart'): void;
  (e: 'dragEnd'): void;
}

const props = withDefaults(defineProps<Props>(), {
  size: 300,
  elevation: 45,
  concentricCircles: 3,
  interactive: true,
  arrowColor: '#ff4444',
  trackerAzimuth: -1,
});

const emit = defineEmits<Emits>();

const svgRef = ref<SVGSVGElement | null>(null);
const isDragging = ref(false);

// Computed dimensions
const center = computed(() => props.size / 2);
const radius = computed(() => props.size / 2 - 10);
const tickMajorLength = 15;
const tickMinorLength = 8;
const labelOffset = 35;
const degreeOffset = 55;

// Fixed arrow length
const arrowLength = computed(() => {
  return radius.value * 0.75;
});

// Angle arrays for tick marks
const majorAngles = computed(() => Array.from({ length: 12 }, (_, i) => i * 30));

const minorAngles = computed(() =>
  Array.from({ length: 36 }, (_, i) => i * 10).filter((a) => a % 30 !== 0)
);

const degreeLabels = computed(() => [30, 60, 120, 150, 210, 240, 300, 330]);

const cardinalPoints = [
  { label: 'N', angle: 0 },
  { label: 'E', angle: 90 },
  { label: 'S', angle: 180 },
  { label: 'W', angle: 270 },
];

// Utility function
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

// Mouse interaction handlers
const calculateAzimuthFromEvent = (e: MouseEvent): number => {
  if (!svgRef.value) return props.azimuth;

  const rect = svgRef.value.getBoundingClientRect();
  const scaleX = props.size / rect.width;
  const scaleY = props.size / rect.height;
  const x = (e.clientX - rect.left) * scaleX - center.value;
  const y = (e.clientY - rect.top) * scaleY - center.value;

  // Calculate angle (0 = North, clockwise)
  let angle = Math.atan2(x, -y) * (180 / Math.PI);
  if (angle < 0) angle += 360;

  return Math.round(angle);
};

const handleMouseDown = (e: MouseEvent) => {
  if (!props.interactive) return;
  isDragging.value = true;
  emit('dragStart');
  emit('update:azimuth', calculateAzimuthFromEvent(e));
};

const handleMouseMove = (e: MouseEvent) => {
  if (!isDragging.value || !props.interactive) return;
  emit('update:azimuth', calculateAzimuthFromEvent(e));
};

const handleMouseUp = () => {
  if (isDragging.value) {
    isDragging.value = false;
    emit('dragEnd');
  }
};
</script>

<style scoped>
.azimuth-compass {
  cursor: crosshair;
  user-select: none;
  display: block;
  width: 100%;
  height: 100%;
}
</style>