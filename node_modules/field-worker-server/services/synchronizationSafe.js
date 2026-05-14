/**
 * Production-Safe Synchronization Service
 * 
 * Handles all synchronization operations with proper consistency,
 * race condition prevention, and cache management.
 */

const { Pool } = require('pg');
const crypto = require('crypto');
const EventEmitter = require('events');

class SynchronizationSafe extends EventEmitter {
  constructor() {
    super();
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      min: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Cache management
    this.activeShiftCache = new Map();
    this.systemStatsCache = null;
    this.cacheTimestamps = new Map();
    this.CACHE_TTL = 30000; // 30 seconds

    // Lock management for race condition prevention
    this.locks = new Map();
    this.lockTimeouts = new Map();

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Execute operation with row locking to prevent race conditions
   */
  async executeWithLock(lockKey, operation, timeout = 10000) {
    if (this.locks.has(lockKey)) {
      throw new Error(`Operation locked: ${lockKey}`);
    }

    this.locks.set(lockKey, true);
    this.lockTimeouts.set(lockKey, Date.now() + timeout);

    try {
      const result = await operation();
      return result;
    } finally {
      this.locks.delete(lockKey);
      this.lockTimeouts.delete(lockKey);
    }
  }

  /**
   * Clock-in with duplicate prevention and transaction safety
   */
  async clockIn(userId, companyId, locationId, data) {
    const lockKey = `clockin:${userId}:${companyId}`;
    
    return this.executeWithLock(lockKey, async () => {
      const client = await this.pool.connect();
      let committed = false;
      
      try {
        await client.query('BEGIN');

        // Check for existing active shift with row lock
        const existing = await client.query(`
          SELECT id, clock_in_time FROM shifts
          WHERE user_id = $1 AND company_id = $2 AND clock_out_time IS NULL
          FOR UPDATE
        `, [userId, companyId]);

        if (existing.rows.length > 0) {
          throw new Error('User already has active shift');
        }

        // Validate location exists
        const location = await client.query(`
          SELECT id, name, lat, lng, radius FROM locations
          WHERE id = $1 AND company_id = $2
        `, [locationId, companyId]);

        if (location.rows.length === 0) {
          throw new Error('Invalid location');
        }

        // Validate GPS coordinates if provided
        if (data.latitude && data.longitude) {
          const distance = this.calculateDistance(
            data.latitude, data.longitude,
            location.rows[0].lat, location.rows[0].lng
          );

          if (distance > location.rows[0].radius) {
            throw new Error(`Outside geofence: ${distance}m > ${location.rows[0].radius}m`);
          }
        }

        // Insert new shift
        const result = await client.query(`
          INSERT INTO shifts (
            user_id, company_id, location_id, clock_in_time,
            latitude, longitude, device_fingerprint, session_id,
            metadata
          ) VALUES (
            $1, $2, $3, NOW(),
            $4, $5, $6, $7, $8
          )
          RETURNING *
        `, [
          userId, companyId, locationId,
          data.latitude, data.longitude,
          data.deviceFingerprint, data.sessionId,
          JSON.stringify(data.metadata || {})
        ]);

        await client.query('COMMIT');
        committed = true;

        // Invalidate cache
        this.invalidateUserCache(userId, companyId);

        // Emit real-time update
        this.emit('shift_update', {
          type: 'clock_in',
          userId,
          companyId,
          shiftId: result.rows[0].id,
          timestamp: new Date().toISOString()
        });

        return { success: true, shift: result.rows[0] };

      } catch (error) {
        if (!committed) {
          await client.query('ROLLBACK');
        }
        throw error;
      } finally {
        if (committed) {
          client.release();
        }
      }
    });
  }

  /**
   * Clock-out with transaction safety and validation
   */
  async clockOut(userId, companyId, data) {
    const lockKey = `clockout:${userId}:${companyId}`;
    
    return this.executeWithLock(lockKey, async () => {
      const client = await this.pool.connect();
      let committed = false;
      
      try {
        await client.query('BEGIN');

        // Get active shift with row lock
        const shift = await client.query(`
          SELECT id, clock_in_time, break_started_at, total_break_seconds
          FROM shifts
          WHERE user_id = $1 AND company_id = $2 AND clock_out_time IS NULL
          FOR UPDATE
        `, [userId, companyId]);

        if (shift.rows.length === 0) {
          throw new Error('No active shift found');
        }

        const activeShift = shift.rows[0];

        // Validate not on break
        if (activeShift.break_started_at) {
          throw new Error('Cannot clock out while on break');
        }

        // Calculate total hours
        const totalHours = this.calculateTotalHours(
          activeShift.clock_in_time,
          new Date(),
          activeShift.total_break_seconds || 0
        );

        // Update shift
        const result = await client.query(`
          UPDATE shifts
          SET 
            clock_out_time = NOW(),
            clock_out_lat = $1,
            clock_out_lng = $2,
            total_hours = $3,
            metadata = metadata || $4
          WHERE id = $5
          RETURNING *
        `, [
          data.latitude, data.longitude,
          totalHours,
          JSON.stringify(data.metadata || {}),
          activeShift.id
        ]);

        await client.query('COMMIT');
        committed = true;

        // Invalidate cache
        this.invalidateUserCache(userId, companyId);

        // Emit real-time update
        this.emit('shift_update', {
          type: 'clock_out',
          userId,
          companyId,
          shiftId: activeShift.id,
          totalHours,
          timestamp: new Date().toISOString()
        });

        return { success: true, shift: result.rows[0] };

      } catch (error) {
        if (!committed) {
          await client.query('ROLLBACK');
        }
        throw error;
      } finally {
        if (committed) {
          client.release();
        }
      }
    });
  }

  /**
   * Get active shift with caching and consistency
   */
  async getActiveShift(userId, companyId) {
    const cacheKey = `${userId}:${companyId}`;
    const cached = this.activeShiftCache.get(cacheKey);
    const now = Date.now();

    if (cached && this.cacheTimestamps.get(cacheKey) > now - this.CACHE_TTL) {
      return cached;
    }

    const result = await this.pool.query(`
      SELECT * FROM shifts
      WHERE user_id = $1 AND company_id = $2 AND clock_out_time IS NULL
      ORDER BY id DESC LIMIT 1
    `, [userId, companyId]);

    const shift = result.rows[0] || null;
    
    this.activeShiftCache.set(cacheKey, shift);
    this.cacheTimestamps.set(cacheKey, now);

    return shift;
  }

  /**
   * Get all active shifts for manager dashboard
   */
  async getActiveShifts(companyId) {
    const cacheKey = `active_shifts:${companyId}`;
    const cached = this.activeShiftCache.get(cacheKey);
    const now = Date.now();

    if (cached && this.cacheTimestamps.get(cacheKey) > now - this.CACHE_TTL) {
      return cached;
    }

    const result = await this.pool.query(`
      SELECT 
        s.id,
        s.user_id,
        s.clock_in_time,
        s.total_hours,
        s.break_started_at,
        s.latitude,
        s.longitude,
        u.name as user_name,
        u.email as user_email,
        l.name as location_name
      FROM shifts s
      JOIN users u ON s.user_id = u.id
      JOIN locations l ON s.location_id = l.id
      WHERE s.company_id = $1 AND s.clock_out_time IS NULL
      ORDER BY s.clock_in_time DESC
    `, [companyId]);

    const shifts = result.rows;
    
    this.activeShiftCache.set(cacheKey, shifts);
    this.cacheTimestamps.set(cacheKey, now);

    return shifts;
  }

  /**
   * Get system statistics for admin tools
   */
  async getSystemStats(companyId) {
    const cacheKey = `system_stats:${companyId}`;
    const cached = this.systemStatsCache;
    const now = Date.now();

    if (cached && this.cacheTimestamps.get(cacheKey) > now - this.CACHE_TTL) {
      return cached;
    }

    const result = await this.pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM shifts WHERE company_id = $1 AND clock_out_time IS NULL) as active_shifts,
        (SELECT COUNT(*) FROM shifts WHERE company_id = $1 AND clock_in_time > NOW() - INTERVAL '24 hours') as recent_shifts,
        (SELECT COUNT(*) FROM shifts WHERE company_id = $1) as total_shifts,
        (SELECT AVG(total_hours) FROM shifts WHERE company_id = $1 AND clock_out_time IS NOT NULL AND clock_in_time > NOW() - INTERVAL '7 days') as avg_hours,
        (SELECT COUNT(*) FROM users WHERE company_id = $1) as total_users,
        (SELECT COUNT(*) FROM locations WHERE company_id = $1) as total_locations
    `, [companyId]);

    const stats = result.rows[0];
    
    this.systemStatsCache = stats;
    this.cacheTimestamps.set(cacheKey, now);

    return stats;
  }

  /**
   * Run consistency check for admin tools
   */
  async runConsistencyCheck(companyId) {
    const issues = [];

    // Check for orphaned shifts
    const orphaned = await this.pool.query(`
      SELECT COUNT(*) as count FROM shifts s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.company_id = $1 AND u.id IS NULL
    `, [companyId]);

    if (parseInt(orphaned.rows[0].count) > 0) {
      issues.push(`Found ${orphaned.rows[0].count} orphaned shifts`);
    }

    // Check for negative hours
    const negativeHours = await this.pool.query(`
      SELECT COUNT(*) as count FROM shifts
      WHERE company_id = $1 AND total_hours < 0
    `, [companyId]);

    if (parseInt(negativeHours.rows[0].count) > 0) {
      issues.push(`Found ${negativeHours.rows[0].count} shifts with negative hours`);
    }

    // Check for excessive hours
    const excessiveHours = await this.pool.query(`
      SELECT COUNT(*) as count FROM shifts
      WHERE company_id = $1 AND total_hours > 24
    `, [companyId]);

    if (parseInt(excessiveHours.rows[0].count) > 0) {
      issues.push(`Found ${excessiveHours.rows[0].count} shifts with excessive hours`);
    }

    // Check for stale active shifts
    const staleShifts = await this.pool.query(`
      SELECT COUNT(*) as count FROM shifts
      WHERE company_id = $1 AND clock_out_time IS NULL 
      AND clock_in_time < NOW() - INTERVAL '24 hours'
    `, [companyId]);

    if (parseInt(staleShifts.rows[0].count) > 0) {
      issues.push(`Found ${staleShifts.rows[0].count} stale active shifts`);
    }

    return {
      issues,
      healthy: issues.length === 0,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Calculate payroll with validation
   */
  async calculatePayroll(companyId, startDate, endDate) {
    const result = await this.pool.query(`
      SELECT 
        s.id,
        s.user_id,
        s.total_hours,
        s.total_break_seconds,
        s.clock_in_time,
        s.clock_out_time,
        u.hourly_rate,
        u.name as user_name
      FROM shifts s
      JOIN users u ON s.user_id = u.id
      WHERE s.company_id = $1 
      AND s.clock_in_time >= $2 
      AND s.clock_out_time <= $3
      AND s.total_hours IS NOT NULL
      AND s.total_hours >= 0
      AND s.total_hours <= 24
      ORDER BY s.user_id, s.clock_in_time
    `, [companyId, startDate, endDate]);

    const shifts = result.rows;
    const payroll = {};

    shifts.forEach(shift => {
      if (!payroll[shift.user_id]) {
        payroll[shift.user_id] = {
          user_id: shift.user_id,
          user_name: shift.user_name,
          hourly_rate: shift.hourly_rate,
          total_hours: 0,
          total_break_seconds: 0,
          total_pay: 0,
          shifts: []
        };
      }

      const userPayroll = payroll[shift.user_id];
      userPayroll.total_hours += shift.total_hours;
      userPayroll.total_break_seconds += shift.total_break_seconds;
      userPayroll.total_pay += shift.total_hours * shift.hourly_rate;
      userPayroll.shifts.push({
        id: shift.id,
        clock_in_time: shift.clock_in_time,
        clock_out_time: shift.clock_out_time,
        total_hours: shift.total_hours,
        total_break_seconds: shift.total_break_seconds
      });
    });

    return Object.values(payroll);
  }

  /**
   * Invalidate cache for specific user
   */
  invalidateUserCache(userId, companyId) {
    const cacheKeys = [
      `${userId}:${companyId}`,
      `active_shifts:${companyId}`,
      `system_stats:${companyId}`
    ];

    cacheKeys.forEach(key => {
      this.activeShiftCache.delete(key);
      this.cacheTimestamps.delete(key);
    });

    if (companyId) {
      this.systemStatsCache = null;
    }
  }

  /**
   * Calculate distance between two GPS coordinates
   */
  calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate total hours for a shift
   */
  calculateTotalHours(clockInTime, clockOutTime, totalBreakSeconds) {
    const workMs = clockOutTime.getTime() - clockInTime.getTime();
    const workHours = workMs / (1000 * 60 * 60);
    const breakHours = totalBreakSeconds / 3600;
    return Math.max(0, workHours - breakHours);
  }

  /**
   * Convert degrees to radians
   */
  toRad(degrees) {
    return degrees * (Math.PI / 180);
  }

  /**
   * Start cleanup interval for expired locks
   */
  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      
      for (const [key, timeout] of this.lockTimeouts.entries()) {
        if (now > timeout) {
          this.locks.delete(key);
          this.lockTimeouts.delete(key);
          console.warn(`Expired lock cleaned up: ${key}`);
        }
      }
    }, 5000); // Check every 5 seconds
  }

  /**
   * Get lock status for debugging
   */
  getLockStatus() {
    return {
      activeLocks: Array.from(this.locks.keys()),
      lockCount: this.locks.size,
      cacheSize: this.activeShiftCache.size,
      systemStatsCached: this.systemStatsCache !== null
    };
  }

  /**
   * Health check for synchronization service
   */
  async healthCheck() {
    try {
      // Test database connectivity
      await this.pool.query('SELECT 1');
      
      // Check lock status
      const lockStatus = this.getLockStatus();
      
      // Check cache status
      const cacheStatus = {
        activeShiftCache: this.activeShiftCache.size,
        systemStatsCache: this.systemStatsCache !== null,
        cacheTimestamps: this.cacheTimestamps.size
      };
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
        locks: lockStatus,
        cache: cacheStatus
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

module.exports = SynchronizationSafe;
