/**
 * Minimal Attendance Routes
 * 
 * Smallest production-safe API with database-first integrity
 */

const express = require('express');
const router = express.Router();
const AttendanceMinimal = require('../services/attendanceMinimal');
const { authenticateToken } = require('../middleware/auth');

const attendance = new AttendanceMinimal();

// Simple replay protection
const replayCache = new Map();
const REPLAY_WINDOW = 5 * 60 * 1000; // 5 minutes

const preventReplay = (req, res, next) => {
  const key = `${req.user.id}-${req.method}-${req.path}-${JSON.stringify(req.body)}`;
  const now = Date.now();
  
  if (replayCache.has(key) && (now - replayCache.get(key) < REPLAY_WINDOW)) {
    return res.status(429).json({ error: 'Duplicate request', idempotent: true });
  }
  
  replayCache.set(key, now);
  
  // Cleanup old entries
  for (const [k, v] of replayCache.entries()) {
    if (now - v > REPLAY_WINDOW * 2) {
      replayCache.delete(k);
    }
  }
  
  next();
};

// Simple logging
const logRequest = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log('ATTENDANCE', {
      user: req.user.id,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: Date.now() - start
    });
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
    
    if (!location_id || !latitude || !longitude) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await attendance.clockIn(
      req.user.id, 
      req.user.companyId, 
      location_id,
      {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        deviceFingerprint: req.headers['x-device-fingerprint'] || req.ip,
        sessionId: req.headers['x-session-id'] || 'anonymous'
      }
    );

    res.json(result);

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
    
    if (!latitude || !longitude) {
      return res.status(400).json({ error: 'Missing GPS coordinates' });
    }

    const result = await attendance.clockOut(
      req.user.id, 
      req.user.companyId,
      {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        deviceFingerprint: req.headers['x-device-fingerprint'] || req.ip,
        sessionId: req.headers['x-session-id'] || 'anonymous'
      }
    );

    res.json(result);

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
    
    if (!shift_id) {
      return res.status(400).json({ error: 'Shift ID required' });
    }

    const result = await attendance.startBreak(
      req.user.id, 
      req.user.companyId, 
      shift_id,
      {
        deviceFingerprint: req.headers['x-device-fingerprint'] || req.ip,
        sessionId: req.headers['x-session-id'] || 'anonymous'
      }
    );

    res.json(result);

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
    
    if (!shift_id) {
      return res.status(400).json({ error: 'Shift ID required' });
    }

    const result = await attendance.endBreak(
      req.user.id, 
      req.user.companyId, 
      shift_id,
      {
        deviceFingerprint: req.headers['x-device-fingerprint'] || req.ip,
        sessionId: req.headers['x-session-id'] || 'anonymous'
      }
    );

    res.json(result);

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
// 🏥 HEALTH
// =======================
router.get('/health', async (req, res) => {
  try {
    const { query } = require('../database/connection');
    await query('SELECT 1');
    
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: 'minimal-1.0.0'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      error: 'Database connection failed'
    });
  }
});

module.exports = router;
