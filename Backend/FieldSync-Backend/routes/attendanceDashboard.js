/**
 * Attendance Observability Dashboard
 * 
 * Provides comprehensive monitoring and analytics for attendance logs,
 * including replay detection, duplicate actions, and invalid state attempts.
 */

const express = require('express');
const router = express.Router();
const { query } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');
const { AttendanceLogger } = require('../services/attendanceLogger');

/**
 * Get attendance analytics
 */
router.get('/analytics', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;
    const logger = new AttendanceLogger();

    // Get time range from query params
    const hours = parseInt(req.query.hours) || 24;
    const limit = parseInt(req.query.limit) || 100;

    // Get recent logs with analytics
    const logs = await logger.getRecentLogs(userId, companyId, hours, limit);

    // Calculate analytics
    const analytics = {
      summary: await logger.getDuplicateSummary(userId, companyId, 1),
      recentEvents: logs.map(log => ({
        id: log.id,
        timestamp: log.timestamp,
        level: log.level,
        category: log.category,
        event: log.event,
        metadata: log.metadata
      })),
      timeRange: {
        hours,
        startDate: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      },
      generatedAt: new Date().toISOString()
    };

    res.json(analytics);

  } catch (error) {
    console.error('Analytics API error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * Get duplicate detection summary
 */
router.get('/duplicates', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;
    const logger = new AttendanceLogger();

    const hours = parseInt(req.query.hours) || 24;

    const summary = await logger.getDuplicateSummary(userId, companyId, hours);

    res.json({
      summary,
      timeRange: {
        hours,
        startDate: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      },
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Duplicates API error:', error);
    res.status(500).json({ error: 'Failed to fetch duplicate summary' });
  }
});

/**
 * Get security events
 */
router.get('/security', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;
    const logger = new AttendanceLogger();

    const hours = parseInt(req.query.hours) || 24;

    const result = await query(`
      SELECT 
        id,
        timestamp,
        level,
        category,
        event,
        metadata
      FROM attendance_logs
      WHERE user_id = $1
      AND company_id = $2
      AND category = 'SECURITY'
      AND timestamp > NOW() - INTERVAL '${hours} hours'
      ORDER BY timestamp DESC
      LIMIT 50
    `, [userId, companyId, hours]);

    res.json({
      securityEvents: result.rows,
      timeRange: {
        hours,
        startDate: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      },
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Security API error:', error);
    res.status(500).json({ error: 'Failed to fetch security events' });
  }
});

/**
 * Get performance metrics
 */
router.get('/performance', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;
    const logger = new AttendanceLogger();

    const hours = parseInt(req.query.hours) || 24;

    const result = await query(`
      SELECT 
        COUNT(*) as total_requests,
        AVG(CASE WHEN metadata->>'duration' THEN (metadata->>'duration')::numeric ELSE NULL END) as avg_duration,
        MAX(CASE WHEN metadata->>'duration' THEN (metadata->>'duration')::numeric ELSE NULL END) as max_duration,
        COUNT(CASE WHEN category = 'PERFORMANCE' THEN 1 END) as performance_logs
      FROM attendance_logs
      WHERE user_id = $1
      AND company_id = $2
      AND category = 'PERFORMANCE'
      AND timestamp > NOW() - INTERVAL '${hours} hours'
    `, [userId, companyId, hours]);

    res.json({
      performance: {
        totalRequests: result.rows[0]?.total_requests || 0,
        averageDuration: parseFloat(result.rows[0]?.avg_duration || 0),
        maxDuration: parseInt(result.rows[0]?.max_duration || 0),
        performanceLogs: result.rows[0]?.performance_logs || 0
      },
      timeRange: {
        hours,
        startDate: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      },
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Performance API error:', error);
    res.status(500).json({ error: 'Failed to fetch performance metrics' });
  }
});

/**
 * Cleanup old logs (admin only)
 */
router.post('/cleanup', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin
    const userRes = await query('SELECT role FROM users WHERE id = $1', [req.user.id]);
    const user = userRes.rows[0];
    
    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const daysToKeep = parseInt(req.body.days) || 30;
    const logger = new AttendanceLogger();

    await logger.cleanupOldLogs(daysToKeep);

    res.json({
      message: `Cleaned up attendance logs older than ${daysToKeep} days`,
      daysToKeep,
      cleanedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Cleanup API error:', error);
    res.status(500).json({ error: 'Failed to cleanup logs' });
  }
});

module.exports = router;
