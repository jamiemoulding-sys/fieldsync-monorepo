/**
 * Final Minimal Attendance Routes
 * 
 * Addresses ALL identified production risks while maintaining simplicity
 */

const express = require('express');
const router = express.Router();
const AttendanceMinimalFinal = require('../services/attendanceMinimalFinal');
const { authenticateToken } = require('../middleware/auth');

const attendance = new AttendanceMinimalFinal();

// Enhanced replay protection with atomic operations - Fix for Risk #18
const REPLAY_WINDOW = 5 * 60 * 1000; // 5 minutes

const preventReplay = (req, res, next) => {
  const key = `${req.user.id}-${req.method}-${req.path}-${JSON.stringify(req.body)}`;
  const now = Date.now();
  
  // Use lock to prevent race condition
  if (!replayLocks.has(key)) {
    replayLocks.set(key, true);
    
    try {
      if (replayCache.has(key) && (now - replayCache.get(key) < REPLAY_WINDOW)) {
        return res.status(429).json({ 
          error: 'Duplicate request', 
          idempotent: true,
          key: key.substring(0, 20) + '...' // Partial key for debugging
        });
      }
      
      replayCache.set(key, now);
      next();
    } finally {
      replayLocks.delete(key);
    }
  } else {
    // Another request is processing this key
    setTimeout(() => preventReplay(req, res, next), 10);
  }
};

// Enhanced logging with security monitoring
const logRequest = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const logData = {
      user: req.user.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - start,
      deviceFingerprint: req.headers['x-device-fingerprint'] || 'none',
      sessionId: req.headers['x-session-id'] || 'none',
      ip: req.ip,
      userAgent: req.headers['user-agent'] || 'none',
      timestamp: new Date().toISOString()
    };
    
    if (res.statusCode >= 400) {
      logData.error = true;
      logData.requestBody = req.body; // Include body for error debugging
      console.error('ATTENDANCE_ERROR', logData);
    } else {
      console.log('ATTENDANCE', logData);
    }
  });
  
  next();
};

// Rate limiting middleware - Fix for Risk #23
const requestCounts = new Map();

const rateLimit = (maxRequests = 100, windowMs = 60000) => {
  return (req, res, next) => {
    const key = req.user.id;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    if (!requestCounts.has(key)) {
      requestCounts.set(key, []);
    }
    
    const requests = requestCounts.get(key);
    
    // Remove old requests outside window
    const validRequests = requests.filter(timestamp => timestamp > windowStart);
    requestCounts.set(key, validRequests);
    
    if (validRequests.length >= maxRequests) {
      return res.status(429).json({ 
        error: 'Too many requests',
        limit: maxRequests,
        window: windowMs / 1000
      });
    }
    
    validRequests.push(now);
    next();
  };
};

//
// =======================
// 🕐 CLOCK IN
// =======================
router.post('/clock-in', authenticateToken, rateLimit(50, 60000), preventReplay, logRequest, async (req, res) => {
  try {
    const { location_id, latitude, longitude } = req.body;
    
    // Add request metadata for device fingerprinting
    const enhancedData = {
      ...req.body,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    };
    
    const result = await attendance.clockIn(
      req.user.id, 
      req.user.companyId, 
      location_id,
      enhancedData
    );

    if (result.success) {
      res.json(result);
    } else {
      const statusCode = result.error === 'Validation failed' ? 400 : 500;
      res.status(statusCode).json(result);
    }

  } catch (error) {
    console.error('CLOCK_IN_ERROR:', error);
    res.status(500).json({ 
      error: 'Clock in failed',
      requestId: req.id || 'unknown'
    });
  }
});

//
// =======================
// 🕐 CLOCK OUT
// =======================
router.post('/clock-out', authenticateToken, rateLimit(50, 60000), preventReplay, logRequest, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    
    const enhancedData = {
      ...req.body,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    };
    
    const result = await attendance.clockOut(
      req.user.id, 
      req.user.companyId,
      enhancedData
    );

    if (result.success) {
      res.json(result);
    } else {
      const statusCode = result.error === 'Validation failed' ? 400 : 500;
      res.status(statusCode).json(result);
    }

  } catch (error) {
    console.error('CLOCK_OUT_ERROR:', error);
    res.status(500).json({ 
      error: 'Clock out failed',
      requestId: req.id || 'unknown'
    });
  }
});

//
// =======================
// ⏸️ START BREAK
// =======================
router.post('/break/start', authenticateToken, rateLimit(20, 60000), preventReplay, logRequest, async (req, res) => {
  try {
    const { shift_id } = req.body;
    
    const enhancedData = {
      ...req.body,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    };
    
    const result = await attendance.startBreak(
      req.user.id, 
      req.user.companyId, 
      shift_id,
      enhancedData
    );

    if (result.success) {
      res.json(result);
    } else {
      const statusCode = result.error === 'Validation failed' ? 400 : 500;
      res.status(statusCode).json(result);
    }

  } catch (error) {
    console.error('BREAK_START_ERROR:', error);
    res.status(500).json({ 
      error: 'Break start failed',
      requestId: req.id || 'unknown'
    });
  }
});

//
// =======================
// ⏸️ END BREAK
// =======================
router.post('/break/end', authenticateToken, rateLimit(20, 60000), preventReplay, logRequest, async (req, res) => {
  try {
    const { shift_id } = req.body;
    
    const enhancedData = {
      ...req.body,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    };
    
    const result = await attendance.endBreak(
      req.user.id, 
      req.user.companyId, 
      shift_id,
      enhancedData
    );

    if (result.success) {
      res.json(result);
    } else {
      const statusCode = result.error === 'Validation failed' ? 400 : 500;
      res.status(statusCode).json(result);
    }

  } catch (error) {
    console.error('BREAK_END_ERROR:', error);
    res.status(500).json({ 
      error: 'Break end failed',
      requestId: req.id || 'unknown'
    });
  }
});

//
// =======================
// 👤 ACTIVE SHIFT
// =======================
router.get('/active', authenticateToken, rateLimit(100, 60000), async (req, res) => {
  try {
    const activeShift = await attendance.getActiveShift(req.user.id, req.user.companyId);
    res.json(activeShift);
  } catch (error) {
    console.error('ACTIVE_ERROR:', error);
    res.status(500).json({ error: 'Failed to get active shift' });
  }
});

//
// =======================
// 📜 HISTORY
// =======================
router.get('/history', authenticateToken, rateLimit(30, 60000), async (req, res) => {
  try {
    const { query } = require('../database/connection');
    const limit = Math.min(parseInt(req.query.limit) || 20, 100); // Max 100 records
    
    const result = await query(`
      SELECT * FROM shifts
      WHERE user_id = $1
      AND company_id = $2
      ORDER BY clock_in_time DESC
      LIMIT $3
    `, [req.user.id, req.user.companyId, limit]);

    res.json(result.rows);
  } catch (error) {
    console.error('HISTORY_ERROR:', error);
    res.status(500).json({ error: 'Failed to get shift history' });
  }
});

//
// =======================
// 🔍 PAYROLL VALIDATION
// =======================
router.get('/validate/:shiftId', authenticateToken, rateLimit(10, 60000), async (req, res) => {
  try {
    const { query } = require('../database/connection');
    const { shiftId } = req.params;
    
    // Validate shift ID format
    if (!shiftId.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
      return res.status(400).json({ error: 'Invalid shift ID format' });
    }
    
    // Get shift data
    const shiftResult = await query(`
      SELECT * FROM shifts 
      WHERE id = $1 AND user_id = $2 AND company_id = $3
    `, [shiftId, req.user.id, req.user.companyId]);
    
    if (shiftResult.rows.length === 0) {
      return res.status(404).json({ error: 'Shift not found' });
    }
    
    const shift = shiftResult.rows[0];
    const validation = {
      valid: true,
      errors: [],
      warnings: [],
      shift: shift
    };
    
    // Check for common issues
    if (shift.total_hours > 12) {
      validation.warnings.push('Shift duration exceeds 12 hours');
    }
    
    if (shift.total_break_seconds > 4 * 3600) {
      validation.warnings.push('Break duration exceeds 4 hours');
    }
    
    if (shift.metadata && shift.metadata.time_corrected) {
      validation.warnings.push('Client time was corrected by server');
    }
    
    res.json(validation);
  } catch (error) {
    console.error('VALIDATION_ERROR:', error);
    res.status(500).json({ error: 'Failed to validate shift' });
  }
});

//
// =======================
// 📊 ANALYTICS
// =======================
router.get('/analytics', authenticateToken, rateLimit(5, 60000), async (req, res) => {
  try {
    const { query } = require('../database/connection');
    const companyId = req.user.companyId;
    const days = Math.min(parseInt(req.query.days) || 7, 30); // Max 30 days
    
    const result = await query(`
      SELECT
        DATE(clock_in_time) as date,
        COUNT(*) as shifts,
        SUM(total_hours) as total_hours,
        AVG(total_hours) as avg_hours,
        SUM(total_break_seconds) as total_break_seconds,
        AVG(total_break_seconds) as avg_break_seconds
      FROM shifts
      WHERE company_id = $1
      AND clock_in_time >= NOW() - INTERVAL '${days} days'
      GROUP BY DATE(clock_in_time)
      ORDER BY DATE(clock_in_time) DESC
    `, [companyId]);

    res.json({
      period: `${days} days`,
      data: result.rows
    });
  } catch (error) {
    console.error('ANALYTICS_ERROR:', error);
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

//
// =======================
// 🏥 HEALTH CHECK (Enhanced)
// =======================
router.get('/health', async (req, res) => {
  try {
    const health = await attendance.healthCheck();
    
    if (health.status === 'healthy') {
      res.json(health);
    } else if (health.status === 'degraded') {
      res.status(200).json(health); // 200 for degraded, not 503
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
// 📈 SYSTEM STATS (Admin Only)
// =======================
router.get('/stats', authenticateToken, rateLimit(2, 60000), async (req, res) => {
  try {
    // Only allow admin users
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const stats = await attendance.getSystemStats();
    res.json(stats);
  } catch (error) {
    console.error('STATS_ERROR:', error);
    res.status(500).json({ error: 'Failed to get system stats' });
  }
});

//
// =======================
// 🧹 SYSTEM CLEANUP (Admin Only)
// =======================
router.post('/cleanup', authenticateToken, rateLimit(1, 300000), async (req, res) => {
  try {
    // Only allow admin users
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { query } = require('../database/connection');
    
    // Cleanup expired sessions
    const sessionResult = await query('SELECT cleanup_expired_sessions()');
    
    // Cleanup old replay cache entries (older than 1 hour)
    const now = Date.now();
    let cleanedEntries = 0;
    for (const [k, v] of replayCache.entries()) {
      if (now - v > 60 * 60 * 1000) { // 1 hour
        replayCache.delete(k);
        cleanedEntries++;
      }
    }
    
    res.json({
      success: true,
      expiredSessionsCleaned: sessionResult.rows[0].cleanup_expired_sessions,
      replayCacheEntriesCleaned: cleanedEntries,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('CLEANUP_ERROR:', error);
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

module.exports = router;
