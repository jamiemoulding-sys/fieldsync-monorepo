/**
 * Attendance State Machine Middleware
 * 
 * Integrates state machine validation with existing attendance endpoints
 * while preserving current behavior and adding lightweight protection.
 */

const { AttendanceStateMachine, AttendanceState } = require('../services/attendanceStateMachine');

/**
 * State machine middleware factory
 */
const createStateMachineMiddleware = (options = {}) => {
  return async (req, res, next) => {
    const userId = req.user?.id;
    const companyId = req.user?.companyId;

    // Skip state machine for non-authenticated requests
    if (!userId || !companyId) {
      return next();
    }

    const stateMachine = new AttendanceStateMachine(userId, companyId);

    // Attach state machine to request object
    req.stateMachine = stateMachine;

    // Add state info to response headers for debugging
    res.setHeader('X-Attendance-State', 'enabled');

    next();
  };
};

/**
 * State validation helpers for endpoints
 */
const stateValidation = {
  /**
   * Validate clock-in transition
   */
  async validateClockIn(req, res, next) {
    const { stateMachine } = req;
    const result = await stateMachine.clockIn(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        state: result.state
      });
    }

    // Idempotent response
    if (result.idempotent) {
      return res.json({
        message: result.shift?.is_late ? 'Already clocked in (late)' : 'Already clocked in',
        shift: result.shift,
        idempotent: true
      });
    }

    // Continue with normal flow
    req.stateValidation = {
      valid: true,
      state: result.state,
      shift: result.shift
    };

    next();
  },

  /**
   * Validate clock-out transition
   */
  async validateClockOut(req, res, next) {
    const { stateMachine } = req;
    const result = await stateMachine.clockOut(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        state: result.state
      });
    }

    // Idempotent response
    if (result.idempotent) {
      return res.json({
        success: true,
        shift: result.shift,
        idempotent: true
      });
    }

    // Continue with normal flow
    req.stateValidation = {
      valid: true,
      state: result.state,
      shift: result.shift
    };

    next();
  },

  /**
   * Validate break start transition
   */
  async validateBreakStart(req, res, next) {
    const { stateMachine } = req;
    const result = await stateMachine.startBreak(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        state: result.state
      });
    }

    // Idempotent response
    if (result.idempotent) {
      return res.status(201).json({
        success: true,
        break: {
          id: result.shift?.id,
          shift_id: result.shift?.id,
          break_started_at: result.shift?.break_started_at,
        },
        idempotent: true
      });
    }

    // Continue with normal flow
    req.stateValidation = {
      valid: true,
      state: result.state,
      shift: result.shift
    };

    next();
  },

  /**
   * Validate break end transition
   */
  async validateBreakEnd(req, res, next) {
    const { stateMachine } = req;
    const result = await stateMachine.endBreak(req.body);

    if (!result.success) {
      return res.status(400).json({
        error: result.error,
        state: result.state
      });
    }

    // Idempotent response
    if (result.idempotent) {
      return res.json({
        success: true,
        break: {
          id: result.shift?.id,
          shift_id: result.shift?.id,
          total_break_seconds: result.shift?.total_break_seconds,
        },
        idempotent: true
      });
    }

    // Continue with normal flow
    req.stateValidation = {
      valid: true,
      state: result.state,
      shift: result.shift
    };

    next();
  }
};

module.exports = {
  createStateMachineMiddleware,
  stateValidation
};
