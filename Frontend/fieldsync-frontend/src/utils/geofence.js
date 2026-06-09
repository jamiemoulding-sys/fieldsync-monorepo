const EARTH_RADIUS_METERS = 6371000;

function toRad(degrees) {
  return (degrees * Math.PI) / 180;
}

export function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
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

export function haversineDistanceMetersRounded(lat1, lon1, lat2, lon2) {
  return Math.round(haversineDistanceMeters(lat1, lon1, lat2, lon2));
}
