// Geocoding utility functions
// For demo purposes, we'll use a simple mock geocoding service
// In production, you'd use Google Maps API, OpenStreetMap, or similar

const locationCoordinates = {
  '123 Business St, City, State 12345': { lat: 40.7128, lng: -74.0060 },
  '456 Storage Ave, City, State 12345': { lat: 40.7580, lng: -73.9855 },
  '789 Shop Blvd, City, State 12345': { lat: 40.7489, lng: -73.9680 }
};

// Mock geocoding function - converts address to coordinates
function geocodeAddress(address) {
  return new Promise((resolve, reject) => {
    // Simulate API delay
    setTimeout(() => {
      const coords = locationCoordinates[address];
      if (coords) {
        resolve(coords);
      } else {
        // For demo purposes, return NYC coordinates for any unknown address
        resolve({ lat: 40.7128, lng: -74.0060 });
      }
    }, 100);
  });
}

// Calculate distance between two GPS coordinates using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

// Check if user is within geofence
function isWithinGeofence(userLat, userLng, locationLat, locationLng, radius) {
  const distance = calculateDistance(userLat, userLng, locationLat, locationLng);
  return distance <= radius;
}

module.exports = {
  geocodeAddress,
  calculateDistance,
  isWithinGeofence
};
