/**
 * Lightweight Attendance State Machine
 * 
 * Provides state-based validation and transitions for attendance operations
 * using existing backend architecture and lifecycle guards.
 */

const { query } = require('../database/connection');

/**
 * Attendance States
 */
const AttendanceState = {
  NO_SHIFT: 'NO_SHIFT',
  CLOCKED_IN: 'CLOCKED_IN',
  CLOCKED_OUT: 'CLOCKED_OUT',
  ON_BREAK: 'ON_BREAK',
  STALE_SHIFT: 'STALE_SHIFT',
  INVALID_TRANSITION: 'INVALID_TRANSITION'
};

/**
 * Break States
 */
const BreakState = {
  NO_BREAK: 'NO_BREAK',
  ON_BREAK: 'ON_BREAK',
  BREAK_ENDED: 'BREAK_ENDED'
};

/**
 * State Machine Class
 */
class AttendanceStateMachine {
  constructor(userId, companyId) {
    this.userId = userId;
    this.companyId = companyId;
    this.cache = new Map(); // Simple in-memory cache for state
  }

  /**
   * Get current attendance state for user
   */
  async getCurrentState() {
    const cacheKey = `attendance-state-${this.userId}`;
    
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const result = await query(`
      SELECT 
        clock_in_time,
        clock_out_time,
        break_started_at,
        total_break_seconds,
        created_at,
        updated_at
      FROM shifts
      WHERE user_id = $1
      AND company_id = $2
      ORDER BY created_at DESC
      LIMIT 1
    `, [this.userId, this.companyId]);

    const shift = result.rows[0];
    const state = this.determineState(shift);
    
    this.cache.set(cacheKey, {
      state,
      shift,
      timestamp: Date.now()
    });

    return { state, shift };
  }

  /**
   * Determine attendance state from shift data
   */
  determineState(shift) {
    if (!shift) {
      return AttendanceState.NO_SHIFT;
    }

    // Check for stale shift (older than 24 hours)
    const now = new Date();
    const clockInTime = new Date(shift.clock_in_time);
    const staleThreshold = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    if (clockInTime < staleThreshold) {
      return AttendanceState.STALE_SHIFT;
    }

    if (shift.clock_out_time) {
      return AttendanceState.CLOCKED_OUT;
    }

    if (shift.break_started_at) {
      return AttendanceState.ON_BREAK;
    }

    return AttendanceState.CLOCKED_IN;
  }

  /**
   * Validate state transition
   */
  validateTransition(fromState, toState, context = {}) {
    const validTransitions = {
      [AttendanceState.NO_SHIFT]: {
        [AttendanceState.CLOCKED_IN]: true,
        [AttendanceState.CLOCKED_OUT]: false, // Can't clock out without clocking in
        [AttendanceState.ON_BREAK]: false,  // Can't start break without clocking in
      },
      [AttendanceState.CLOCKED_IN]: {
        [AttendanceState.CLOCKED_IN]: false, // Can't clock in twice
        [AttendanceState.CLOCKED_OUT]: true,
        [AttendanceState.ON_BREAK]: true,
        [AttendanceState.STALE_SHIFT]: false // Can't be stale if just clocked in
      },
      [AttendanceState.CLOCKED_OUT]: {
        [AttendanceState.CLOCKED_IN]: false, // Can clock in after clock out
        [AttendanceState.CLOCKED_OUT]: false, // Can't clock out twice
        [AttendanceState.ON_BREAK]: false,  // Can't be on break if clocked out
        [AttendanceState.STALE_SHIFT]: false  // Can't be stale if clocked out
      },
      [AttendanceState.ON_BREAK]: {
        [AttendanceState.CLOCKED_IN]: false, // Can't clock in while on break
        [AttendanceState.CLOCKED_OUT]: true,  // Can clock out from break
        [AttendanceState.ON_BREAK]: false, // Can't start break twice
        [AttendanceState.BREAK_ENDED]: true, // Can end break
        [AttendanceState.STALE_SHIFT]: false
      },
      [AttendanceState.STALE_SHIFT]: {
        [AttendanceState.NO_SHIFT]: true, // Can start new shift after stale
        [AttendanceState.CLOCKED_IN]: false, // Can't clock into stale shift
        [AttendanceState.CLOCKED_OUT]: false,
        [AttendanceState.ON_BREAK]: false,
        [AttendanceState.STALE_SHIFT]: false
      }
    };

    const transition = validTransitions[fromState]?.[toState];
    
    if (!transition) {
      return {
        valid: false,
        reason: `Invalid transition from ${fromState} to ${toState}`,
        context
      };
    }

    return {
      valid: true,
      context
    };
  }

  /**
   * Clock-in state machine
   */
  async clockIn(context = {}) {
    const currentState = await this.getCurrentState();
    const validation = this.validateTransition(
      currentState.state, 
      AttendanceState.CLOCKED_IN, 
      context
    );

    if (!validation.valid) {
      return {
        success: false,
        error: validation.reason,
        state: currentState.state
      };
    }

    // Additional validation for stale shift
    if (currentState.state === AttendanceState.STALE_SHIFT) {
      return {
        success: false,
        error: 'Cannot clock into stale shift. Please contact manager.',
        state: currentState.state
      };
    }

    // Check if already clocked in (idempotent)
    if (currentState.state === AttendanceState.CLOCKED_IN) {
      return {
        success: true,
        idempotent: true,
        state: AttendanceState.CLOCKED_IN,
        shift: currentState.shift
      };
    }

    // Proceed with clock-in logic (handled by existing endpoint)
    return {
      success: true,
      state: AttendanceState.CLOCKED_IN,
      message: 'Clock-in allowed by state machine'
    };
  }

  /**
   * Clock-out state machine
   */
  async clockOut(context = {}) {
    const currentState = await this.getCurrentState();
    const validation = this.validateTransition(
      currentState.state, 
      AttendanceState.CLOCKED_OUT, 
      context
    );

    if (!validation.valid) {
      return {
        success: false,
        error: validation.reason,
        state: currentState.state
      };
    }

    // Check if already clocked out (idempotent)
    if (currentState.state === AttendanceState.CLOCKED_OUT) {
      return {
        success: true,
        idempotent: true,
        state: AttendanceState.CLOCKED_OUT,
        shift: currentState.shift
      };
    }

    // Check if trying to clock out during break (business rule)
    if (currentState.state === AttendanceState.ON_BREAK) {
      return {
        success: false,
        error: 'Cannot clock out while on break. Please end break first.',
        state: currentState.state
      };
    }

    // Proceed with clock-out logic (handled by existing endpoint)
    return {
      success: true,
      state: AttendanceState.CLOCKED_OUT,
      message: 'Clock-out allowed by state machine'
    };
  }

  /**
   * Break start state machine
   */
  async startBreak(context = {}) {
    const currentState = await this.getCurrentState();
    const validation = this.validateTransition(
      currentState.state, 
      AttendanceState.ON_BREAK, 
      context
    );

    if (!validation.valid) {
      return {
        success: false,
        error: validation.reason,
        state: currentState.state
      };
    }

    // Check if already on break (idempotent)
    if (currentState.state === AttendanceState.ON_BREAK) {
      return {
        success: true,
        idempotent: true,
        state: AttendanceState.ON_BREAK,
        shift: currentState.shift
      };
    }

    // Proceed with break start logic (handled by existing endpoint)
    return {
      success: true,
      state: AttendanceState.ON_BREAK,
      message: 'Break start allowed by state machine'
    };
  }

  /**
   * Break end state machine
   */
  async endBreak(context = {}) {
    const currentState = await this.getCurrentState();
    const validation = this.validateTransition(
      currentState.state, 
      AttendanceState.BREAK_ENDED, 
      context
    );

    if (!validation.valid) {
      return {
        success: false,
        error: validation.reason,
        state: currentState.state
      };
    }

    // Check if not on break (idempotent)
    if (currentState.state !== AttendanceState.ON_BREAK) {
      return {
        success: true,
        idempotent: true,
        state: currentState.state,
        shift: currentState.shift
      };
    }

    // Proceed with break end logic (handled by existing endpoint)
    return {
      success: true,
      state: AttendanceState.BREAK_ENDED,
      message: 'Break end allowed by state machine'
    };
  }

  /**
   * Clear state cache
   */
  clearCache(userId = null) {
    if (userId) {
      this.cache.delete(`attendance-state-${userId}`);
    }
    if (userId === null) {
      // Clear all cache
      this.cache.clear();
    }
  }

  /**
   * Get state machine status for debugging
   */
  async getStateInfo() {
    const currentState = await this.getCurrentState();
    
    return {
      currentState: currentState.state,
      shift: currentState.shift,
      timestamp: Date.now(),
      validTransitions: this.getValidTransitions(currentState.state),
      canClockIn: this.canTransition(currentState.state, AttendanceState.CLOCKED_IN),
      canClockOut: this.canTransition(currentState.state, AttendanceState.CLOCKED_OUT),
      canStartBreak: this.canTransition(currentState.state, AttendanceState.ON_BREAK),
      canEndBreak: this.canTransition(currentState.state, AttendanceState.BREAK_ENDED)
    };
  }

  /**
   * Check if transition is valid
   */
  canTransition(fromState, toState) {
    const validTransitions = this.getValidTransitions(fromState);
    return validTransitions.includes(toState);
  }

  /**
   * Get valid transitions for a state
   */
  getValidTransitions(state) {
    const transitions = {
      [AttendanceState.NO_SHIFT]: [AttendanceState.CLOCKED_IN],
      [AttendanceState.CLOCKED_IN]: [AttendanceState.CLOCKED_OUT, AttendanceState.ON_BREAK, AttendanceState.BREAK_ENDED],
      [AttendanceState.CLOCKED_OUT]: [AttendanceState.CLOCKED_IN],
      [AttendanceState.ON_BREAK]: [AttendanceState.CLOCKED_OUT, AttendanceState.BREAK_ENDED],
      [AttendanceState.BREAK_ENDED]: [AttendanceState.CLOCKED_IN, AttendanceState.ON_BREAK],
      [AttendanceState.STALE_SHIFT]: [AttendanceState.NO_SHIFT, AttendanceState.CLOCKED_IN]
    };
    
    return transitions[state] || [];
  }
}

module.exports = {
  AttendanceState,
  BreakState,
  AttendanceStateMachine
};
