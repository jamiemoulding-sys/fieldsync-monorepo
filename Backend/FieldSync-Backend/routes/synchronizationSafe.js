/**
 * Production-Safe Synchronization Routes
 * 
 * Handles all synchronization endpoints with proper validation,
 * caching, and real-time updates.
 */

const express = require('express');
const router = express.Router();
const SynchronizationSafe = require('../services/synchronizationSafe');
const { authenticateToken } = require('../middleware/auth');

const sync = new SynchronizationSafe();

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
    // Send active shifts for managers
    if (user.role === 'manager' || user.role === 'admin') {
      const activeShifts = await sync.getActiveShifts(user.companyId);
      client.ws.send(JSON.stringify({
        type: 'active_shifts',
        data: activeShifts
      }));
    }
    
    // Send system stats for admins
    if (user.role === 'admin') {
      const stats = await sync.getSystemStats(user.companyId);
      client.ws.send(JSON.stringify({
        type: 'system_stats',
        data: stats
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

// Listen for synchronization events
sync.on('shift_update', (data) => {
  broadcastUpdate('shift_update', data, data.companyId);
});

//
// =======================
// 🕐 CLOCK IN
// =======================
router.post('/clock-in', authenticateToken, async (req, res) => {
  try {
    const { location_id, latitude, longitude, device_fingerprint, session_id, metadata } = req.body;
    
    const result = await sync.clockIn(
      req.user.id, 
      req.user.companyId, 
      location_id,
      {
        latitude,
        longitude,
        deviceFingerprint: device_fingerprint || req.headers['x-device-fingerprint'],
        sessionId: session_id || req.headers['x-session-id'],
        metadata
      }
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
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
    const { latitude, longitude, device_fingerprint, session_id, metadata } = req.body;
    
    const result = await sync.clockOut(
      req.user.id, 
      req.user.companyId,
      {
        latitude,
        longitude,
        deviceFingerprint: device_fingerprint || req.headers['x-device-fingerprint'],
        sessionId: session_id || req.headers['x-session-id'],
        metadata
      }
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }

  } catch (error) {
    console.error('CLOCK_OUT_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 👤 ACTIVE SHIFT
// =======================
router.get('/active-shift', authenticateToken, async (req, res) => {
  try {
    const activeShift = await sync.getActiveShift(req.user.id, req.user.companyId);
    res.json(activeShift);
  } catch (error) {
    console.error('ACTIVE_SHIFT_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 📊 ACTIVE SHIFTS (Manager)
// =======================
router.get('/active-shifts', authenticateToken, async (req, res) => {
  try {
    // Only managers and admins can view all active shifts
    if (req.user.role !== 'manager' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const activeShifts = await sync.getActiveShifts(req.user.companyId);
    res.json(activeShifts);
  } catch (error) {
    console.error('ACTIVE_SHIFTS_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 📈 SYSTEM STATS (Admin)
// =======================
router.get('/system-stats', authenticateToken, async (req, res) => {
  try {
    // Only admins can view system stats
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const stats = await sync.getSystemStats(req.user.companyId);
    res.json(stats);
  } catch (error) {
    console.error('SYSTEM_STATS_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 🔍 CONSISTENCY CHECK (Admin)
// =======================
router.get('/consistency-check', authenticateToken, async (req, res) => {
  try {
    // Only admins can run consistency checks
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const check = await sync.runConsistencyCheck(req.user.companyId);
    res.json(check);
  } catch (error) {
    console.error('CONSISTENCY_CHECK_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 💰 PAYROLL CALCULATION (Admin)
// =======================
router.post('/payroll', authenticateToken, async (req, res) => {
  try {
    // Only admins can calculate payroll
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const { start_date, end_date } = req.body;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    
    const payroll = await sync.calculatePayroll(
      req.user.companyId, 
      new Date(start_date), 
      new Date(end_date)
    );
    
    res.json(payroll);
  } catch (error) {
    console.error('PAYROLL_CALCULATION_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 🏥 HEALTH CHECK
// =======================
router.get('/health', async (req, res) => {
  try {
    const health = await sync.healthCheck();
    
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
// 🔧 LOCK STATUS (Admin)
// =======================
router.get('/lock-status', authenticateToken, async (req, res) => {
  try {
    // Only admins can view lock status
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const lockStatus = sync.getLockStatus();
    res.json(lockStatus);
  } catch (error) {
    console.error('LOCK_STATUS_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

//
// =======================
// 🔄 CACHE INVALIDATION (Admin)
// =======================
router.post('/invalidate-cache', authenticateToken, async (req, res) => {
  try {
    // Only admins can invalidate cache
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    const { user_id, company_id } = req.body;
    
    if (company_id && company_id !== req.user.companyId) {
      return res.status(403).json({ error: 'Cannot invalidate cache for different company' });
    }
    
    sync.invalidateUserCache(user_id || req.user.id, company_id || req.user.companyId);
    
    res.json({ 
      success: true, 
      message: 'Cache invalidated',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('CACHE_INVALIDATION_ERROR:', error);
    res.status(500).json({ error: error.message });
  }
});

// WebSocket upgrade handler
router.wsUpgrade = (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
};

module.exports = router;
