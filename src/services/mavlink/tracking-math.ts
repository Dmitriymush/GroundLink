/**
 * Antenna Auto-Tracking Math
 *
 * Calculates bearing and elevation angle from ground station to drone
 * using Haversine formula and basic trigonometry.
 */

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;
const EARTH_RADIUS_M = 6371000;

export interface GeoPosition {
  lat: number;  // degrees
  lon: number;  // degrees
  alt: number;  // meters MSL
}

export interface TrackingAngles {
  azimuth: number;    // degrees, 0-360 (0=North, 90=East)
  elevation: number;  // degrees, 0-90
  distance: number;   // meters (ground distance)
}

/**
 * Calculate ground distance between two points using Haversine formula
 */
export function haversineDistance(from: GeoPosition, to: GeoPosition): number {
  const dLat = (to.lat - from.lat) * DEG_TO_RAD;
  const dLon = (to.lon - from.lon) * DEG_TO_RAD;
  const lat1 = from.lat * DEG_TO_RAD;
  const lat2 = to.lat * DEG_TO_RAD;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Calculate bearing from point A to point B
 * Returns degrees 0-360 (0=North, 90=East)
 */
export function calculateBearing(from: GeoPosition, to: GeoPosition): number {
  const lat1 = from.lat * DEG_TO_RAD;
  const lat2 = to.lat * DEG_TO_RAD;
  const dLon = (to.lon - from.lon) * DEG_TO_RAD;

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  const bearing = Math.atan2(y, x) * RAD_TO_DEG;
  return (bearing + 360) % 360;
}

/**
 * Calculate elevation angle from ground station to drone
 * Returns degrees 0-90
 */
export function calculateElevation(from: GeoPosition, to: GeoPosition, groundDistance: number): number {
  const altDiff = to.alt - from.alt;

  if (groundDistance < 1) {
    // Drone is directly above — look straight up
    return altDiff > 0 ? 90 : 0;
  }

  const elevation = Math.atan2(altDiff, groundDistance) * RAD_TO_DEG;
  return Math.max(0, Math.min(90, elevation));
}

/**
 * Calculate all tracking angles from GCS to drone
 */
export function calculateTrackingAngles(gcs: GeoPosition, drone: GeoPosition): TrackingAngles {
  const distance = haversineDistance(gcs, drone);
  const azimuth = calculateBearing(gcs, drone);
  const elevation = calculateElevation(gcs, drone, distance);

  return { azimuth, elevation, distance };
}
