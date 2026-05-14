/**
 * Haversine geofence helpers (pure math, no I/O).
 *
 * Duplicated implementations elsewhere (keep until migrated):
 * - Backend: `Backend/FieldSync-Backend/utils/distance.js` (`getDistanceInMeters`),
 *   `Backend/FieldSync-Backend/utils/geocoding.js` (`calculateDistance`, `isWithinGeofence`),
 *   `routes/shifts.js` uses distance vs `locations.radius`.
 * - Frontend: `Frontend/fieldsync-frontend/src/pages/WorkSession.js`
 *   (`getDistanceMeters` rounded; `metersBetween` unrounded — same formula).
 * - Mobile: `Mobile/fieldsync-mobile/utils/geofence.js`
 *   (`getDistance` → Infinity if null; `isInsideGeofence` + 10 m buffer; mixed lat/lng vs latitude/longitude).
 */

/** Mean Earth radius (meters); matches `utils/distance.js` and web `WorkSession` (6371000 ≡ 6371e3). */
export const EARTH_RADIUS_METERS = 6371000;

export type LatLon = {
  latitude: number;
  longitude: number;
};

export type LatLng = {
  lat: number;
  lng: number;
};

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Great-circle distance between two WGS84-style latitude/longitude points (degrees).
 * Returns a non-negative distance in meters (not rounded).
 */
export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/** Same as {@link haversineDistanceMeters}, rounded to the nearest meter (web clock-in UX). */
export function haversineDistanceMetersRounded(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return Math.round(haversineDistanceMeters(lat1, lon1, lat2, lon2));
}

function isFiniteCoordinate(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

/**
 * Mobile parity: missing or non-finite coordinates yield positive infinity so comparisons fail “inside”.
 */
export function haversineDistanceMetersOrInfinity(
  lat1: number | null | undefined,
  lon1: number | null | undefined,
  lat2: number | null | undefined,
  lon2: number | null | undefined
): number {
  if (
    !isFiniteCoordinate(lat1) ||
    !isFiniteCoordinate(lon1) ||
    !isFiniteCoordinate(lat2) ||
    !isFiniteCoordinate(lon2)
  ) {
    return Number.POSITIVE_INFINITY;
  }

  return haversineDistanceMeters(lat1, lon1, lat2, lon2);
}

export function haversineDistanceMetersBetweenPoints(a: LatLon, b: LatLon): number {
  return haversineDistanceMeters(
    a.latitude,
    a.longitude,
    b.latitude,
    b.longitude
  );
}

/**
 * Point vs center using `{ lat, lng }` for the center (mobile legacy shape).
 */
export function haversineDistanceMetersPointToLatLng(
  point: LatLon,
  center: LatLng
): number {
  return haversineDistanceMeters(
    point.latitude,
    point.longitude,
    center.lat,
    center.lng
  );
}

/**
 * True if distance ≤ radius + buffer (buffer defaults to 0). Use buffer for GPS jitter (e.g. mobile 10 m).
 */
export function isDistanceWithinRadiusMeters(options: {
  distanceMeters: number;
  radiusMeters: number;
  bufferMeters?: number;
}): boolean {
  const buffer = options.bufferMeters ?? 0;
  return options.distanceMeters <= options.radiusMeters + buffer;
}

export function isWithinGeofenceLatLon(options: {
  point: LatLon;
  center: LatLon;
  radiusMeters: number;
  bufferMeters?: number;
}): boolean {
  const distanceMeters = haversineDistanceMetersBetweenPoints(
    options.point,
    options.center
  );

  return isDistanceWithinRadiusMeters({
    distanceMeters,
    radiusMeters: options.radiusMeters,
    bufferMeters: options.bufferMeters,
  });
}

/** Mobile `isInsideGeofence`-style: point uses latitude/longitude; center uses lat/lng. */
export function isWithinGeofencePointVsLatLng(options: {
  point: LatLon;
  center: LatLng;
  radiusMeters: number;
  bufferMeters?: number;
}): boolean {
  const distanceMeters = haversineDistanceMetersPointToLatLng(
    options.point,
    options.center
  );

  return isDistanceWithinRadiusMeters({
    distanceMeters,
    radiusMeters: options.radiusMeters,
    bufferMeters: options.bufferMeters,
  });
}
