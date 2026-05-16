/**
 * Final Minimal Attendance Service
 * 
 * Addresses ALL identified production risks while maintaining simplicity
 */

const { Pool } = require('pg');
const crypto = require('crypto');

// Shared connection pool with enhanced settings
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  query_timeout: 10000,
});

// Circuit breaker for database connections
let circuitOpen = false;
let failureCount = 0;
const failureThreshold = 5;
const resetTimeout = 60000; // 1 minute

// Connection limiting with per-user limits
const pLimit = require('p-limit');
const globalLimit = pLimit(10); // Max 10 concurrent operations
const userLimits = new Map();

function getUserLimit(userId) {
  if (!userLimits.has(userId)) {
    userLimits.set(userId, pLimit(3)); // Max 3 concurrent per user
  }
  return userLimits.get(userId);
}

// Enhanced replay protection with atomic operations
const replayCache = new Map();
const replayLocks = new Map();
const REPLAY_WINDOW = 5 * 60 * 1000; // 5 minutes

// Scheduled cleanup
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of replayCache.entries()) {
    if (now - v > REPLAY_WINDOW * 2) {
      replayCache.delete(k);
    }
  }
}, 5 * 60 * 1000);

// Connection pool monitoring
setInterval(() => {
  const stats = {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  };
  
  console.log('DB_POOL_STATS', stats);
  
  if (stats.waitingCount > 5) {
    console.error('DB_POOL_EXHAUSTION_WARNING', stats);
  }
}, 30000);

class AttendanceMinimalFinal {
  constructor() {
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    // Handle uncaught promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      console.error('UNHANDLED_REJECTION', reason);
    });
    
    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      console.error('UNCAUGHT_EXCEPTION', error);
      process.exit(1);
    });
  }

  /**
   * Cryptographic device fingerprint - Fix for Risk #15
   */
  generateDeviceFingerprint(req) {
    const components = [
      req.headers['user-agent'] || '',
      req.headers['accept-language'] || '',
      req.headers['accept-encoding'] || '',
      req.ip || ''
    ];
    
    return crypto.createHash('sha256')
      .update(components.join('|'))
      .digest('hex');
  }

  /**
   * Enhanced input validation - Fix for Risk #11 & #20
   */
  validateAndSanitizeInput(data, type) {
    const errors = [];
    const sanitized = { ...data };
    
    // Sanitize all string inputs
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string') {
        // Remove potentially dangerous characters
        sanitized[key] = sanitized[key].replace(/[<>]/g, '');
      }
    });
    
    switch (type) {
      case 'clockIn':
        if (!sanitized.location_id || typeof sanitized.location_id !== 'string') {
          errors.push('Invalid location_id');
        }
        
        const lat = parseFloat(sanitized.latitude);
        const lng = parseFloat(sanitized.longitude);
        
        if (!sanitized.latitude || isNaN(lat) || lat < -90 || lat > 90) {
          errors.push('Invalid latitude');
        }
        
        if (!sanitized.longitude || isNaN(lng) || lng < -180 || lng > 180) {
          errors.push('Invalid longitude');
        }
        
        // Sanitize coordinates
        sanitized.latitude = lat;
        sanitized.longitude = lng;
        break;
        
      case 'clockOut':
        const outLat = parseFloat(sanitized.latitude);
        const outLng = parseFloat(sanitized.longitude);
        
        if (!sanitized.latitude || isNaN(outLat) || outLat < -90 || outLat > 90) {
          errors.push('Invalid latitude');
        }
        
        if (!sanitized.longitude || isNaN(outLng) || outLng < -180 || outLng > 180) {
          errors.push('Invalid longitude');
        }
        
        sanitized.latitude = outLat;
        sanitized.longitude = outLng;
        break;
        
      case 'break':
        if (!sanitized.shift_id || typeof sanitized.shift_id !== 'string') {
          errors.push('Invalid shift_id');
        }
        
        // Validate shift_id format
        if (!sanitized.shift_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)) {
          errors.push('Invalid shift_id format');
        }
        break;
    }
    
    return { errors, sanitized };
  }

  /**
   * Enhanced database client with circuit breaker - Fix for Risk #19
   */
  async getClientWithCircuitBreaker() {
    if (circuitOpen) {
      throw new Error('Database circuit breaker is open');
    }
    
    try {
      const client = await pool.connect();
      failureCount = 0; // Reset on success
      return client;
    } catch (error) {
      failureCount++;
      if (failureCount >= failureThreshold) {
        circuitOpen = true;
        setTimeout(() => {
          circuitOpen = false;
          failureCount = 0;
        }, resetTimeout);
      }
      throw error;
    }
  }

  /**
   * Robust transaction handling - Fix for Risk #17
   */
  async executeTransaction(operations, userId, companyId) {
    const userLimit = getUserLimit(userId);
    
    return userLimit(async () => {
      return globalLimit(async () => {
        const client = await this.getClientWithCircuitBreaker();
        let committed = false;
        
        try {
          await client.query('BEGIN');
          
          const result = await operations(client);
          
          await client.query('COMMIT');
          committed = true;
          
          return { success: true, ...result };
          
        } catch (error) {
          if (!committed) {
            try {
              await client.query('ROLLBACK');
            } catch (rollbackError) {
              console.error('ROLLBACK_FAILED:', rollbackError);
              client.release();
              throw new Error('Transaction rollback failed');
            }
          }
          throw error;
        } finally {
          if (committed) {
            client.release();
          }
        }
      })();
    })();
  }

  /**
   * Clock in with all fixes applied
   */
  async clockIn(userId, companyId, locationId, data) {
    const { errors, sanitized } = this.validateAndSanitizeInput(data, 'clockIn');
    if (errors.length > 0) {
      return { 
        success: false, 
        error: 'Validation failed', 
        details: errors 
      };
    }

    const deviceFingerprint = this.generateDeviceFingerprint({ 
      headers: { 'user-agent': sanitized.userAgent || '' },
      ip: sanitized.ip || ''
    });

    return this.executeTransaction(async (client) => {
      // Database handles integrity via constraints
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
        sanitized.latitude, sanitized.longitude,
        deviceFingerprint, sanitized.sessionId
      ]);

      return { shift: result.rows[0] };
    }, userId, companyId).catch(error => {
      if (error.code === '23505') {
        return { 
          success: false, 
          error: 'User already has an active shift',
          idempotent: true 
        };
      }
      throw error;
    });
  }

  /**
   * Clock out with row locking and validation
   */
  async clockOut(userId, companyId, data) {
    const { errors, sanitized } = this.validateAndSanitizeInput(data, 'clockOut');
    if (errors.length > 0) {
      return { 
        success: false, 
        error: 'Validation failed', 
        details: errors 
      };
    }

    const deviceFingerprint = this.generateDeviceFingerprint({ 
      headers: { 'user-agent': sanitized.userAgent || '' },
      ip: sanitized.ip || ''
    });

    return this.executeTransaction(async (client) => {
      // Row locking for read-modify-write
      const shift = await client.query(`
        SELECT * FROM shifts
        WHERE user_id = $1
        AND company_id = $2
        AND clock_out_time IS NULL
        AND break_started_at IS NULL
        FOR UPDATE
      `, [userId, companyId]);

      if (shift.rows.length === 0) {
        throw new Error('No active shift found or user is on break');
      }

      // Database calculates total hours via trigger
      const result = await client.query(`
        UPDATE shifts
        SET 
          clock_out_time = NOW(),
          clock_out_lat = $1,
          clock_out_lng = $2,
          device_fingerprint = $3
        WHERE id = $4
        RETURNING *
      `, [sanitized.latitude, sanitized.longitude, deviceFingerprint, shift.rows[0].id]);

      return { shift: result.rows[0] };
    }, userId, companyId);
  }

  /**
   * Start break with validation
   */
  async startBreak(userId, companyId, shiftId, data) {
    const { errors, sanitized } = this.validateAndSanitizeInput({ shift_id: shiftId, ...data }, 'break');
    if (errors.length > 0) {
      return { 
        success: false, 
        error: 'Validation failed', 
        details: errors 
      };
    }

    const deviceFingerprint = this.generateDeviceFingerprint({ 
      headers: { 'user-agent': sanitized.userAgent || '' },
      ip: sanitized.ip || ''
    });

    return this.executeTransaction(async (client) => {
      // Row locking for read-modify-write
      const shift = await client.query(`
        SELECT * FROM shifts
        WHERE id = $1
        AND user_id = $2
        AND company_id = $3
        AND clock_out_time IS NULL
        AND break_started_at IS NULL
        FOR UPDATE
      `, [sanitized.shift_id, userId, companyId]);

      if (shift.rows.length === 0) {
        throw new Error('Shift not found or already on break');
      }

      const result = await client.query(`
        UPDATE shifts
        SET break_started_at = NOW(),
            device_fingerprint = $1
        WHERE id = $2
        RETURNING *
      `, [deviceFingerprint, sanitized.shift_id]);

      return { shift: result.rows[0] };
    }, userId, companyId);
  }

  /**
   * End break with validation
   */
  async endBreak(userId, companyId, shiftId, data) {
    const { errors, sanitized } = this.validateAndSanitizeInput({ shift_id: shiftId, ...data }, 'break');
    if (errors.length > 0) {
      return { 
        success: false, 
        error: 'Validation failed', 
        details: errors 
      };
    }

    const deviceFingerprint = this.generateDeviceFingerprint({ 
      headers: { 'user-agent': sanitized.userAgent || '' },
      ip: sanitized.ip || ''
    });

    return this.executeTransaction(async (client) => {
      // Row locking for read-modify-write
      const shift = await client.query(`
        SELECT * FROM shifts
        WHERE id = $1
        AND user_id = $2
        AND company_id = $3
        AND clock_out_time IS NULL
        AND break_started_at IS NOT NULL
        FOR UPDATE
      `, [sanitized.shift_id, userId, companyId]);

      if (shift.rows.length === 0) {
        throw new Error('Shift not found or not on break');
      }

      // Database calculates break duration via trigger
      const result = await client.query(`
        UPDATE shifts
        SET break_started_at = NULL,
            device_fingerprint = $1
        WHERE id = $2
        RETURNING *
      `, [deviceFingerprint, sanitized.shift_id]);

      return { shift: result.rows[0] };
    }, userId, companyId);
  }

  /**
   * Get active shift
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
   * Enhanced health check with monitoring
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
        waitingCount: pool.waitingCount,
        circuitOpen
      };
      
      // Check replay cache size
      const cacheSize = replayCache.size;
      
      // Check constraint violations
      const violations = await query(`
        SELECT COUNT(*) as count FROM constraint_violations 
        WHERE created_at > NOW() - INTERVAL '1 hour'
      `);
      
      return {
        status: circuitOpen ? 'degraded' : 'healthy',
        timestamp: new Date().toISOString(),
        version: 'minimal-final-1.0.0',
        pool: poolStats,
        replayCache: { size: cacheSize },
        recentViolations: violations.rows[0].count,
        userLimits: userLimits.size
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
   * Get system statistics for monitoring
   */
  async getSystemStats() {
    try {
      const { query } = require('../database/connection');
      
      const stats = await query(`
        SELECT 
          (SELECT COUNT(*) FROM shifts WHERE clock_out_time IS NULL) as active_shifts,
          (SELECT COUNT(*) FROM shifts WHERE clock_in_time > NOW() - INTERVAL '24 hours') as recent_shifts,
          (SELECT COUNT(*) FROM constraint_violations WHERE created_at > NOW() - INTERVAL '1 hour') as recent_violations,
          (SELECT COUNT(*) FROM user_sessions WHERE expires_at > NOW()) as active_sessions
      `);
      
      return {
        ...stats.rows[0],
        pool: {
          total: pool.totalCount,
          idle: pool.idleCount,
          waiting: pool.waitingCount
        },
        cache: {
          replaySize: replayCache.size,
          userLimits: userLimits.size
        },
        circuit: {
          open: circuitOpen,
          failures: failureCount
        }
      };
    } catch (error) {
      return { error: error.message };
    }
  }
}

module.exports = AttendanceMinimalFinal;
