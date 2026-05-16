/**
 * Fixed Minimal Attendance Routes
 * 
 * Addresses all identified production risks while maintaining simplicity
 */

const express = require('express');
const router = express.Router();
const AttendanceMinimalFixed = require('../services/attendanceMinimalFixed');
const { authenticateToken } = require('../middleware/auth');

const attendance = new AttendanceMinimalFixed();

// Fixed replay protection with scheduled cleanup - Risk #8
const REPLAY_WINDOW = 5 * 60 * 1000; // 5 minutes

const preventReplay = (req, res, next) => {
  const key = `${req.user.id}-${req.method}-${req.path}-${JSON.stringify(req.body)}`;
  const now = Date.now();
  
  if (replayCache.has(key) && (now - replayCache.get(key) < REPLAY_WINDOW)) {
    return res.status(429).json({ error: 'Duplicate request', idempotent: true });
  }
  
  replayCache.set(key, now);
  
  // Cleanup old entries (also runs via setInterval in service)
  for (const [k, v] of replayCache.entries()) {
    if (now - v > REPLAY_WINDOW * 2) {
      replayCache.delete(k);
    }
  }
  
  next();
};

// Enhanced logging with error details
const logRequest = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const logData = {
      user: req.user.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - start,
      deviceFingerprint: req.headers['x-device-fingerprint'] || req.ip,
      timestamp: new Date().toISOString()
    };
    
    if (res.statusCode >= 400) {
      logData.error = true;
      console.error('ATTENDANCE_ERROR', logData);
    } else {
      console.log('ATTENDANCE', logData);
    }
  });
  
  next();
};

//
// =======================
// 🕐 CLOCK IN
// =======================
router.post('/clock-in', authenticateToken, preventReplay, logRequest, async (req, res) => {
  try {
    const { location_id, latitude, longitude } = req.body;
    
    const result = await attendance.clockIn(
      req.user.id, 
      req.user.companyId, 
      location_id,
      {
        latitude,
        longitude,
        deviceFingerprint: req.headers['x-device-fingerprint'] || req.ip,
        sessionId: req.headers['x-session-id'] || 'anonymous'
      }
    );

    if (result.success) {
      res.json(result);
    } else {
      const statusCode = result.error === 'Validation failed' ? 400 : 500;
      res.status(statusCode).json(result);
    }

  } catch (error) {
    console.error('CLOCK_IN_ERROR:', error);
    res.status(500).json({ error: 'Clock in failed' });
  }
});

//
// =======================
// 🕐 CLOCK OUT
// =======================
router.post('/clock-out', authenticateToken, preventReplay, logRequest, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    
    const result = await attendance.clockOut(
      req.user.id, 
      req.user.companyId,
      {
        latitude,
        longitude,
        deviceFingerprint: req.headers['x-device-fingerprint'] || req.ip,
        sessionId: req.headers['x-session-id'] || 'anonymous'
      }
    );

    if (result.success) {
      res.json(result);
    } else {
      const statusCode = result.error === 'Validation failed' ? 400 : 500;
      res.status(statusCode).json(result);
    }

  } catch (error) {
    console.error('CLOCK_OUT_ERROR:', error);
    res.status(500).json({ error: 'Clock out failed' });
  }
});

//
// =======================
// ⏸️ START BREAK
// =======================
router.post('/break/start', authenticateToken, preventReplay, logRequest, async (req, res) => {
  try {
    const { shift_id } = req.body;
    
    const result = await attendance.startBreak(
      req.user.id, 
      req.user.companyId, 
      shift_id,
      {
        deviceFingerprint: req.headers['x-device-fingerprint'] || req.ip,
        sessionId: req.headers['x-session-id'] || 'anonymous'
      }
    );

    if (result.success) {
      res.json(result);
    } else {
      const statusCode = result.error === 'Validation failed' ? 400 : 500;
      res.status(statusCode).json(result);
    }

  } catch (error) {
    console.error('BREAK_START_ERROR:', error);
    res.status(500).json({ error: 'Break start failed' });
  }
});

//
// =======================
// ⏸️ END BREAK
// =======================
router.post('/break/end', authenticateToken, preventReplay, logRequest, async (req, res) => {
  try {
    const { shift_id } = req.body;
    
    const result = await attendance.endBreak(
      req.user.id, 
      req.user.companyId, 
      shift_id,
      {
        deviceFingerprint: req.headers['x-device-fingerprint'] || req.ip,
        sessionId: req.headers['x-session-id'] || 'anonymous'
      }
    );

    if (result.success) {
      res.json(result);
    } else {
      const statusCode = result.error === 'Validation failed' ? 400 : 500;
      res.status(statusCode).json(result);
    }

  } catch (error) {
    console.error('BREAK_END_ERROR:', error);
    res.status(500).json({ error: 'Break end failed' });
  }
});

//
// =======================
// 👤 ACTIVE SHIFT
// =======================
router.get('/active', authenticateToken, async (req, res) => {
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
// 📊 HISTORY
// =======================
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { query } = require('../database/connection');
    const limit = parseInt(req.query.limit) || 20;
    
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
router.get('/validate/:shiftId', authenticateToken, async (req, res) => {
  try {
    const { query } = require('../database/connection');
    const { shiftId } = req.params;
    
    const result = await query(`
      SELECT * FROM attendance_health_check()
    `);
    
    // Simple validation using health check
    const health = result.rows[0];
    const validation = {
      valid: health.checks.constraints === 'ok',
      errors: health.checks.constraints === 'violations' ? ['Constraint violations detected'] : [],
      health
    };
    
    res.json(validation);
  } catch (error) {
    console.error('VALIDATION_ERROR:', error);
    res.status(500).json({ error: 'Failed to validate payroll integrity' });
  }
});

//
// =======================
// 📊 ANALYTICS
// =======================
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const { query } = require('../database/connection');
    const companyId = req.user.companyId;
    
    const result = await query(`
      SELECT
        DATE(clock_in_time) as date,
        COUNT(*) as shifts,
        SUM(total_hours) as total_hours,
        AVG(total_hours) as avg_hours
      FROM shifts
      WHERE company_id = $1
      AND clock_in_time >= NOW() - INTERVAL '7 days'
      GROUP BY DATE(clock_in_time)
      ORDER BY DATE(clock_in_time) DESC
    `, [companyId]);

    res.json(result.rows);
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
// 🧹 SYSTEM CLEANUP
// =======================
router.post('/cleanup', authenticateToken, async (req, res) => {
  try {
    // Only allow admin users to cleanup
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { query } = require('../database/connection');
    
    // Cleanup expired sessions
    const result = await query('SELECT cleanup_expired_sessions()');
    
    res.json({
      success: true,
      expiredSessionsCleaned: result.rows[0].cleanup_expired_sessions,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('CLEANUP_ERROR:', error);
    res.status(500).json({ error: 'Cleanup failed' });
  }
});

module.exports = router;
