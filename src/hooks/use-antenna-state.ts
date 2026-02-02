import { computed, readonly } from 'vue';
import { useSessionStorage } from '@vueuse/core';
import { mapValue } from '@/utils';

export interface AntennaState {
  hozRaw: number; // 0-2047
  verRaw: number; // 0-2047
  power: boolean;
  tracking: boolean;
}

// Azimuth offset: hardware 0 = display 45°
const AZIMUTH_OFFSET = 45;

export function useAntennaState() {
  // Raw hardware values (0-2047 range)
  const hozRaw = useSessionStorage('antenna-hoz', 0);
  const verRaw = useSessionStorage('antenna-ver', 1024); // Start at ~45 deg

  // Toggle states
  const power = useSessionStorage('antenna-power', false);
  const tracking = useSessionStorage('antenna-tracking', false);

  // Display values (degrees)
  // Hardware to display: add offset (hardware 0 shows as 45°)
  const azimuthDegrees = computed(() => {
    const hardwareDeg = mapValue(hozRaw.value, 0, 2047, 0, 359);
    return ((hardwareDeg + AZIMUTH_OFFSET) % 360 + 360) % 360;
  });
  const elevationDegrees = computed(() => mapValue(verRaw.value, 0, 2047, 0, 90));

  // Setters from degrees (display to hardware: subtract offset)
  const setAzimuthDegrees = (deg: number) => {
    const hardwareDeg = ((deg - AZIMUTH_OFFSET) % 360 + 360) % 360;
    hozRaw.value = mapValue(hardwareDeg, 0, 359, 0, 2047);
  };

  const setElevationDegrees = (deg: number) => {
    const clamped = Math.max(0, Math.min(90, deg));
    verRaw.value = mapValue(clamped, 0, 90, 0, 2047);
  };

  // Setters for raw values
  const setAzimuthRaw = (value: number) => {
    hozRaw.value = Math.max(0, Math.min(2047, Math.round(value)));
  };

  const setElevationRaw = (value: number) => {
    verRaw.value = Math.max(0, Math.min(2047, Math.round(value)));
  };

  // Step functions with wraparound for azimuth
  const stepAzimuth = (delta: number, wrap = true) => {
    let newValue = hozRaw.value + delta;
    if (wrap) {
      if (newValue < 0) newValue = 2047 + newValue;
      else if (newValue > 2047) newValue = newValue - 2047;
    } else {
      newValue = Math.max(0, Math.min(2047, newValue));
    }
    hozRaw.value = Math.round(newValue);
  };

  // Step function for elevation (clamped, no wrap)
  const stepElevation = (delta: number) => {
    verRaw.value = Math.round(Math.max(0, Math.min(2047, verRaw.value + delta)));
  };

  // Reset to default position
  const reset = () => {
    hozRaw.value = 0;
    verRaw.value = 1024;
  };

  return {
    // Raw values (for hardware communication)
    hozRaw: readonly(hozRaw),
    verRaw: readonly(verRaw),

    // Display values (degrees)
    azimuthDegrees,
    elevationDegrees,

    // Toggle states
    power,
    tracking,

    // Setters
    setAzimuthDegrees,
    setElevationDegrees,
    setAzimuthRaw,
    setElevationRaw,
    stepAzimuth,
    stepElevation,
    reset,
  };
}