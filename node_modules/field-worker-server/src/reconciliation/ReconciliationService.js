/**
 * Minimal Authoritative Attendance Reconciliation Service
 * 
 * Provides deterministic reconciliation rules and replay-safe operation handling
 * while preserving existing schema and attendance behavior.
 */

class ReconciliationService {
  constructor(database) {
    this.db = database;
    
    // FINAL ATTENDANCE STATES - Payroll truth only
    this.ATTENDANCE_STATES = {
      IDLE: 'idle',
      CLOCKED_IN: 'clocked_in',
      ON_BREAK: 'on_break'
    };
    
    // Deterministic reconciliation rules
    this.reconciliationRules = {
      // Clock-in rules
      clockIn: {
        requires: [this.ATTENDANCE_STATES.IDLE],
        rejects: [this.ATTENDANCE_STATES.CLOCKED_IN, this.ATTENDANCE_STATES.ON_BREAK],
        serverValidation: true
      },
      
      // Clock-out rules
      clockOut: {
        requires: [this.ATTENDANCE_STATES.CLOCKED_IN, this.ATTENDANCE_STATES.ON_BREAK],
        rejects: [this.ATTENDANCE_STATES.IDLE],
        serverValidation: true
      },
      
      // Break-start rules
      breakStart: {
        requires: [this.ATTENDANCE_STATES.CLOCKED_IN],
        rejects: [this.ATTENDANCE_STATES.IDLE, this.ATTENDANCE_STATES.ON_BREAK],
        serverValidation: true
      },
      
      // Break-end rules
      breakEnd: {
        requires: [this.ATTENDANCE_STATES.ON_BREAK],
        rejects: [this.ATTENDANCE_STATES.IDLE, this.ATTENDANCE_STATES.CLOCKED_IN],
        serverValidation: true
      }
    };
  }

  /**
   * Get authoritative attendance state from backend
   */
  async getAuthoritativeState(userId, companyId) {
    try {
      // Query authoritative active shift from database
      const result = await this.db.query(`
        SELECT 
          id,
          user_id,
          company_id,
          location_id,
          clock_in_time,
          clock_out_time,
          break_started_at,
          total_break_seconds,
          latitude,
          longitude,
          is_late
        FROM shifts
        WHERE user_id = $1
        AND company_id = $2
        AND clock_out_time IS NULL
        ORDER BY clock_in_time DESC
        LIMIT 1
      `, [userId, companyId]);

      const activeShift = result.rows[0] || null;

      // Determine attendance state from authoritative data
      const attendanceState = {
        state: this.ATTENDANCE_STATES.IDLE,
        activeShift: null,
        onBreak: false,
        serverTimestamp: new Date().toISOString()
      };

      if (activeShift) {
        attendanceState.activeShift = {
          id: activeShift.id,
          locationId: activeShift.location_id,
          clockInTime: activeShift.clock_in_time,
          isLate: activeShift.is_late
        };

        // Determine if on break
        if (activeShift.break_started_at) {
          attendanceState.state = this.ATTENDANCE_STATES.ON_BREAK;
          attendanceState.onBreak = true;
          attendanceState.activeShift.breakStartedAt = activeShift.break_started_at;
          attendanceState.activeShift.totalBreakSeconds = activeShift.total_break_seconds || 0;
        } else {
          attendanceState.state = this.ATTENDANCE_STATES.CLOCKED_IN;
          attendanceState.onBreak = false;
        }
      }

      return attendanceState;
    } catch (error) {
      console.error('Get authoritative state failed:', error);
      throw error;
    }
  }

  /**
   * Validate operation against authoritative state
   */
  validateOperation(operationType, authoritativeState) {
    const rules = this.reconciliationRules[operationType];
    
    if (!rules) {
      return {
        valid: false,
        reason: 'Unknown operation type'
      };
    }

    const currentState = authoritativeState.state;

    // Check if current state is in required states
    if (rules.requires && !rules.requires.includes(currentState)) {
      return {
        valid: false,
        reason: `Operation requires state: ${rules.requires.join(' or ')}, current state: ${currentState}`
      };
    }

    // Check if current state is in rejected states
    if (rules.rejects && rules.rejects.includes(currentState)) {
      return {
        valid: false,
        reason: `Operation rejects state: ${currentState}`
      };
    }

    return {
      valid: true
    };
  }

  /**
   * Handle replay-safe operation processing
   */
  async processOperationWithReplaySafety(operation, userId, companyId) {
    try {
      // 1. Get authoritative state
      const authoritativeState = await this.getAuthoritativeState(userId, companyId);

      // 2. Validate operation against authoritative state
      const validation = this.validateOperation(operation.type, authoritativeState);

      if (!validation.valid) {
        return {
          success: false,
          error: validation.reason,
          authoritativeState,
          rejected: true
        };
      }

      // 3. Process operation (delegated to existing endpoints)
      const result = await this.delegateToExistingEndpoint(operation, userId, companyId);

      return {
        success: true,
        result,
        authoritativeState
      };
    } catch (error) {
      console.error('Process operation with replay safety failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delegate to existing endpoint (placeholder)
   */
  async delegateToExistingEndpoint(operation, userId, companyId) {
    // This would delegate to the existing clock-in, clock-out, break-start, break-end endpoints
    // For now, return a placeholder result
    return {
      operationId: operation.id,
      processed: true,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Handle crash recovery
   */
  async handleCrashRecovery(userId, companyId) {
    try {
      // 1. Get authoritative state
      const authoritativeState = await this.getAuthoritativeState(userId, companyId);

      // 2. Return authoritative state for client reconstruction
      return {
        success: true,
        authoritativeState,
        recoveryType: 'crash_recovery',
        message: 'Client should reconstruct state from authoritative data'
      };
    } catch (error) {
      console.error('Handle crash recovery failed:', error);
      throw error;
    }
  }

  /**
   * Handle app reinstall recovery
   */
  async handleAppReinstallRecovery(userId, companyId) {
    try {
      // 1. Get authoritative state
      const authoritativeState = await this.getAuthoritativeState(userId, companyId);

      // 2. Return authoritative state for client reconstruction
      return {
        success: true,
        authoritativeState,
        recoveryType: 'app_reinstall_recovery',
        message: 'Client should reconstruct state from authoritative data'
      };
    } catch (error) {
      console.error('Handle app reinstall recovery failed:', error);
      throw error;
    }
  }

  /**
   * Handle offline replay recovery
   */
  async handleOfflineReplayRecovery(userId, companyId, queuedOperations) {
    try {
      // 1. Get authoritative state
      const authoritativeState = await this.getAuthoritativeState(userId, companyId);

      // 2. Validate each queued operation against authoritative state
      const validOperations = [];
      const rejectedOperations = [];

      for (const operation of queuedOperations) {
        const validation = this.validateOperation(operation.type, authoritativeState);

        if (validation.valid) {
          validOperations.push(operation);
        } else {
          rejectedOperations.push({
            operation,
            reason: validation.reason,
            authoritativeState: authoritativeState.state
          });
        }
      }

      // 3. Return reconciliation result
      return {
        success: true,
        authoritativeState,
        validOperations,
        rejectedOperations,
        recoveryType: 'offline_replay_recovery',
        message: `${validOperations.length} operations validated, ${rejectedOperations.length} operations rejected`
      };
    } catch (error) {
      console.error('Handle offline replay recovery failed:', error);
      throw error;
    }
  }

  /**
   * Handle duplicate request recovery
   */
  async handleDuplicateRequestRecovery(userId, companyId, operation) {
    try {
      // 1. Get authoritative state
      const authoritativeState = await this.getAuthoritativeState(userId, companyId);

      // 2. Validate operation against authoritative state
      const validation = this.validateOperation(operation.type, authoritativeState);

      // 3. If validation passes, operation is a duplicate that can be safely ignored
      if (validation.valid && authoritativeState.activeShift) {
        return {
          success: true,
          authoritativeState,
          duplicateDetected: true,
          message: 'Duplicate request detected, returning current authoritative state'
        };
      }

      // 4. If validation fails, operation is invalid
      if (!validation.valid) {
        return {
          success: false,
          error: validation.reason,
          authoritativeState,
          rejected: true
        };
      }

      // 5. Otherwise, process the operation
      const result = await this.processOperationWithReplaySafety(operation, userId, companyId);

      return result;
    } catch (error) {
      console.error('Handle duplicate request recovery failed:', error);
      throw error;
    }
  }

  /**
   * Get reconciliation statistics
   */
  async getReconciliationStatistics(userId, companyId) {
    try {
      // Get active shift
      const activeShift = await this.getAuthoritativeState(userId, companyId);

      // Get recent shifts
      const recentShifts = await this.db.query(`
        SELECT 
          id,
          clock_in_time,
          clock_out_time,
          break_started_at,
          total_break_seconds
        FROM shifts
        WHERE user_id = $1
        AND company_id = $2
        ORDER BY clock_in_time DESC
        LIMIT 10
      `, [userId, companyId]);

      return {
        success: true,
        statistics: {
          currentState: activeShift.state,
          hasActiveShift: !!activeShift.activeShift,
          onBreak: activeShift.onBreak,
          recentShiftsCount: recentShifts.rows.length,
          serverTimestamp: activeShift.serverTimestamp
        },
        recentShifts: recentShifts.rows
      };
    } catch (error) {
      console.error('Get reconciliation statistics failed:', error);
      throw error;
    }
  }
}

module.exports = ReconciliationService;
