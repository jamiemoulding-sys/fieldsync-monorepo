/**
 * Production-Safe Attendance Logger
 * 
 * Provides comprehensive logging and observability for attendance lifecycle transitions,
 * replay detection, duplicate actions, and invalid state attempts.
 */

const { query } = require('../database/connection');

/**
 * Log Levels
 */
const LogLevel = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  CRITICAL: 'CRITICAL'
};

/**
 * Event Categories
 */
const EventCategory = {
  LIFECYCLE: 'LIFECYCLE',
  DUPLICATE: 'DUPLICATE',
  REPLAY: 'REPLAY',
  INVALID_STATE: 'INVALID_STATE',
  SECURITY: 'SECURITY',
  PERFORMANCE: 'PERFORMANCE'
};

/**
 * Attendance Logger Class
 */
class AttendanceLogger {
  constructor() {
    this.requestId = 0;
    this.sessionCache = new Map();
  }

  /**
   * Generate unique request ID
   */
  generateRequestId(userId, companyId) {
    return `${companyId}-${userId}-${Date.now()}-${++this.requestId}`;
  }

  /**
   * Log lifecycle transition
   */
  async logLifecycle(userId, companyId, event, shiftId, metadata = {}) {
    const logEntry = {
      id: this.generateRequestId(userId, companyId),
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      category: EventCategory.LIFECYCLE,
      userId,
      companyId,
      event,
      shiftId,
      metadata: {
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress,
        requestId: metadata.requestId,
        ...metadata
      }
    };

    await this.writeLog(logEntry);
  }

  /**
   * Log duplicate action detection
   */
  async logDuplicate(userId, companyId, action, shiftId, duplicateDetails = {}) {
    const logEntry = {
      id: this.generateRequestId(userId, companyId),
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      category: EventCategory.DUPLICATE,
      userId,
      companyId,
      event: action,
      shiftId,
      metadata: {
        duplicateType: duplicateDetails.type, // 'state_based', 'time_window', 'concurrent'
        duplicateWindow: duplicateDetails.window, // seconds
        existingState: duplicateDetails.existingState,
        attemptedState: duplicateDetails.attemptedState,
        ...duplicateDetails
      }
    };

    await this.writeLog(logEntry);
  }

  /**
   * Log replay detection
   */
  async logReplay(userId, companyId, action, shiftId, replayDetails = {}) {
    const logEntry = {
      id: this.generateRequestId(userId, companyId),
      timestamp: new Date().toISOString(),
      level: LogLevel.WARN,
      category: EventCategory.REPLAY,
      userId,
      companyId,
      event: action,
      shiftId,
      metadata: {
        replayType: replayDetails.type, // 'offline_queue', 'network_retry', 'mobile_retry'
        replayAge: replayDetails.age, // seconds
        originalTimestamp: replayDetails.originalTimestamp,
        replayCount: replayDetails.replayCount,
        ...replayDetails
      }
    };

    await this.writeLog(logEntry);
  }

  /**
   * Log invalid state attempt
   */
  async logInvalidState(userId, companyId, action, fromState, toState, reason = '') {
    const logEntry = {
      id: this.generateRequestId(userId, companyId),
      timestamp: new Date().toISOString(),
      level: LogLevel.ERROR,
      category: EventCategory.INVALID_STATE,
      userId,
      companyId,
      event: action,
      shiftId: null,
      metadata: {
        fromState,
        toState,
        reason,
        violation: this.getStateViolation(fromState, toState)
      }
    };

    await this.writeLog(logEntry);
  }

  /**
   * Log security event
   */
  async logSecurity(userId, companyId, event, securityDetails = {}) {
    const logEntry = {
      id: this.generateRequestId(userId, companyId),
      timestamp: new Date().toISOString(),
      level: LogLevel.CRITICAL,
      category: EventCategory.SECURITY,
      userId,
      companyId,
      event,
      shiftId: null,
      metadata: {
        threat: securityDetails.threat, // 'unauthorized_access', 'data_manipulation', 'replay_attack'
        severity: securityDetails.severity, // 'high', 'medium', 'low'
        source: securityDetails.source, // 'api', 'mobile', 'web'
        ...securityDetails
      }
    };

    await this.writeLog(logEntry);
  }

  /**
   * Log performance metrics
   */
  async logPerformance(userId, companyId, operation, metrics = {}) {
    const logEntry = {
      id: this.generateRequestId(userId, companyId),
      timestamp: new Date().toISOString(),
      level: LogLevel.INFO,
      category: EventCategory.PERFORMANCE,
      userId,
      companyId,
      event: operation,
      shiftId: null,
      metadata: {
        duration: metrics.duration, // milliseconds
        databaseQueries: metrics.queryCount,
        cacheHit: metrics.cacheHit,
        memoryUsage: metrics.memoryUsage,
        concurrency: metrics.concurrentUsers,
        ...metrics
      }
    };

    await this.writeLog(logEntry);
  }

  /**
   * Detect state violation
   */
  getStateViolation(fromState, toState) {
    const violations = {
      'NO_SHIFT->CLOCKED_OUT': 'clock_out_without_clock_in',
      'CLOCKED_IN->CLOCKED_IN': 'duplicate_clock_in',
      'CLOCKED_IN->ON_BREAK': 'invalid_break_start',
      'ON_BREAK->CLOCKED_OUT': 'clock_out_during_break',
      'ON_BREAK->ON_BREAK': 'duplicate_break_start',
      'CLOCKED_OUT->CLOCKED_IN': 'duplicate_clock_out',
      'STALE_SHIFT->CLOCKED_IN': 'clock_into_stale_shift'
    };

    return violations[`${fromState}->${toState}`] || 'unknown_violation';
  }

  /**
   * Write log entry to database
   */
  async writeLog(logEntry) {
    try {
      await query(`
        INSERT INTO attendance_logs (
          id,
          timestamp,
          level,
          category,
          user_id,
          company_id,
          event,
          shift_id,
          metadata,
          created_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, NOW()
        )
      `, [
        logEntry.id,
        logEntry.timestamp,
        logEntry.level,
        logEntry.category,
        logEntry.userId,
        logEntry.companyId,
        logEntry.event,
        logEntry.shiftId,
        JSON.stringify(logEntry.metadata),
        logEntry.timestamp
      ]);

      console.log(`✅ Attendance log: ${logEntry.level} - ${logEntry.event}`);
    } catch (error) {
      console.error('❌ Failed to write attendance log:', error);
      
      // Fallback to console logging
      console.log(`🚨 ATTENDANCE LOG ERROR: ${JSON.stringify(logEntry)}`);
    }
  }

  /**
   * Get recent logs for analysis
   */
  async getRecentLogs(userId, companyId, hours = 24, limit = 100) {
    const result = await query(`
      SELECT 
        id,
        timestamp,
        level,
        category,
        event,
        shift_id,
        metadata
      FROM attendance_logs
      WHERE user_id = $1
      AND company_id = $2
      AND timestamp > NOW() - INTERVAL '${hours} hours'
      ORDER BY timestamp DESC
      LIMIT $3
    `, [userId, companyId, hours, limit]);

    return result.rows;
  }

  /**
   * Get duplicate detection summary
   */
  async getDuplicateSummary(userId, companyId, hours = 1) {
    const result = await query(`
      SELECT 
        COUNT(*) as total_events,
        COUNT(CASE WHEN category = 'DUPLICATE' THEN 1 END) as duplicate_events,
        COUNT(CASE WHEN category = 'REPLAY' THEN 1 END) as replay_events,
        COUNT(CASE WHEN category = 'INVALID_STATE' THEN 1 END) as invalid_events
      FROM attendance_logs
      WHERE user_id = $1
      AND company_id = $2
      AND timestamp > NOW() - INTERVAL '${hours} hours'
    `, [userId, companyId, hours]);

    return result.rows[0];
  }

  /**
   * Cleanup old logs
   */
  async cleanupOldLogs(daysToKeep = 30) {
    try {
      await query(`
        DELETE FROM attendance_logs
        WHERE timestamp < NOW() - INTERVAL '${daysToKeep} days'
      `);

      console.log(`🧹 Cleaned up attendance logs older than ${daysToKeep} days`);
    } catch (error) {
      console.error('Failed to cleanup attendance logs:', error);
    }
  }
}

module.exports = {
  AttendanceLogger,
  LogLevel,
  EventCategory
};
