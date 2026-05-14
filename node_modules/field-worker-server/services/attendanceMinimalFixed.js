/**
 * Fixed Minimal Attendance Service
 * 
 * Addresses all identified production risks while maintaining simplicity
 */

const { Pool } = require('pg');

// Shared connection pool - fix for Risk #9
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Connection limiting - fix for Risk #10
const pLimit = require('p-limit');
const limit = pLimit(10); // Max 10 concurrent operations

// Scheduled replay cache cleanup - fix for Risk #8
const replayCache = new Map();
const REPLAY_WINDOW = 5 * 60 * 1000; // 5 minutes

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of replayCache.entries()) {
    if (now - v > REPLAY_WINDOW * 2) {
      replayCache.delete(k);
    }
  }
}, 5 * 60 * 1000);

class AttendanceMinimalFixed {
  constructor() {
    // No complex state, no caching, no abstractions
  }

  /**
   * Input validation - fix for Risk #11
   */
  validateClockInInput(data) {
    const errors = [];
    
    if (!data.location_id || typeof data.location_id !== 'string') {
      errors.push('Invalid location_id');
    }
    
    const lat = parseFloat(data.latitude);
    const lng = parseFloat(data.longitude);
    
    if (!data.latitude || isNaN(lat) || lat < -90 || lat > 90) {
      errors.push('Invalid latitude');
    }
    
    if (!data.longitude || isNaN(lng) || lng < -180 || lng > 180) {
      errors.push('Invalid longitude');
    }
    
    return errors;
  }

  validateClockOutInput(data) {
    const errors = [];
    
    const lat = parseFloat(data.latitude);
    const lng = parseFloat(data.longitude);
    
    if (!data.latitude || isNaN(lat) || lat < -90 || lat > 90) {
      errors.push('Invalid latitude');
    }
    
    if (!data.longitude || isNaN(lng) || lng < -180 || lng > 180) {
      errors.push('Invalid longitude');
    }
    
    return errors;
  }

  validateBreakInput(data) {
    const errors = [];
    
    if (!data.shift_id || typeof data.shift_id !== 'string') {
      errors.push('Invalid shift_id');
    }
    
    return errors;
  }

  /**
   * Clock in with all fixes applied
   */
  async clockIn(userId, companyId, locationId, data) {
    return limit(async () => {
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Input validation - fix for Risk #11
        const validationErrors = this.validateClockInInput(data);
        if (validationErrors.length > 0) {
          await client.query('ROLLBACK');
          return { 
            success: false, 
            error: 'Validation failed', 
            details: validationErrors 
          };
        }
        
        // Database handles integrity via constraints (NOT DEFERRABLE)
        const result = await client.query(`
          INSERT INTO shifts (
            user_id, company_id, location_id, clock_in_time,
            latitude, longitude, device_fingerprint, session_id
          ) VALUES (
            $1, $2, $3, NOW(),
            $4, $5, $6, $7
          )
          RETURNING *
        `, [
          userId, companyId, locationId,
          parseFloat(data.latitude), parseFloat(data.longitude),
          data.deviceFingerprint, data.sessionId
        ]);

        await client.query('COMMIT');
        return { success: true, shift: result.rows[0] };

      } catch (error) {
        await client.query('ROLLBACK');
        
        // Database constraints provide clear error messages
        if (error.code === '23505') { // Unique constraint violation
          return { 
            success: false, 
            error: 'User already has an active shift',
            idempotent: true 
          };
        }
        
        throw error;
      } finally {
        client.release();
      }
    })();
  }

  /**
   * Clock out with row locking - fix for Risk #7
   */
  async clockOut(userId, companyId, data) {
    return limit(async () => {
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Input validation - fix for Risk #11
        const validationErrors = this.validateClockOutInput(data);
        if (validationErrors.length > 0) {
          await client.query('ROLLBACK');
          return { 
            success: false, 
            error: 'Validation failed', 
            details: validationErrors 
          };
        }
        
        // Row locking for read-modify-write - fix for Risk #7
        const shift = await client.query(`
          SELECT * FROM shifts
          WHERE user_id = $1
          AND company_id = $2
          AND clock_out_time IS NULL
          AND break_started_at IS NULL
          FOR UPDATE
        `, [userId, companyId]);

        if (shift.rows.length === 0) {
          await client.query('ROLLBACK');
          return { 
            success: false, 
            error: 'No active shift found or user is on break' 
          };
        }

        // Database calculates total hours via trigger
        const result = await client.query(`
          UPDATE shifts
          SET 
            clock_out_time = NOW(),
            clock_out_lat = $1,
            clock_out_lng = $2
          WHERE id = $3
          RETURNING *
        `, [parseFloat(data.latitude), parseFloat(data.longitude), shift.rows[0].id]);

        await client.query('COMMIT');
        return { success: true, shift: result.rows[0] };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    })();
  }

  /**
   * Start break with row locking
   */
  async startBreak(userId, companyId, shiftId, data) {
    return limit(async () => {
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Input validation - fix for Risk #11
        const validationErrors = this.validateBreakInput(data);
        if (validationErrors.length > 0) {
          await client.query('ROLLBACK');
          return { 
            success: false, 
            error: 'Validation failed', 
            details: validationErrors 
          };
        }
        
        // Row locking for read-modify-write
        const shift = await client.query(`
          SELECT * FROM shifts
          WHERE id = $1
          AND user_id = $2
          AND company_id = $3
          AND clock_out_time IS NULL
          AND break_started_at IS NULL
          FOR UPDATE
        `, [shiftId, userId, companyId]);

        if (shift.rows.length === 0) {
          await client.query('ROLLBACK');
          return { 
            success: false, 
            error: 'Shift not found or already on break' 
          };
        }

        const result = await client.query(`
          UPDATE shifts
          SET break_started_at = NOW()
          WHERE id = $1
          RETURNING *
        `, [shiftId]);

        await client.query('COMMIT');
        return { success: true, shift: result.rows[0] };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    })();
  }

  /**
   * End break with row locking
   */
  async endBreak(userId, companyId, shiftId, data) {
    return limit(async () => {
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Input validation - fix for Risk #11
        const validationErrors = this.validateBreakInput(data);
        if (validationErrors.length > 0) {
          await client.query('ROLLBACK');
          return { 
            success: false, 
            error: 'Validation failed', 
            details: validationErrors 
          };
        }
        
        // Row locking for read-modify-write
        const shift = await client.query(`
          SELECT * FROM shifts
          WHERE id = $1
          AND user_id = $2
          AND company_id = $3
          AND clock_out_time IS NULL
          AND break_started_at IS NOT NULL
          FOR UPDATE
        `, [shiftId, userId, companyId]);

        if (shift.rows.length === 0) {
          await client.query('ROLLBACK');
          return { 
            success: false, 
            error: 'Shift not found or not on break' 
          };
        }

        // Database calculates break duration via trigger
        const result = await client.query(`
          UPDATE shifts
          SET break_started_at = NULL,
              clock_out_time = NOW()
          WHERE id = $1
          RETURNING *
        `, [shiftId]);

        await client.query('COMMIT');
        return { success: true, shift: result.rows[0] };

      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    })();
  }

  /**
   * Get active shift - simple query
   */
  async getActiveShift(userId, companyId) {
    const { query } = require('../database/connection');
    const result = await query(`
      SELECT * FROM shifts
      WHERE user_id = $1
      AND company_id = $2
      AND clock_out_time IS NULL
      ORDER BY id DESC
      LIMIT 1
    `, [userId, companyId]);

    return result.rows[0] || null;
  }

  /**
   * Health check with connection pool monitoring
   */
  async healthCheck() {
    try {
      const { query } = require('../database/connection');
      
      // Test database connectivity
      await query('SELECT 1');
      
      // Check connection pool stats
      const poolStats = {
        totalCount: pool.totalCount,
        idleCount: pool.idleCount,
        waitingCount: pool.waitingCount
      };
      
      // Check replay cache size
      const cacheSize = replayCache.size;
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: 'minimal-fixed-1.0.0',
        pool: poolStats,
        replayCache: { size: cacheSize }
      };
      
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = AttendanceMinimalFixed;
