/**
 * Attendance Logging Middleware
 * 
 * Integrates production-safe attendance logging with existing endpoints
 * to provide comprehensive observability for lifecycle transitions,
 * replay detection, duplicate actions, and invalid state attempts.
 */

const { AttendanceLogger, LogLevel, EventCategory } = require('../services/attendanceLogger');

/**
 * Logging middleware factory
 */
const createAttendanceLoggingMiddleware = (options = {}) => {
  return async (req, res, next) => {
    const userId = req.user?.id;
    const companyId = req.user?.companyId;

    // Skip logging for non-authenticated requests
    if (!userId || !companyId) {
      return next();
    }

    // Initialize logger
    const logger = new AttendanceLogger();

    // Attach logger to request object
    req.attendanceLogger = logger;

    // Add logging info to response headers
    res.setHeader('X-Attendance-Logging', 'enabled');
    res.setHeader('X-Request-ID', logger.generateRequestId(userId, companyId));

    next();
  };
};

/**
 * Logging helpers for endpoints
 */
const loggingHelpers = {
  /**
   * Log lifecycle transition
   */
  logLifecycle: (req, event, shiftId, metadata = {}) => {
    const { attendanceLogger } = req;
    if (attendanceLogger) {
      attendanceLogger.logLifecycle(
        req.user.id,
        req.user.companyId,
        event,
        shiftId,
        {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          requestId: req.get('X-Request-ID'),
          ...metadata
        }
      );
    }
  },

  /**
   * Log duplicate detection
   */
  logDuplicate: (req, action, shiftId, duplicateDetails = {}) => {
    const { attendanceLogger } = req;
    if (attendanceLogger) {
      attendanceLogger.logDuplicate(
        req.user.id,
        req.user.companyId,
        action,
        shiftId,
        duplicateDetails
      );
    }
  },

  /**
   * Log replay detection
   */
  logReplay: (req, action, shiftId, replayDetails = {}) => {
    const { attendanceLogger } = req;
    if (attendanceLogger) {
      attendanceLogger.logReplay(
        req.user.id,
        req.user.companyId,
        action,
        shiftId,
        replayDetails
      );
    }
  },

  /**
   * Log invalid state attempt
   */
  logInvalidState: (req, fromState, toState, reason = '') => {
    const { attendanceLogger } = req;
    if (attendanceLogger) {
      attendanceLogger.logInvalidState(
        req.user.id,
        req.user.companyId,
        'invalid_transition',
        fromState,
        toState,
        reason
      );
    }
  },

  /**
   * Log security event
   */
  logSecurity: (req, event, securityDetails = {}) => {
    const { attendanceLogger } = req;
    if (attendanceLogger) {
      attendanceLogger.logSecurity(
        req.user.id,
        req.user.companyId,
        event,
        securityDetails
      );
    }
  },

  /**
   * Log performance metrics
   */
  logPerformance: (req, operation, metrics = {}) => {
    const { attendanceLogger } = req;
    if (attendanceLogger) {
      const startTime = Date.now();
      
      // Override res.end to measure response time
      const originalEnd = res.end;
      res.end = function() {
        const duration = Date.now() - startTime;
        attendanceLogger.logPerformance(
          req.user.id,
          req.user.companyId,
          operation,
          {
            duration,
            statusCode: res.statusCode,
            ...metrics
          }
        );
        originalEnd.call(this);
      };
    }
  },

  /**
   * Enhanced response wrapper with logging
   */
  loggedResponse: (req, res, responseData, logLevel = LogLevel.INFO) => {
    const { attendanceLogger } = req;
    if (attendanceLogger) {
      attendanceLogger.logLifecycle(
        req.user.id,
        req.user.companyId,
        'api_response',
        null,
        {
          statusCode: res.statusCode,
          responseSize: JSON.stringify(responseData).length,
          requestId: req.get('X-Request-ID')
        }
      );
    }

    res.json(responseData);
  }
};

module.exports = {
  createAttendanceLoggingMiddleware,
  loggingHelpers
};
