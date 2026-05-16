/**
 * Weather Integration Routes
 * 
 * Provides weather-related endpoints with proper validation,
 * caching, and monitoring.
 */

const express = require('express');
const router = express.Router();
const WeatherService = require('../services/weatherService');
const { authenticateToken } = require('../middleware/auth');

const weatherService = new WeatherService();

// Set database query function for weather service
const { query } = require('../database/connection');
weatherService.setDatabaseQuery(query);

//
// =======================
// 🌤️ GET WEATHER
// =======================
router.get('/current', authenticateToken, async (req, res) => {
  try {
    const { lat, lng } = req.query;
    
    // Validate coordinates
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }
    
    const latitude = parseFloat(lat);
    const longitude = parseFloat(lng);
    
    if (!weatherService.isValidCoordinates(latitude, longitude)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }
    
    const weather = await weatherService.getWeather(latitude, longitude);
    
    if (weather) {
      res.json(weather);
    } else {
      res.status(404).json({ error: 'Weather data not available' });
    }
    
  } catch (error) {
    console.error('GET_WEATHER_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 📊 WEATHER STATISTICS
// =======================
router.get('/statistics', authenticateToken, async (req, res) => {
  try {
    // Only managers and admins can view statistics
    if (req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const stats = weatherService.getWeatherStats();
    
    if (stats) {
      res.json(stats);
    } else {
      res.json({ message: 'No weather data available' });
    }
    
  } catch (error) {
    console.error('WEATHER_STATS_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 🚨 WEATHER ALERTS
// =======================
router.get('/alerts', authenticateToken, async (req, res) => {
  try {
    // Only managers and admins can view alerts
    if (req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const { hours = 24 } = req.query;
    
    const alerts = await query(`
      SELECT * FROM get_weather_alerts($1, $2)
    `, [req.user.companyId, parseInt(hours)]);
    
    res.json(alerts.rows[0] || { alerts: [], alert_count: 0 });
    
  } catch (error) {
    console.error('WEATHER_ALERTS_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 📈 WEATHER STATISTICS (Admin)
// =======================
router.get('/admin/statistics', authenticateToken, async (req, res) => {
  try {
    // Only admins can view detailed statistics
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const { start_date, end_date } = req.query;
    
    let queryText = `
      SELECT 
        DATE_TRUNC('day', weather_fetched_at) as date,
        COUNT(*) as shift_count,
        AVG((weather_data->>'temperature')::NUMERIC) as avg_temperature,
        MIN((weather_data->>'temperature')::NUMERIC) as min_temperature,
        MAX((weather_data->>'temperature')::NUMERIC) as max_temperature,
        AVG((weather_data->>'humidity')::NUMERIC) as avg_humidity,
        MIN((weather_data->>'humidity')::NUMERIC) as min_humidity,
        MAX((weather_data->>'humidity')::NUMERIC) as max_humidity,
        MODE() WITHIN GROUP (ORDER BY weather_data->>'condition') as most_common_condition
      FROM shifts
      WHERE company_id = $1
        AND weather_data IS NOT NULL
        AND weather_fetched_at IS NOT NULL
    `;
    
    const queryParams = [req.user.companyId];
    
    if (start_date && end_date) {
      queryText += ` AND weather_fetched_at >= $2 AND weather_fetched_at <= $3`;
      queryParams.push(new Date(start_date), new Date(end_date));
    }
    
    queryText += ` GROUP BY DATE_TRUNC('day', weather_fetched_at) ORDER BY date DESC`;
    
    const result = await query(queryText, queryParams);
    
    res.json(result.rows);
    
  } catch (error) {
    console.error('WEATHER_ADMIN_STATS_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 🗑️ CLEAR CACHE (Admin)
// =======================
router.post('/clear-cache', authenticateToken, async (req, res) => {
  try {
    // Only admins can clear cache
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    weatherService.clearCache();
    
    res.json({ 
      success: true, 
      message: 'Weather cache cleared',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('CLEAR_WEATHER_CACHE_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 🔄 RESET RATE LIMIT (Admin)
// =======================
router.post('/reset-rate-limit', authenticateToken, async (req, res) => {
  try {
    // Only admins can reset rate limit
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    weatherService.resetRateLimit();
    
    res.json({ 
      success: true, 
      message: 'Weather API rate limit reset',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('RESET_RATE_LIMIT_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 🏥 HEALTH CHECK
// =======================
router.get('/health', async (req, res) => {
  try {
    const health = await weatherService.healthCheck();
    
    if (health.status === 'healthy') {
      res.json(health);
    } else {
      res.status(503).json(health);
    }
    
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

//
// =======================
// 📊 SERVICE STATUS (Admin)
// =======================
router.get('/status', authenticateToken, async (req, res) => {
  try {
    // Only admins can view service status
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const status = weatherService.getStatus();
    
    res.json(status);
    
  } catch (error) {
    console.error('WEATHER_STATUS_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 🗑️ CLEANUP CACHE (Admin)
// =======================
router.post('/cleanup-cache', authenticateToken, async (req, res) => {
  try {
    // Only admins can cleanup cache
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const result = await query('SELECT cleanup_weather_cache() as deleted_count');
    
    res.json({ 
      success: true, 
      deleted_count: result.rows[0].deleted_count,
      message: 'Weather cache cleanup completed',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('CLEANUP_WEATHER_CACHE_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 🌤️ FETCH WEATHER FOR SHIFT (Internal)
// =======================
router.post('/fetch-for-shift', authenticateToken, async (req, res) => {
  try {
    const { shift_id, latitude, longitude } = req.body;
    
    if (!shift_id || !latitude || !longitude) {
      return res.status(400).json({ error: 'Shift ID, latitude, and longitude are required' });
    }
    
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);
    
    if (!weatherService.isValidCoordinates(lat, lng)) {
      return res.status(400).json({ error: 'Invalid coordinates' });
    }
    
    // Fetch weather asynchronously
    weatherService.fetchWeatherAsync(shift_id, lat, lng, (error, weather) => {
      if (error) {
        console.error('Async weather fetch failed:', error);
      } else {
        console.log('Weather fetched for shift:', shift_id);
      }
    });
    
    res.json({ 
      success: true, 
      message: 'Weather fetch initiated',
      shift_id,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('FETCH_WEATHER_FOR_SHIFT_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
