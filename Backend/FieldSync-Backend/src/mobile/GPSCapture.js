/**
 * GPS Capture Service
 * 
 * Simple GPS capture with no decision-making.
 * Just captures coordinates and returns data.
 */

class GPSCapture {
  constructor() {
    this.timeout = 10000;
    this.maximumAge = 30000;
    this.enableHighAccuracy = true;
  }

  /**
   * Capture GPS coordinates
   */
  async capture() {
    return new Promise((resolve, reject) => {
      // Check if GPS is available
      if (!navigator.geolocation) {
        reject(new Error('GPS not available'));
        return;
      }

      // Get current position
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            heading: position.coords.heading,
            speed: position.coords.speed,
            timestamp: position.timestamp || Date.now(),
            source: 'gps'
          });
        },
        (error) => {
          // GPS failure doesn't block operation
          console.warn('GPS capture failed:', error);
          resolve({
            latitude: null,
            longitude: null,
            accuracy: null,
            altitude: null,
            heading: null,
            speed: null,
            timestamp: Date.now(),
            error: error.message,
            source: 'gps'
          });
        },
        {
          enableHighAccuracy: this.enableHighAccuracy,
          timeout: this.timeout,
          maximumAge: this.maximumAge
        }
      );
    });
  }

  /**
   * Check if GPS is available
   */
  isAvailable() {
    return navigator.geolocation !== undefined;
  }

  /**
   * Get GPS status
   */
  async getStatus() {
    try {
      const position = await this.capture();
      return {
        available: true,
        hasCoordinates: position.latitude !== null && position.longitude !== null,
        accuracy: position.accuracy,
        lastUpdate: position.timestamp,
        error: position.error || null
      };
    } catch (error) {
      return {
        available: false,
        hasCoordinates: false,
        accuracy: null,
        lastUpdate: null,
        error: error.message
      };
    }
  }
}

// Create singleton instance
const gpsCapture = new GPSCapture();

export default gpsCapture;
