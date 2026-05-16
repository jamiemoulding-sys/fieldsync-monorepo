/**
 * Minimal Attendance Service
 * 
 * Smallest production-safe architecture with database-first integrity enforcement
 */

const { query } = require('../database/connection');

class AttendanceMinimal {
  constructor() {
    // No complex state, no caching, no abstractions
  }

  /**
   * Clock in with database-first integrity
   */
  async clockIn(userId, companyId, locationId, data) {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Database handles all integrity checks via constraints
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
        data.latitude, data.longitude,
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
  }

  /**
   * Clock out with database-first integrity
   */
  async clockOut(userId, companyId, data) {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Database enforces break state via constraints
      const result = await client.query(`
        UPDATE shifts
        SET 
          clock_out_time = NOW(),
          clock_out_lat = $1,
          clock_out_lng = $2,
          total_hours = EXTRACT(EPOCH FROM (NOW() - clock_in_time)) / 3600 - COALESCE(total_break_seconds, 0) / 3600
        WHERE user_id = $3
        AND company_id = $4
        AND clock_out_time IS NULL
        AND break_started_at IS NULL
        RETURNING *
      `, [data.latitude, data.longitude, userId, companyId]);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return { 
          success: false, 
          error: 'No active shift found or user is on break' 
        };
      }

      await client.query('COMMIT');
      return { success: true, shift: result.rows[0] };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Start break with database-first integrity
   */
  async startBreak(userId, companyId, shiftId, data) {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      
      const result = await client.query(`
        UPDATE shifts
        SET break_started_at = NOW()
        WHERE id = $1
        AND user_id = $2
        AND company_id = $3
        AND clock_out_time IS NULL
        AND break_started_at IS NULL
        RETURNING *
      `, [shiftId, userId, companyId]);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return { 
          success: false, 
          error: 'Shift not found or already on break' 
        };
      }

      await client.query('COMMIT');
      return { success: true, shift: result.rows[0] };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * End break with database-first integrity
   */
  async endBreak(userId, companyId, shiftId, data) {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Database calculates break duration automatically
      const result = await client.query(`
        UPDATE shifts
        SET 
          break_started_at = NULL,
          total_break_seconds = COALESCE(total_break_seconds, 0) + 
            EXTRACT(EPOCH FROM (NOW() - (
              SELECT break_started_at FROM shifts WHERE id = $1 FOR UPDATE
            )))
        WHERE id = $1
        AND user_id = $2
        AND company_id = $3
        AND clock_out_time IS NULL
        AND break_started_at IS NOT NULL
        RETURNING *
      `, [shiftId, userId, companyId]);

      if (result.rows.length === 0) {
        await client.query('ROLLBACK');
        return { 
          success: false, 
          error: 'Shift not found or not on break' 
        };
      }

      await client.query('COMMIT');
      return { success: true, shift: result.rows[0] };

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get active shift - simple query
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
   * Get database client
   */
  async getClient() {
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10
    });
    return pool.connect();
  }
}

module.exports = AttendanceMinimal;
