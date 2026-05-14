/**
 * Production-Safe Attendance Routes
 * 
 * Minimal, correct, and operationally reliable attendance endpoints.
 * Focuses on critical protections over architectural sophistication.
 */

const express = require('express');
const router = express.Router();
const ProductionSafeAttendance = require('../services/productionSafeAttendance');
const { authenticateToken } = require('../middleware/auth');

const attendance = new ProductionSafeAttendance();

//
// =======================
// 🕐 CLOCK IN
// =======================
router.post('/clock-in', authenticateToken, async (req, res) => {
  try {
    const { location_id, latitude, longitude, device_fingerprint, session_id, metadata } = req.body;
    
    const result = await attendance.clockIn(
      req.user.id, 
      req.user.companyId, 
      location_id,
      {
        latitude,
        longitude,
        deviceFingerprint: device_fingerprint || req.headers['x-device-fingerprint'],
        sessionId: session_id || req.headers['x-session-id'],
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        metadata
      }
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ error: 'Clock-in failed', details: result });
    }

  } catch (error) {
    console.error('CLOCK_IN_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 🕐 CLOCK OUT
// =======================
router.post('/clock-out', authenticateToken, async (req, res) => {
  try {
    const { shift_id, latitude, longitude, device_fingerprint, session_id, metadata } = req.body;
    
    const result = await attendance.clockOut(
      req.user.id, 
      req.user.companyId,
      shift_id,
      {
        latitude,
        longitude,
        deviceFingerprint: device_fingerprint || req.headers['x-device-fingerprint'],
        sessionId: session_id || req.headers['x-session-id'],
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        metadata
      }
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ error: 'Clock-out failed', details: result });
    }

  } catch (error) {
    console.error('CLOCK_OUT_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// ☕ START BREAK
// =======================
router.post('/break/start', authenticateToken, async (req, res) => {
  try {
    const { shift_id, device_fingerprint, session_id, metadata } = req.body;
    
    const result = await attendance.startBreak(
      req.user.id, 
      req.user.companyId,
      shift_id,
      {
        deviceFingerprint: device_fingerprint || req.headers['x-device-fingerprint'],
        sessionId: session_id || req.headers['x-session-id'],
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        metadata
      }
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ error: 'Break start failed', details: result });
    }

  } catch (error) {
    console.error('BREAK_START_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// ☕ END BREAK
// =======================
router.post('/break/end', authenticateToken, async (req, res) => {
  try {
    const { shift_id, device_fingerprint, session_id, metadata } = req.body;
    
    const result = await attendance.endBreak(
      req.user.id, 
      req.user.companyId,
      shift_id,
      {
        deviceFingerprint: device_fingerprint || req.headers['x-device-fingerprint'],
        sessionId: session_id || req.headers['x-session-id'],
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        metadata
      }
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json({ error: 'Break end failed', details: result });
    }

  } catch (error) {
    console.error('BREAK_END_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 👤 ACTIVE SHIFT
// =======================
router.get('/active-shift', authenticateToken, async (req, res) => {
  try {
    const activeShift = await attendance.getActiveShift(req.user.id, req.user.companyId);
    res.json(activeShift);
  } catch (error) {
    console.error('ACTIVE_SHIFT_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 📊 SHIFT HISTORY
// =======================
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const { limit = 50, offset = 0, start_date, end_date } = req.query;
    
    const query = `
      SELECT 
        id, location_id, clock_in_time, clock_out_time, 
        total_hours, total_break_seconds, latitude, longitude,
        created_at, updated_at
      FROM shifts
      WHERE user_id = $1 AND company_id = $2
    `;
    
    const params = [req.user.id, req.user.companyId];
    
    if (start_date) {
      query += ` AND clock_in_time >= $3`;
      params.push(new Date(start_date));
    }
    
    if (end_date) {
      query += ` AND clock_out_time <= $${params.length + 1}`;
      params.push(new Date(end_date));
    }
    
    query += ` ORDER BY clock_in_time DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await attendance.pool.query(query, params);
    
    res.json({
      shifts: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: result.rowCount || result.rows.length
      }
    });
  } catch (error) {
    console.error('SHIFT_HISTORY_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 🔍 SHIFT VALIDATION
// =======================
router.get('/validate/:shiftId', authenticateToken, async (req, res) => {
  try {
    const { shiftId } = req.params;
    
    const result = await attendance.pool.query(`
      SELECT validate_shift_integrity($1) as validation
    `, [shiftId]);
    
    res.json(result.rows[0].validation);
  } catch (error) {
    console.error('SHIFT_VALIDATION_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 🏥 HEALTH CHECK
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
// 📊 SYSTEM STATUS (Admin)
// =======================
router.get('/system-status', authenticateToken, async (req, res) => {
  try {
    // Only admins can view system status
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const health = await attendance.pool.query(`
      SELECT get_system_health($1) as health
    `, [req.user.companyId]);
    
    const status = attendance.getSystemStatus();
    
    res.json({
      health: health.rows[0].health,
      system: status,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('SYSTEM_STATUS_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 🔧 CLEANUP (Admin)
// =======================
router.post('/cleanup', authenticateToken, async (req, res) => {
  try {
    // Only admins can trigger cleanup
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const sessions = await attendance.pool.query('SELECT cleanup_expired_sessions() as deleted_sessions');
    const replay = await attendance.pool.query('SELECT cleanup_replay_protection() as deleted_replay');
    
    res.json({
      success: true,
      deleted_sessions: sessions.rows[0].deleted_sessions,
      deleted_replay: replay.rows[0].deleted_replay,
      message: 'Cleanup completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('CLEANUP_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 📊 AUDIT LOG (Admin)
// =======================
router.get('/audit-log', authenticateToken, async (req, res) => {
  try {
    // Only admins can view audit log
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const { limit = 100, offset = 0, user_id, action, start_date, end_date } = req.query;
    
    let query = `
      SELECT 
        id, shift_id, user_id, action, old_data, new_data,
        device_fingerprint, session_id, ip_address, user_agent,
        created_at
      FROM attendance_audit_log
      WHERE company_id = $1
    `;
    
    const params = [req.user.companyId];
    
    if (user_id) {
      query += ` AND user_id = $${params.length + 1}`;
      params.push(user_id);
    }
    
    if (action) {
      query += ` AND action = $${params.length + 1}`;
      params.push(action);
    }
    
    if (start_date) {
      query += ` AND created_at >= $${params.length + 1}`;
      params.push(new Date(start_date));
    }
    
    if (end_date) {
      query += ` AND created_at <= $${params.length + 1}`;
      params.push(new Date(end_date));
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));
    
    const result = await attendance.pool.query(query, params);
    
    res.json({
      audit_log: result.rows,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: result.rowCount || result.rows.length
      }
    });
  } catch (error) {
    console.error('AUDIT_LOG_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 🔄 REPLAY PROTECTION STATUS (Admin)
// =======================
router.get('/replay-status', authenticateToken, async (req, res) => {
  try {
    // Only admins can view replay status
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const status = attendance.getSystemStatus();
    
    res.json({
      replay_protection: {
        cache_size: status.replayCacheSize,
        window_minutes: Math.floor(status.replayWindow / (60 * 1000)),
        active_entries: status.replayCacheSize
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('REPLAY_STATUS_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 📱 DEVICE SESSIONS (Admin)
// =======================
router.get('/device-sessions', authenticateToken, async (req, res) => {
  try {
    // Only admins can view device sessions
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const { user_id } = req.query;
    
    let query = `
      SELECT 
        id, user_id, device_fingerprint, session_id,
        created_at, last_activity, expires_at, is_active
      FROM device_sessions
      WHERE company_id = $1
    `;
    
    const params = [req.user.companyId];
    
    if (user_id) {
      query += ` AND user_id = $2`;
      params.push(user_id);
    }
    
    query += ` ORDER BY last_activity DESC`;
    
    const result = await attendance.pool.query(query, params);
    
    res.json({
      device_sessions: result.rows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('DEVICE_SESSIONS_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

// WebSocket for real-time updates
const WebSocket = require('ws');
const wss = new WebSocket.Server({ noServer: true });

// Connected clients
const clients = new Map();

// WebSocket connection handler
wss.on('connection', (ws, request) => {
  const clientId = crypto.randomUUID();
  clients.set(clientId, { ws, user: null });
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'auth') {
        // Authenticate client
        const client = clients.get(clientId);
        client.user = data.user;
        
        // Send initial data
        sendInitialData(clientId, data.user);
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });
  
  ws.on('close', () => {
    clients.delete(clientId);
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    clients.delete(clientId);
  });
});

// Send initial data to connected client
async function sendInitialData(clientId, user) {
  const client = clients.get(clientId);
  if (!client) return;
  
  try {
    // Send active shift for users
    if (user.role === 'employee') {
      const activeShift = await attendance.getActiveShift(user.id, user.companyId);
      client.ws.send(JSON.stringify({
        type: 'active_shift',
        data: activeShift
      }));
    }
    
    // Send all active shifts for managers
    if (user.role === 'manager' || user.role === 'admin') {
      const activeShifts = await attendance.pool.query(`
        SELECT 
          s.id, s.user_id, s.clock_in_time, s.total_hours,
          s.break_started_at, u.name as user_name, u.email as user_email
        FROM shifts s
        JOIN users u ON s.user_id = u.id
        WHERE s.company_id = $1 AND s.clock_out_time IS NULL
        ORDER BY s.clock_in_time DESC
      `, [user.companyId]);
      
      client.ws.send(JSON.stringify({
        type: 'active_shifts',
        data: activeShifts.rows
      }));
    }
  } catch (error) {
    console.error('Error sending initial data:', error);
  }
}

// Broadcast updates to relevant clients
function broadcastUpdate(type, data, companyId) {
  clients.forEach((client, clientId) => {
    if (client.user && client.user.companyId === companyId) {
      client.ws.send(JSON.stringify({
        type,
        data,
        timestamp: new Date().toISOString()
      }));
    }
  });
}

// Listen for attendance events
attendance.on('shift_update', (data) => {
  broadcastUpdate('shift_update', data, data.companyId);
});

// WebSocket upgrade handler
router.wsUpgrade = (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
};

module.exports = router;
