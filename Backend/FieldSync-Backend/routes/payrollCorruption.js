/**
 * Payroll Corruption Detection API Routes
 * 
 * Provides endpoints for detecting and managing payroll corruption scenarios
 * including duplicate shifts, partial break states, stale sessions, and concurrent device actions.
 */

const express = require('express');
const router = express.Router();
const { query } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');
const { PayrollCorruptionDetector, CorruptionType, Severity } = require('../services/payrollCorruptionDetector');

/**
 * Middleware to check admin permissions for corruption detection
 */
const requireAdminPermission = async (req, res, next) => {
  const user = req.user;
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const result = await query(`
    SELECT role, permissions FROM users 
    WHERE id = $1 AND company_id = $2
  `, [user.id, user.companyId]);

  const dbUser = result.rows[0];
  if (!dbUser) {
    return res.status(403).json({ error: 'User not found' });
  }

  const permissions = dbUser.permissions ? JSON.parse(dbUser.permissions) : [];
  const hasPermission = permissions.includes('payroll_corruption_detection') || dbUser.role === 'admin';

  if (!hasPermission) {
    return res.status(403).json({ 
      error: 'Insufficient permissions for payroll corruption detection',
      required: 'payroll_corruption_detection'
    });
  }

  next();
};

//
// =======================
// 🔍 COMPREHENSIVE SCAN
// =======================
router.post('/scan', authenticateToken, requireAdminPermission, async (req, res) => {
  try {
    const userId = req.body.userId || req.user.id;
    const companyId = req.user.companyId;
    const detector = new PayrollCorruptionDetector();

    const options = {
      timeWindowMinutes: req.body.timeWindowMinutes || 5,
      maxStaleHours: req.body.maxStaleHours || 12,
      deviceFingerprint: req.body.deviceFingerprint,
      analysisDays: req.body.analysisDays || 7
    };

    const scanResult = await detector.scanForCorruption(userId, companyId, options);

    res.json({
      success: true,
      scanResult,
      message: `Scan completed. Found ${scanResult.totalCorruption} corruption issues.`
    });

  } catch (error) {
    console.error('Corruption scan error:', error);
    res.status(500).json({
      error: 'Failed to scan for corruption'
    });
  }
});

//
// =======================
// 🔄 DUPLICATE SHIFT DETECTION
// =======================
router.post('/detect/duplicate-shifts', authenticateToken, requireAdminPermission, async (req, res) => {
  try {
    const userId = req.body.userId || req.user.id;
    const companyId = req.user.companyId;
    const timeWindowMinutes = req.body.timeWindowMinutes || 5;
    const detector = new PayrollCorruptionDetector();

    const result = await detector.detectDuplicateShifts(userId, companyId, timeWindowMinutes);

    if (result) {
      res.json({
        success: true,
        corruption: result,
        message: 'Duplicate shift corruption detected'
      });
    } else {
      res.json({
        success: true,
        message: 'No duplicate shift corruption detected'
      });
    }

  } catch (error) {
    console.error('Duplicate shift detection error:', error);
    res.status(500).json({
      error: 'Failed to detect duplicate shifts'
    });
  }
});

//
// =======================
// ⏸️ PARTIAL BREAK STATE DETECTION
// =======================
router.post('/detect/partial-break-states', authenticateToken, requireAdminPermission, async (req, res) => {
  try {
    const userId = req.body.userId || req.user.id;
    const companyId = req.user.companyId;
    const detector = new PayrollCorruptionDetector();

    const result = await detector.detectPartialBreakStates(userId, companyId);

    if (result) {
      res.json({
        success: true,
        corruption: result,
        message: 'Partial break state corruption detected'
      });
    } else {
      res.json({
        success: true,
        message: 'No partial break state corruption detected'
      });
    }

  } catch (error) {
    console.error('Partial break state detection error:', error);
    res.status(500).json({
      error: 'Failed to detect partial break states'
    });
  }
});

//
// =======================
// ⏰ STALE SESSION DETECTION
// =======================
router.post('/detect/stale-sessions', authenticateToken, requireAdminPermission, async (req, res) => {
  try {
    const userId = req.body.userId || req.user.id;
    const companyId = req.user.companyId;
    const maxHours = req.body.maxHours || 12;
    const detector = new PayrollCorruptionDetector();

    const result = await detector.detectStaleSessions(userId, companyId, maxHours);

    if (result) {
      res.json({
        success: true,
        corruption: result,
        message: 'Stale session corruption detected'
      });
    } else {
      res.json({
        success: true,
        message: 'No stale session corruption detected'
      });
    }

  } catch (error) {
    console.error('Stale session detection error:', error);
    res.status(500).json({
      error: 'Failed to detect stale sessions'
    });
  }
});

//
// =======================
// 📱 CONCURRENT DEVICE DETECTION
// =======================
router.post('/detect/concurrent-devices', authenticateToken, requireAdminPermission, async (req, res) => {
  try {
    const userId = req.body.userId || req.user.id;
    const companyId = req.user.companyId;
    const deviceFingerprint = req.body.deviceFingerprint;
    const detector = new PayrollCorruptionDetector();

    const result = await detector.detectConcurrentDeviceActions(userId, companyId, deviceFingerprint);

    if (result) {
      res.json({
        success: true,
        corruption: result,
        message: 'Concurrent device action corruption detected'
      });
    } else {
      res.json({
        success: true,
        message: 'No concurrent device corruption detected'
      });
    }

  } catch (error) {
    console.error('Concurrent device detection error:', error);
    res.status(500).json({
      error: 'Failed to detect concurrent device actions'
    });
  }
});

//
// =======================
// 📊 PAYROLL ANOMALY DETECTION
// =======================
router.post('/detect/payroll-anomalies', authenticateToken, requireAdminPermission, async (req, res) => {
  try {
    const userId = req.body.userId || req.user.id;
    const companyId = req.user.companyId;
    const analysisDays = req.body.analysisDays || 7;
    const detector = new PayrollCorruptionDetector();

    const result = await detector.detectPayrollAnomalies(userId, companyId, analysisDays);

    if (result) {
      res.json({
        success: true,
        corruption: result,
        message: 'Payroll anomaly corruption detected'
      });
    } else {
      res.json({
        success: true,
        message: 'No payroll anomaly corruption detected'
      });
    }

  } catch (error) {
    console.error('Payroll anomaly detection error:', error);
    res.status(500).json({
      error: 'Failed to detect payroll anomalies'
    });
  }
});

//
// =======================
// 🚨 CORRUPTION ALERTS
// =======================
router.get('/alerts', authenticateToken, requireAdminPermission, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const limit = parseInt(req.query.limit) || 50;
    const hours = parseInt(req.query.hours) || 24;
    const status = req.query.status || null;

    let whereClause = `WHERE pca.company_id = $1`;
    const queryParams = [companyId];

    if (hours) {
      whereClause += ` AND pca.detected_at > NOW() - INTERVAL '${hours} hours'`;
    }

    if (status) {
      whereClause += ` AND pca.status = $${queryParams.length + 1}`;
      queryParams.push(status);
    }

    const result = await query(`
      SELECT 
        pca.id,
        pca.corruption_type,
        pca.severity,
        pca.detected_at,
        pca.details,
        pca.status,
        pca.resolved_at,
        pca.resolution_notes,
        u.name as user_name,
        u.email as user_email
      FROM payroll_corruption_alerts pca
      JOIN users u ON pca.user_id = u.id
      ${whereClause}
      ORDER BY pca.detected_at DESC
      LIMIT $${queryParams.length + 1}
    `, [...queryParams, limit]);

    res.json({
      success: true,
      alerts: result.rows,
      pagination: {
        limit,
        hours,
        status
      }
    });

  } catch (error) {
    console.error('Get corruption alerts error:', error);
    res.status(500).json({
      error: 'Failed to fetch corruption alerts'
    });
  }
});

//
// =======================
// ✅ RESOLVE CORRUPTION ALERT
// =======================
router.post('/alerts/:alertId/resolve', authenticateToken, requireAdminPermission, async (req, res) => {
  try {
    const alertId = req.params.alertId;
    const { status, resolutionNotes } = req.body;
    const detector = new PayrollCorruptionDetector();

    await detector.updateCorruptionStatus(alertId, status, resolutionNotes);

    res.json({
      success: true,
      message: `Corruption alert ${alertId} marked as ${status}`
    });

  } catch (error) {
    console.error('Resolve corruption alert error:', error);
    res.status(500).json({
      error: 'Failed to resolve corruption alert'
    });
  }
});

//
// =======================
// 📈 CORRUPTION STATISTICS
// =======================
router.get('/statistics', authenticateToken, requireAdminPermission, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const days = parseInt(req.query.days) || 30;

    const result = await query(`
      SELECT 
        corruption_type,
        severity,
        COUNT(*) as count,
        DATE_TRUNC('day', detected_at) as detection_date
      FROM payroll_corruption_alerts
      WHERE company_id = $1
      AND detected_at > NOW() - INTERVAL '${days} days'
      GROUP BY corruption_type, severity, DATE_TRUNC('day', detected_at)
      ORDER BY detection_date DESC, count DESC
    `, [companyId]);

    // Get summary statistics
    const summaryResult = await query(`
      SELECT 
        COUNT(*) as total_alerts,
        COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) as critical_count,
        COUNT(CASE WHEN severity = 'HIGH' THEN 1 END) as high_count,
        COUNT(CASE WHEN severity = 'MEDIUM' THEN 1 END) as medium_count,
        COUNT(CASE WHEN severity = 'LOW' THEN 1 END) as low_count,
        COUNT(CASE WHEN status = 'OPEN' THEN 1 END) as open_count,
        COUNT(CASE WHEN status = 'RESOLVED' THEN 1 END) as resolved_count
      FROM payroll_corruption_alerts
      WHERE company_id = $1
      AND detected_at > NOW() - INTERVAL '${days} days'
    `, [companyId]);

    res.json({
      success: true,
      statistics: {
        summary: summaryResult.rows[0],
        dailyBreakdown: result.rows,
        period: {
          days,
          startDate: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
          endDate: new Date().toISOString()
        }
      }
    });

  } catch (error) {
    console.error('Get corruption statistics error:', error);
    res.status(500).json({
      error: 'Failed to fetch corruption statistics'
    });
  }
});

//
// =======================
// 🧹 CLEANUP EXPIRED SESSIONS
// =======================
router.post('/cleanup-sessions', authenticateToken, requireAdminPermission, async (req, res) => {
  try {
    const result = await query('SELECT cleanup_expired_sessions()');
    
    res.json({
      success: true,
      deletedSessions: result.rows[0].cleanup_expired_sessions,
      message: `Cleaned up ${result.rows[0].cleanup_expired_sessions} expired sessions`
    });

  } catch (error) {
    console.error('Session cleanup error:', error);
    res.status(500).json({
      error: 'Failed to cleanup expired sessions'
    });
  }
});

module.exports = router;
