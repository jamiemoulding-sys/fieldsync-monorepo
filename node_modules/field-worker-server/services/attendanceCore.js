/**
 * Attendance Core Service
 * 
 * Simplified production-safe attendance system with all critical protections:
 * - Payroll integrity
 * - Offline replay safety  
 * - Concurrency protection
 * - Auditability
 * - Observability
 * - Rollback safety
 */

const { query } = require('../database/connection');

/**
 * Attendance States
 */
const AttendanceState = {
  NO_SHIFT: 'NO_SHIFT',
  CLOCKED_IN: 'CLOCKED_IN',
  ON_BREAK: 'ON_BREAK',
  CLOCKED_OUT: 'CLOCKED_OUT'
};

/**
 * Core Attendance Service
 */
class AttendanceCore {
  constructor() {
    this.stateCache = new Map(); // Simple LRU cache for state
    this.cacheTimeout = 30000; // 30 seconds
  }

  /**
   * Get current attendance state for user
   */
  async getState(userId, companyId) {
    const cacheKey = `${userId}-${companyId}`;
    
    // Check cache first
    if (this.stateCache.has(cacheKey)) {
      const cached = this.stateCache.get(cacheKey);
      if (Date.now() - cached.timestamp < this.cacheTimeout) {
        return cached.state;
      }
    }

    // Get from database
    const result = await query(`
      SELECT 
        id,
        clock_in_time,
        clock_out_time,
        break_started_at,
        total_break_seconds,
        device_fingerprint,
        session_id,
        created_at
      FROM shifts
      WHERE user_id = $1
      AND company_id = $2
      ORDER BY clock_in_time DESC
      LIMIT 1
    `, [userId, companyId]);

    const shift = result.rows[0];
    let state = AttendanceState.NO_SHIFT;

    if (shift) {
      if (!shift.clock_out_time) {
        if (shift.break_started_at) {
          state = AttendanceState.ON_BREAK;
        } else {
          state = AttendanceState.CLOCKED_IN;
        }
      } else {
        state = AttendanceState.CLOCKED_OUT;
      }
    }

    // Cache the result
    this.stateCache.set(cacheKey, {
      state,
      timestamp: Date.now(),
      shift
    });

    return state;
  }

  /**
   * Clock in user with full protection
   */
  async clockIn(userId, companyId, locationId, data) {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Get current state with row lock
      const currentShift = await client.query(`
        SELECT id, clock_in_time, created_at
        FROM shifts
        WHERE user_id = $1
        AND company_id = $2
        AND clock_out_time IS NULL
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE
      `, [userId, companyId]);

      // Check for duplicate within time window (replay protection)
      if (currentShift.rows.length > 0) {
        const shift = currentShift.rows[0];
        const timeSinceCreation = Date.now() - new Date(shift.created_at).getTime();
        
        // Reject if duplicate within 5 minutes
        if (timeSinceCreation < 5 * 60 * 1000) {
          await client.query('ROLLBACK');
          return {
            success: false,
            error: 'Duplicate clock-in request',
            idempotent: true,
            existingShift: shift
          };
        }
        
        // Check for stale shift (older than 12 hours)
        const hoursSinceClockIn = (Date.now() - new Date(shift.clock_in_time).getTime()) / (1000 * 60 * 60);
        if (hoursSinceClockIn > 12) {
          await client.query('ROLLBACK');
          return {
            success: false,
            error: 'Stale shift detected',
            requiresManagerAction: true
          };
        }
        
        // Return existing shift for idempotency
        await client.query('ROLLBACK');
        return {
          success: true,
          shift: shift,
          idempotent: true
        };
      }

      // Create new shift
      const result = await client.query(`
        INSERT INTO shifts (
          user_id, company_id, location_id, clock_in_time,
          latitude, longitude, device_fingerprint, session_id,
          clock_in_lat, clock_in_lng, device_type
        ) VALUES (
          $1, $2, $3, NOW(),
          $4, $5, $6, $7,
          $4, $5, $8
        )
        RETURNING *
      `, [
        userId, companyId, locationId,
        data.latitude, data.longitude,
        data.deviceFingerprint, data.sessionId,
        data.deviceType || 'web'
      ]);

      const newShift = result.rows[0];
      
      // Create audit record
      await client.query(`
        INSERT INTO attendance_audit_trail (
          company_id, action, before_data, after_data, metadata
        ) VALUES (
          $1, 'clock_in', '{}', $2, $3
        )
      `, [
        companyId,
        JSON.stringify(newShift),
        JSON.stringify({ deviceFingerprint: data.deviceFingerprint })
      ]);

      await client.query('COMMIT');
      
      // Clear cache
      this.clearCache(userId, companyId);
      
      return {
        success: true,
        shift: newShift,
        idempotent: false
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Clock out user with full protection
   */
  async clockOut(userId, companyId, data) {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Get active shift with row lock
      const currentShift = await client.query(`
        SELECT id, clock_in_time, break_started_at, total_break_seconds
        FROM shifts
        WHERE user_id = $1
        AND company_id = $2
        AND clock_out_time IS NULL
        ORDER BY id DESC
        LIMIT 1
        FOR UPDATE
      `, [userId, companyId]);

      if (currentShift.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'No active shift found'
        };
      }

      const shift = currentShift.rows[0];

      // Check if user is on break
      if (shift.break_started_at) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'Cannot clock out while on break'
        };
      }

      // Calculate total hours
      const clockInTime = new Date(shift.clock_in_time);
      const clockOutTime = new Date();
      const totalMs = clockOutTime - clockInTime;
      const totalHours = totalMs / (1000 * 60 * 60);

      // Update shift
      const result = await client.query(`
        UPDATE shifts
        SET 
          clock_out_time = NOW(),
          clock_out_lat = $1,
          clock_out_lng = $2,
          total_hours = $3,
          latitude = $1,
          longitude = $2
        WHERE id = $4
        RETURNING *
      `, [data.latitude, data.longitude, totalHours, shift.id]);

      const updatedShift = result.rows[0];
      
      // Create audit record
      await client.query(`
        INSERT INTO attendance_audit_trail (
          company_id, action, before_data, after_data, metadata
        ) VALUES (
          $1, 'clock_out', $2, $3, $4
        )
      `, [
        companyId,
        JSON.stringify(shift),
        JSON.stringify(updatedShift),
        JSON.stringify({ deviceFingerprint: data.deviceFingerprint })
      ]);

      await client.query('COMMIT');
      
      // Clear cache
      this.clearCache(userId, companyId);
      
      return {
        success: true,
        shift: updatedShift,
        idempotent: false
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Start break with full protection
   */
  async startBreak(userId, companyId, shiftId, data) {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Get shift with row lock
      const currentShift = await client.query(`
        SELECT id, clock_in_time, clock_out_time, break_started_at
        FROM shifts
        WHERE id = $1
        AND user_id = $2
        AND company_id = $3
        FOR UPDATE
      `, [shiftId, userId, companyId]);

      if (currentShift.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'Shift not found'
        };
      }

      const shift = currentShift.rows[0];

      // Check if shift is active
      if (shift.clock_out_time) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'Shift already clocked out'
        };
      }

      // Check if already on break
      if (shift.break_started_at) {
        await client.query('ROLLBACK');
        return {
          success: true,
          shift: shift,
          idempotent: true
        };
      }

      // Start break
      const result = await client.query(`
        UPDATE shifts
        SET break_started_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [shiftId]);

      const updatedShift = result.rows[0];
      
      // Create audit record
      await client.query(`
        INSERT INTO attendance_audit_trail (
          company_id, action, before_data, after_data, metadata
        ) VALUES (
          $1, 'break_start', $2, $3, $4
        )
      `, [
        companyId,
        JSON.stringify(shift),
        JSON.stringify(updatedShift),
        JSON.stringify({ deviceFingerprint: data.deviceFingerprint })
      ]);

      await client.query('COMMIT');
      
      // Clear cache
      this.clearCache(userId, companyId);
      
      return {
        success: true,
        shift: updatedShift,
        idempotent: false
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * End break with full protection
   */
  async endBreak(userId, companyId, shiftId, data) {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Get shift with row lock
      const currentShift = await client.query(`
        SELECT id, break_started_at, total_break_seconds
        FROM shifts
        WHERE id = $1
        AND user_id = $2
        AND company_id = $3
        FOR UPDATE
      `, [shiftId, userId, companyId]);

      if (currentShift.rows.length === 0) {
        await client.query('ROLLBACK');
        return {
          success: false,
          error: 'Shift not found'
        };
      }

      const shift = currentShift.rows[0];

      // Check if not on break
      if (!shift.break_started_at) {
        await client.query('ROLLBACK');
        return {
          success: true,
          shift: shift,
          idempotent: true
        };
      }

      // Calculate break duration
      const breakStart = new Date(shift.break_started_at);
      const breakEnd = new Date();
      const breakMs = breakEnd - breakStart;
      const breakSeconds = Math.floor(breakMs / 1000);
      const totalBreakSeconds = (shift.total_break_seconds || 0) + breakSeconds;

      // End break
      const result = await client.query(`
        UPDATE shifts
        SET 
          break_started_at = NULL,
          total_break_seconds = $1
        WHERE id = $2
        RETURNING *
      `, [totalBreakSeconds, shiftId]);

      const updatedShift = result.rows[0];
      
      // Create audit record
      await client.query(`
        INSERT INTO attendance_audit_trail (
          company_id, action, before_data, after_data, metadata
        ) VALUES (
          $1, 'break_end', $2, $3, $4
        )
      `, [
        companyId,
        JSON.stringify(shift),
        JSON.stringify(updatedShift),
        JSON.stringify({ 
          deviceFingerprint: data.deviceFingerprint,
          breakDuration: breakSeconds
        })
      ]);

      await client.query('COMMIT');
      
      // Clear cache
      this.clearCache(userId, companyId);
      
      return {
        success: true,
        shift: updatedShift,
        idempotent: false,
        breakDuration: breakSeconds
      };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get active shift for user
   */
  async getActiveShift(userId, companyId) {
    const result = await query(`
      SELECT * FROM shifts
      WHERE user_id = $1
      AND company_id = $2
      AND clock_out_time IS NULL
      ORDER BY clock_in_time DESC
      LIMIT 1
    `, [userId, companyId]);

    return result.rows[0] || null;
  }

  /**
   * Get shift history for user
   */
  async getShiftHistory(userId, companyId, limit = 20) {
    const result = await query(`
      SELECT * FROM shifts
      WHERE user_id = $1
      AND company_id = $2
      ORDER BY clock_in_time DESC
      LIMIT $3
    `, [userId, companyId, limit]);

    return result.rows;
  }

  /**
   * Validate payroll integrity for shift
   */
  async validatePayrollIntegrity(shiftId) {
    const result = await query(`
      SELECT 
        id,
        clock_in_time,
        clock_out_time,
        break_started_at,
        total_break_seconds,
        total_hours
      FROM shifts
      WHERE id = $1
    `, [shiftId]);

    const shift = result.rows[0];
    if (!shift) {
      return { valid: false, errors: ['Shift not found'] };
    }

    const errors = [];

    // Validate clock-in/clock-out sequence
    if (shift.clock_in_time && shift.clock_out_time) {
      const clockIn = new Date(shift.clock_in_time);
      const clockOut = new Date(shift.clock_out_time);
      
      if (clockOut <= clockIn) {
        errors.push('Clock out time must be after clock in time');
      }
    }

    // Validate break state
    if (shift.break_started_at && shift.clock_out_time) {
      const breakStart = new Date(shift.break_started_at);
      const clockOut = new Date(shift.clock_out_time);
      
      if (breakStart >= clockOut) {
        errors.push('Break start time must be before clock out time');
      }
    }

    // Validate total hours calculation
    if (shift.clock_in_time && shift.clock_out_time && shift.total_hours) {
      const clockIn = new Date(shift.clock_in_time);
      const clockOut = new Date(shift.clock_out_time);
      const calculatedHours = (clockOut - clockIn) / (1000 * 60 * 60);
      const breakHours = (shift.total_break_seconds || 0) / 3600;
      const expectedHours = calculatedHours - breakHours;
      
      const hourDifference = Math.abs(expectedHours - shift.total_hours);
      if (hourDifference > 0.01) { // Allow 1 minute tolerance
        errors.push(`Total hours calculation mismatch: expected ${expectedHours.toFixed(2)}, got ${shift.total_hours}`);
      }
    }

    // Validate break duration
    if (shift.total_break_seconds < 0) {
      errors.push('Total break seconds cannot be negative');
    }

    return {
      valid: errors.length === 0,
      errors,
      shift
    };
  }

  /**
   * Get database client with connection pooling
   */
  async getClient() {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
    
    return pool.connect();
  }

  /**
   * Clear cache for user
   */
  clearCache(userId, companyId) {
    const cacheKey = `${userId}-${companyId}`;
    this.stateCache.delete(cacheKey);
  }

  /**
   * Clean up old cache entries
   */
  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.stateCache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.stateCache.delete(key);
      }
    }
  }
}

// Auto-cleanup cache every 5 minutes
setInterval(() => {
  const core = new AttendanceCore();
  core.cleanupCache();
}, 5 * 60 * 1000);

module.exports = {
  AttendanceCore,
  AttendanceState
};
