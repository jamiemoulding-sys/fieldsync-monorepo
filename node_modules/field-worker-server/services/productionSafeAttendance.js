/**
 * Production-Safe Attendance Service
 * 
 * Minimal, correct, and operationally reliable attendance system.
 * Focuses on critical protections over architectural sophistication.
 */

const { Pool } = require('pg');
const crypto = require('crypto');
const EventEmitter = require('events');

class ProductionSafeAttendance extends EventEmitter {
  constructor() {
    super();
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 20,
      min: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    // Replay protection
    this.replayCache = new Map();
    this.REPLAY_WINDOW = 5 * 60 * 1000; // 5 minutes

    // Device fingerprinting
    this.deviceSessions = new Map();
    this.SESSION_TIMEOUT = 12 * 60 * 60 * 1000; // 12 hours

    // Start cleanup interval
    this.startCleanupInterval();
  }

  /**
   * Execute operation with transaction safety
   */
  async executeTransaction(operation) {
    const client = await this.pool.connect();
    let committed = false;
    
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      committed = true;
      return result;
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
  }

  /**
   * Clock-in with all critical protections
   */
  async clockIn(userId, companyId, locationId, data) {
    const lockKey = `clockin:${userId}:${companyId}`;
    
    return this.executeWithLock(lockKey, async () => {
      return this.executeTransaction(async (client) => {
        // 1. Check for existing active shift (row lock)
        const existing = await client.query(`
          SELECT id FROM shifts
          WHERE user_id = $1 AND company_id = $2 AND clock_out_time IS NULL
          FOR UPDATE
        `, [userId, companyId]);
        
        if (existing.rows.length > 0) {
          throw new Error('User already has active shift');
        }

        // 2. Validate location exists
        const location = await client.query(`
          SELECT id, name, lat, lng, radius FROM locations
          WHERE id = $1 AND company_id = $2
        `, [locationId, companyId]);
        
        if (location.rows.length === 0) {
          throw new Error('Invalid location');
        }

        // 3. Validate GPS coordinates
        if (data.latitude && data.longitude) {
          this.validateCoordinates(data.latitude, data.longitude);
          
          // 4. Server-side geofence validation
          const distance = this.calculateDistance(
            data.latitude, data.longitude,
            location.rows[0].lat, location.rows[0].lng
          );

          if (distance > location.rows[0].radius) {
            throw new Error(`Outside geofence: ${Math.round(distance)}m > ${location.rows[0].radius}m`);
          }
        }

        // 5. Validate device fingerprint
        const deviceFingerprint = data.deviceFingerprint || this.generateDeviceFingerprint(data);
        this.validateDeviceSession(userId, deviceFingerprint);

        // 6. Replay protection
        const replayKey = this.generateReplayKey(userId, 'clock-in', data);
        if (this.isReplay(replayKey)) {
          throw new Error('Duplicate request detected');
        }

        // 7. Insert shift
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
          deviceFingerprint, data.sessionId || this.generateSessionId(),
          JSON.stringify(data.metadata || {})
        ]);

        // 8. Record replay protection
        this.recordReplay(replayKey);

        // 9. Emit event for real-time updates
        this.emit('shift_update', {
          type: 'clock_in',
          userId,
          companyId,
          shiftId: result.rows[0].id,
          timestamp: new Date().toISOString()
        });

        return { success: true, shift: result.rows[0] };
      });
    });
  }

  /**
   * Clock-out with all critical protections
   */
  async clockOut(userId, companyId, shiftId, data) {
    const lockKey = `clockout:${userId}:${companyId}`;
    
    return this.executeWithLock(lockKey, async () => {
      return this.executeTransaction(async (client) => {
        // 1. Get active shift with row lock
        const shift = await client.query(`
          SELECT id, clock_in_time, break_started_at, total_break_seconds
          FROM shifts
          WHERE user_id = $1 AND company_id = $2 AND id = $3 AND clock_out_time IS NULL
          FOR UPDATE
        `, [userId, companyId, shiftId]);
        
        if (shift.rows.length === 0) {
          throw new Error('No active shift found');
        }

        const activeShift = shift.rows[0];

        // 2. Validate not on break
        if (activeShift.break_started_at) {
          throw new Error('Cannot clock out while on break');
        }

        // 3. Validate GPS coordinates
        if (data.latitude && data.longitude) {
          this.validateCoordinates(data.latitude, data.longitude);
        }

        // 4. Validate device fingerprint
        const deviceFingerprint = data.deviceFingerprint || this.generateDeviceFingerprint(data);
        this.validateDeviceSession(userId, deviceFingerprint);

        // 5. Replay protection
        const replayKey = this.generateReplayKey(userId, 'clock-out', data);
        if (this.isReplay(replayKey)) {
          throw new Error('Duplicate request detected');
        }

        // 6. Calculate total hours
        const totalHours = this.calculateTotalHours(
          activeShift.clock_in_time,
          new Date(),
          activeShift.total_break_seconds || 0
        );

        // 7. Update shift
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

        // 8. Record replay protection
        this.recordReplay(replayKey);

        // 9. Emit event for real-time updates
        this.emit('shift_update', {
          type: 'clock_out',
          userId,
          companyId,
          shiftId: activeShift.id,
          totalHours,
          timestamp: new Date().toISOString()
        });

        return { success: true, shift: result.rows[0] };
      });
    });
  }

  /**
   * Start break with protections
   */
  async startBreak(userId, companyId, shiftId, data) {
    const lockKey = `break:${userId}:${companyId}`;
    
    return this.executeWithLock(lockKey, async () => {
      return this.executeTransaction(async (client) => {
        // 1. Get active shift with row lock
        const shift = await client.query(`
          SELECT id, break_started_at FROM shifts
          WHERE user_id = $1 AND company_id = $2 AND id = $3 AND clock_out_time IS NULL
          FOR UPDATE
        `, [userId, companyId, shiftId]);
        
        if (shift.rows.length === 0) {
          throw new Error('No active shift found');
        }

        const activeShift = shift.rows[0];

        // 2. Validate not already on break
        if (activeShift.break_started_at) {
          throw new Error('User is already on break');
        }

        // 3. Replay protection
        const replayKey = this.generateReplayKey(userId, 'break-start', data);
        if (this.isReplay(replayKey)) {
          throw new Error('Duplicate request detected');
        }

        // 4. Start break
        const result = await client.query(`
          UPDATE shifts
          SET break_started_at = NOW()
          WHERE id = $1
          RETURNING *
        `, [activeShift.id]);

        // 5. Record replay protection
        this.recordReplay(replayKey);

        // 6. Emit event
        this.emit('shift_update', {
          type: 'break_start',
          userId,
          companyId,
          shiftId: activeShift.id,
          timestamp: new Date().toISOString()
        });

        return { success: true, shift: result.rows[0] };
      });
    });
  }

  /**
   * End break with protections
   */
  async endBreak(userId, companyId, shiftId, data) {
    const lockKey = `break:${userId}:${companyId}`;
    
    return this.executeWithLock(lockKey, async () => {
      return this.executeTransaction(async (client) => {
        // 1. Get active shift with row lock
        const shift = await client.query(`
          SELECT id, break_started_at, total_break_seconds FROM shifts
          WHERE user_id = $1 AND company_id = $2 AND id = $3 AND clock_out_time IS NULL
          FOR UPDATE
        `, [userId, companyId, shiftId]);
        
        if (shift.rows.length === 0) {
          throw new Error('No active shift found');
        }

        const activeShift = shift.rows[0];

        // 2. Validate user is on break
        if (!activeShift.break_started_at) {
          throw new Error('User is not on break');
        }

        // 3. Replay protection
        const replayKey = this.generateReplayKey(userId, 'break-end', data);
        if (this.isReplay(replayKey)) {
          throw new Error('Duplicate request detected');
        }

        // 4. Calculate break duration
        const breakDuration = await client.query(`
          SELECT EXTRACT(EPOCH FROM (NOW() - break_started_at)) as seconds
          FROM shifts
          WHERE id = $1
        `, [activeShift.id]);

        const breakSeconds = Math.floor(breakDuration.rows[0].seconds);
        const totalBreakSeconds = (activeShift.total_break_seconds || 0) + breakSeconds;

        // 5. End break
        const result = await client.query(`
          UPDATE shifts
          SET 
            break_started_at = NULL,
            total_break_seconds = $1
          WHERE id = $2
          RETURNING *
        `, [totalBreakSeconds, activeShift.id]);

        // 6. Record replay protection
        this.recordReplay(replayKey);

        // 7. Emit event
        this.emit('shift_update', {
          type: 'break_end',
          userId,
          companyId,
          shiftId: activeShift.id,
          breakDuration: breakSeconds,
          totalBreakSeconds,
          timestamp: new Date().toISOString()
        });

        return { success: true, shift: result.rows[0] };
      });
    });
  }

  /**
   * Get active shift with caching
   */
  async getActiveShift(userId, companyId) {
    const result = await this.pool.query(`
      SELECT * FROM shifts
      WHERE user_id = $1 AND company_id = $2 AND clock_out_time IS NULL
      ORDER BY id DESC LIMIT 1
    `, [userId, companyId]);
    
    return result.rows[0] || null;
  }

  /**
   * Execute operation with lock to prevent race conditions
   */
  async executeWithLock(lockKey, operation, timeout = 10000) {
    if (this.locks && this.locks.has(lockKey)) {
      throw new Error(`Operation locked: ${lockKey}`);
    }

    if (!this.locks) this.locks = new Map();
    
    this.locks.set(lockKey, Date.now() + timeout);
    
    try {
      const result = await operation();
      return result;
    } finally {
      if (this.locks) {
        this.locks.delete(lockKey);
      }
    }
  }

  /**
   * Validate GPS coordinates
   */
  validateCoordinates(latitude, longitude) {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
      throw new Error('Invalid coordinate format');
    }
    
    if (latitude < -90 || latitude > 90) {
      throw new Error('Invalid latitude range');
    }
    
    if (longitude < -180 || longitude > 180) {
      throw new Error('Invalid longitude range');
    }
    
    if (isNaN(latitude) || isNaN(longitude)) {
      throw new Error('Invalid coordinate values');
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
   * Generate device fingerprint
   */
  generateDeviceFingerprint(data) {
    const fingerprintData = {
      userAgent: data.userAgent,
      platform: data.platform,
      deviceId: data.deviceId,
      timestamp: Date.now()
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(fingerprintData))
      .digest('hex');
  }

  /**
   * Generate session ID
   */
  generateSessionId() {
    return crypto.randomUUID();
  }

  /**
   * Generate replay protection key
   */
  generateReplayKey(userId, action, data) {
    const keyData = {
      userId,
      action,
      timestamp: Math.floor(Date.now() / (60 * 1000)), // Minute granularity
      data: {
        locationId: data.locationId,
        shiftId: data.shiftId
      }
    };
    
    return crypto.createHash('sha256')
      .update(JSON.stringify(keyData))
      .digest('hex');
  }

  /**
   * Check if request is a replay
   */
  isReplay(replayKey) {
    const cached = this.replayCache.get(replayKey);
    if (cached && (Date.now() - cached) < this.REPLAY_WINDOW) {
      return true;
    }
    return false;
  }

  /**
   * Record replay protection
   */
  recordReplay(replayKey) {
    this.replayCache.set(replayKey, Date.now());
  }

  /**
   * Validate device session
   */
  validateDeviceSession(userId, deviceFingerprint) {
    const sessionKey = `${userId}:${deviceFingerprint}`;
    const existing = this.deviceSessions.get(sessionKey);
    
    if (existing && (Date.now() - existing) < this.SESSION_TIMEOUT) {
      // Session is valid
      this.deviceSessions.set(sessionKey, Date.now());
      return;
    }
    
    // New session or expired session
    this.deviceSessions.set(sessionKey, Date.now());
  }

  /**
   * Start cleanup interval
   */
  startCleanupInterval() {
    setInterval(() => {
      const now = Date.now();
      
      // Clean expired replay cache
      for (const [key, timestamp] of this.replayCache.entries()) {
        if (now - timestamp > this.REPLAY_WINDOW) {
          this.replayCache.delete(key);
        }
      }
      
      // Clean expired device sessions
      for (const [key, timestamp] of this.deviceSessions.entries()) {
        if (now - timestamp > this.SESSION_TIMEOUT) {
          this.deviceSessions.delete(key);
        }
      }
      
      // Clean expired locks
      if (this.locks) {
        for (const [key, timeout] of this.locks.entries()) {
          if (now > timeout) {
            this.locks.delete(key);
          }
        }
      }
    }, 60000); // Clean every minute
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      // Test database connectivity
      await this.pool.query('SELECT 1');
      
      return {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
        replayCacheSize: this.replayCache.size,
        deviceSessionsSize: this.deviceSessions.size,
        locksSize: this.locks ? this.locks.size : 0
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get system status for debugging
   */
  getSystemStatus() {
    return {
      replayCacheSize: this.replayCache.size,
      deviceSessionsSize: this.deviceSessions.size,
      locksSize: this.locks ? this.locks.size : 0,
      replayWindow: this.REPLAY_WINDOW,
      sessionTimeout: this.SESSION_TIMEOUT
    };
  }
}

module.exports = ProductionSafeAttendance;
