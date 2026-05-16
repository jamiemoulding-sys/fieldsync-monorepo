import { haversineDistanceMeters } from "@fieldsync/shared";

/**
 * Mobile legacy semantics: any null/undefined coordinate yields Infinity
 * (so comparisons behave like “outside”). Finite coords use shared Haversine.
 */
export function getDistance(lat1, lon1, lat2, lon2) {
  if (
    lat1 == null ||
    lon1 == null ||
    lat2 == null ||
    lon2 == null
  ) {
    return Infinity;
  }

  return haversineDistanceMeters(lat1, lon1, lat2, lon2);
}

export function isInsideGeofence(coords, location) {
  if (!coords || !location) return false;

  const distance = getDistance(
    coords.latitude,
    coords.longitude,
    location.lat,
    location.lng
  );

  // 🔥 small buffer to prevent edge flicker (GPS isn't perfect)
  const BUFFER = 10; // meters

  return distance <= location.radius + BUFFER;
}
