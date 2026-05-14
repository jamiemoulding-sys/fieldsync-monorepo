/**
 * Production-Safe Weather Service
 * 
 * Provides non-blocking weather fetching with proper validation,
 * caching, rate limiting, and graceful degradation.
 */

const axios = require('axios');

class WeatherService {
  constructor() {
    // Configuration
    this.apiKey = process.env.WEATHER_API_KEY;
    this.baseUrl = process.env.WEATHER_API_URL || 'https://api.openweathermap.org/data/2.5';
    this.timeout = parseInt(process.env.WEATHER_API_TIMEOUT) || 5000;
    
    // Caching
    this.cache = new Map();
    this.CACHE_TTL = 10 * 60 * 1000; // 10 minutes
    this.MAX_CACHE_SIZE = 1000;
    
    // Rate limiting
    this.RATE_LIMIT = 100; // 100 requests per hour
    this.requestCount = 0;
    this.lastReset = Date.now();
    
    // Background processing
    this.queue = [];
    this.processing = false;
    
    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Get current weather for coordinates (non-blocking)
   */
  async getWeather(lat, lng) {
    try {
      // Validate coordinates
      if (!this.isValidCoordinates(lat, lng)) {
        throw new Error('Invalid coordinates');
      }
      
      // Check rate limit
      this.checkRateLimit();
      
      // Check cache
      const cached = this.getFromCache(lat, lng);
      if (cached) {
        return cached;
      }
      
      // Fetch from API
      const weather = await this.fetchFromAPI(lat, lng);
      
      if (weather && this.isValidWeatherData(weather)) {
        this.setCache(lat, lng, weather);
        return weather;
      }
      
      return null;
    } catch (error) {
      console.warn('Weather fetch failed:', error.message);
      return null;
    }
  }

  /**
   * Fetch weather asynchronously (non-blocking)
   */
  async fetchWeatherAsync(shiftId, lat, lng, callback) {
    // Add to queue for background processing
    this.queue.push({
      shiftId,
      lat,
      lng,
      callback,
      timestamp: Date.now()
    });
    
    // Start processing if not already running
    if (!this.processing) {
      this.processQueue();
    }
  }

  /**
   * Process weather queue
   */
  async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }
    
    this.processing = true;
    
    while (this.queue.length > 0) {
      const job = this.queue.shift();
      
      try {
        const weather = await this.getWeather(job.lat, job.lng);
        
        if (weather) {
          await this.updateShiftWeather(job.shiftId, weather);
        }
        
        if (job.callback) {
          job.callback(null, weather);
        }
      } catch (error) {
        console.warn('Weather queue job failed:', error);
        
        if (job.callback) {
          job.callback(error, null);
        }
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.processing = false;
  }

  /**
   * Fetch weather from API
   */
  async fetchFromAPI(lat, lng) {
    const url = `${this.baseUrl}/weather`;
    const params = {
      lat: lat.toFixed(6),
      lon: lng.toFixed(6),
      appid: this.apiKey,
      units: 'metric' // Celsius
    };
    
    try {
      const response = await axios.get(url, {
        params,
        timeout: this.timeout,
        headers: {
          'User-Agent': 'FieldSync-Weather/1.0'
        }
      });
      
      return this.transformWeatherData(response.data);
    } catch (error) {
      if (error.response) {
        throw new Error(`Weather API error: ${error.response.status} ${error.response.statusText}`);
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Weather API timeout');
      } else {
        throw new Error(`Weather API network error: ${error.message}`);
      }
    }
  }

  /**
   * Transform API response to internal format
   */
  transformWeatherData(apiData) {
    if (!apiData || !apiData.main) {
      return null;
    }
    
    return {
      temperature: Math.round(apiData.main.temp * 10) / 10, // 1 decimal place
      humidity: Math.round(apiData.main.humidity),
      pressure: Math.round(apiData.main.pressure),
      condition: apiData.weather[0]?.description || 'unknown',
      wind_speed: apiData.wind?.speed ? Math.round(apiData.wind.speed * 10) / 10 : null,
      wind_direction: apiData.wind?.deg || null,
      visibility: apiData.visibility ? Math.round(apiData.visibility / 1000) : null, // km
      cloud_cover: apiData.clouds?.all || null,
      sunrise: apiData.sys?.sunrise ? new Date(apiData.sys.sunrise * 1000) : null,
      sunset: apiData.sys?.sunset ? new Date(apiData.sys.sunset * 1000) : null,
      source: 'openweathermap',
      fetched_at: new Date().toISOString()
    };
  }

  /**
   * Update shift weather in database
   */
  async updateShiftWeather(shiftId, weather) {
    if (!this.isValidWeatherData(weather)) {
      throw new Error('Invalid weather data');
    }
    
    const query = `
      UPDATE shifts 
      SET weather_data = $1, weather_fetched_at = NOW()
      WHERE id = $2
    `;
    
    const values = [JSON.stringify(weather), shiftId];
    
    try {
      const result = await this.dbQuery(query, values);
      return result;
    } catch (error) {
      console.error('Failed to update shift weather:', error);
      throw error;
    }
  }

  /**
   * Validate coordinates
   */
  isValidCoordinates(lat, lng) {
    return (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      lat >= -90 && lat <= 90 &&
      lng >= -180 && lng <= 180 &&
      !isNaN(lat) && !isNaN(lng)
    );
  }

  /**
   * Validate weather data
   */
  isValidWeatherData(weather) {
    return (
      weather &&
      typeof weather.temperature === 'number' &&
      weather.temperature >= -100 && weather.temperature <= 150 &&
      typeof weather.humidity === 'number' &&
      weather.humidity >= 0 && weather.humidity <= 100 &&
      typeof weather.condition === 'string' &&
      weather.condition.length > 0 &&
      weather.condition.length <= 50
    );
  }

  /**
   * Check rate limit
   */
  checkRateLimit() {
    const now = Date.now();
    
    // Reset counter every hour
    if (now - this.lastReset > 60 * 60 * 1000) {
      this.requestCount = 0;
      this.lastReset = now;
    }
    
    if (this.requestCount >= this.RATE_LIMIT) {
      throw new Error('Weather API rate limit exceeded');
    }
    
    this.requestCount++;
  }

  /**
   * Get weather from cache
   */
  getFromCache(lat, lng) {
    const key = this.getCacheKey(lat, lng);
    const cached = this.cache.get(key);
    
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.data;
    }
    
    return null;
  }

  /**
   * Set weather in cache
   */
  setCache(lat, lng, weather) {
    const key = this.getCacheKey(lat, lng);
    
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    this.cache.set(key, {
      data: weather,
      timestamp: Date.now()
    });
  }

  /**
   * Generate cache key
   */
  getCacheKey(lat, lng) {
    // Round coordinates to 3 decimal places (~100m precision)
    return `${lat.toFixed(3)},${lng.toFixed(3)}`;
  }

  /**
   * Start cleanup interval
   */
  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      
      // Clean expired cache entries
      for (const [key, value] of this.cache.entries()) {
        if (now - value.timestamp > this.CACHE_TTL) {
          this.cache.delete(key);
        }
      }
      
      // Clean old queue entries
      const queueAge = Date.now() - (5 * 60 * 1000); // 5 minutes
      this.queue = this.queue.filter(job => job.timestamp > queueAge);
    }, 60000); // Clean every minute
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      cacheSize: this.cache.size,
      queueLength: this.queue.length,
      processing: this.processing,
      requestCount: this.requestCount,
      rateLimitRemaining: Math.max(0, this.RATE_LIMIT - this.requestCount),
      lastReset: new Date(this.lastReset).toISOString(),
      apiKeyConfigured: !!this.apiKey
    };
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      // Test API with a simple request
      const testWeather = await this.getWeather(40.7128, -74.0060); // New York
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        apiAccessible: testWeather !== null,
        cacheSize: this.cache.size,
        queueLength: this.queue.length
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Reset rate limit counter
   */
  resetRateLimit() {
    this.requestCount = 0;
    this.lastReset = Date.now();
  }

  /**
   * Set database query function
   */
  setDatabaseQuery(dbQuery) {
    this.dbQuery = dbQuery;
  }

  /**
   * Get weather statistics
   */
  getWeatherStats() {
    const weatherData = Array.from(this.cache.values()).map(entry => entry.data);
    
    if (weatherData.length === 0) {
      return null;
    }
    
    const temperatures = weatherData.map(w => w.temperature);
    const humidity = weatherData.map(w => w.humidity);
    
    return {
      totalRequests: this.requestCount,
      cachedLocations: this.cache.size,
      averageTemperature: temperatures.reduce((a, b) => a + b, 0) / temperatures.length,
      averageHumidity: humidity.reduce((a, b) => a + b, 0) / humidity.length,
      temperatureRange: {
        min: Math.min(...temperatures),
        max: Math.max(...temperatures)
      },
      humidityRange: {
        min: Math.min(...humidity),
        max: Math.max(...humidity)
      }
    };
  }
}

module.exports = WeatherService;
