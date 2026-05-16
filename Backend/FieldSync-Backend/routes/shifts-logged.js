/**
 * Enhanced Attendance Routes with Comprehensive Logging
 * 
 * Integrates production-safe attendance logging with existing attendance endpoints
 * to provide observability for lifecycle transitions, replay detection,
 * duplicate actions, and invalid state attempts.
 */

const express = require('express');
const router = express.Router();
const { query } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');
const { getDistanceInMeters } = require('../utils/distance');
const { 
  clockInRequestSchema,
  clockOutRequestSchema,
  breakStartRequestSchema,
  breakEndRequestSchema
} = require('@fieldsync/shared');
const { createAttendanceLoggingMiddleware, loggingHelpers } = require('../middleware/attendanceLoggingMiddleware');

/**
 * Apply logging middleware to all attendance routes
 */
router.use(createAttendanceLoggingMiddleware());

function pickClockInPayload(body) {
  const keys = ['location_id', 'latitude', 'longitude', 'shift_type', 'verified'];
  const picked = {};
  for (const k of keys) {
    if (body[k] !== undefined) picked[k] = body[k];
  }
  return picked;
}

function clockInValidationFailed(res, zodError) {
  loggingHelpers.loggedResponse(res, {
    error: 'Validation failed',
    issues: zodError.issues
  }, LogLevel.ERROR);
}

function clockOutValidationFailed(res, zodError) {
  loggingHelpers.loggedResponse(res, {
    error: 'Validation failed',
    issues: zodError.issues
  }, LogLevel.ERROR);
}

function breakValidationFailed(res, zodError) {
  loggingHelpers.loggedResponse(res, {
    error: 'Validation failed',
    issues: zodError.issues
  }, LogLevel.ERROR);
}

//
// =======================
// ✅ CLOCK IN (Enhanced)
// =======================
router.post('/clock-in', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;

    if (!companyId) {
      return loggingHelpers.loggedResponse(res, {
        error: "No company assigned"
      }, LogLevel.ERROR);
    }

    const parsed = clockInRequestSchema.safeParse(
      pickClockInPayload(req.body)
    );

    if (!parsed.success) {
      return clockInValidationFailed(res, parsed.error);
    }

    const { location_id, latitude, longitude } = parsed.data;

    // 🔹 Validate location
    const locationRes = await query(
      'SELECT * FROM locations WHERE id = $1 AND company_id = $2',
      [location_id, companyId]
    );

    const location = locationRes.rows[0];

    if (!location) {
      loggingHelpers.logInvalidState(req, 'NO_SHIFT', 'CLOCKED_IN', 'Location not found');
      return res.status(404).json({ error: 'Location not found' });
    }

    // 🔹 Distance check
    const distance = getDistanceInMeters(
      latitude,
      longitude,
      location.latitude,
      location.longitude
    );

    if (distance > (location.radius || 100)) {
      loggingHelpers.logInvalidState(req, 'NO_SHIFT', 'CLOCKED_IN', 'Outside geofence');
      return res.status(403).json({
        error: `Outside allowed location (${Math.round(distance)}m away)`
      });
    }

    // 🔹 Prevent duplicate shift with idempotency
    const existing = await query(`
      SELECT id, clock_in_time, latitude, longitude, location_id 
      FROM shifts
      WHERE user_id = $1
      AND company_id = $2
      AND clock_out_time IS NULL
      FOR UPDATE
    `, [userId, companyId]);

    if (existing.rows.length > 0) {
      const activeShift = existing.rows[0];
      
      // Check for stale shift (older than 24 hours)
      const clockInTime = new Date(activeShift.clock_in_time);
      const staleThreshold = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const isStaleShift = clockInTime < staleThreshold;
      
      if (isStaleShift) {
        loggingHelpers.logInvalidState(req, 'STALE_SHIFT', 'CLOCKED_IN', 'Stale shift detected');
        return res.status(403).json({ 
          error: 'Stale shift detected. Please contact manager.' 
        });
      }
      
      // Log duplicate detection
      loggingHelpers.logDuplicate(req, 'clock_in_attempt', activeShift.id, {
        type: 'state_based',
        window: 0, // State-based detection has no time window
        existingState: 'CLOCKED_IN',
        attemptedState: 'CLOCKED_IN'
      });

      // Return existing shift state for idempotency
      loggingHelpers.loggedResponse(res, {
        message: activeShift.is_late ? 'Already clocked in (late)' : 'Already clocked in',
        shift: activeShift,
        idempotent: true
      });
    }

    // 🔹 Check schedule
    const today = new Date().toISOString().split('T')[0];

    const scheduleRes = await query(`
      SELECT * FROM schedules
      WHERE user_id = $1
      AND company_id = $2
      AND date = $3
      LIMIT 1
    `, [userId, companyId, today]);

    const schedule = scheduleRes.rows[0];
    const now = new Date();

    const isLate = schedule && new Date(schedule.start_time) < now;

    // 🔹 Insert shift
    const result = await query(`
      INSERT INTO shifts (
        user_id,
        location_id,
        latitude,
        longitude,
        clock_in_time,
        is_late,
        company_id
      )
      VALUES ($1, $2, $3, $4, NOW(), $5, $6)
      RETURNING *
    `, [userId, location_id, latitude, longitude, isLate, companyId]);

    // 🔥 LOG ACTIVITY
    loggingHelpers.logLifecycle(req, 'clock_in_completed', result.rows[0].id, {
      isLate,
      location_id,
      scheduleId: schedule?.id,
      geofenceCompliance: distance <= (location.radius || 100)
    });

    // Log performance metrics
    loggingHelpers.logPerformance(req, 'clock_in', {
      duration: Date.now() - startTime,
      databaseQueries: 3, // location, schedule, existing check, insert
      validationSteps: ['location', 'geofence', 'duplicate_check', 'schedule']
    });

    // Clear state cache
    req.attendanceLogger?.clearCache(userId);

    return loggingHelpers.loggedResponse(res, {
      message: isLate ? 'Clocked in (late)' : 'Clocked in',
      shift: result.rows[0]
    });

  } catch (error) {
    loggingHelpers.logSecurity(req, 'server_error', {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      error: "REAL_ERROR",
      message: error.message
    });
  }
});

//
// =======================
// ✅ CLOCK OUT (Enhanced)
// =======================
router.post('/clock-out', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;

    const parsed = clockOutRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      return clockOutValidationFailed(res, parsed.error);
    }

    const { clock_out_lat, clock_out_lng } = parsed.data;

    // Check for existing shift first
    const existingShift = await query(`
      SELECT * FROM shifts
      WHERE user_id = $1
      AND company_id = $2
      AND clock_out_time IS NULL
      FOR UPDATE
    `, [userId, companyId]);

    if (existingShift.rows.length === 0) {
      loggingHelpers.logInvalidState(req, 'NO_SHIFT', 'CLOCKED_OUT', 'No active shift found');
      return res.status(400).json({ error: 'No active shift found' });
    }

    const activeShift = existingShift.rows[0];
    
    // Check if already clocked out (idempotent)
    if (activeShift.clock_out_time) {
      loggingHelpers.logDuplicate(req, 'clock_out_attempt', activeShift.id, {
        type: 'state_based',
        window: 0,
        existingState: 'CLOCKED_OUT',
        attemptedState: 'CLOCKED_OUT'
      });

      return loggingHelpers.loggedResponse(res, {
        success: true,
        shift: activeShift,
        idempotent: true
      });
    }

    // 🔹 Prevent clock-out during active break
    if (activeShift.break_started_at) {
      loggingHelpers.logInvalidState(req, 'ON_BREAK', 'CLOCKED_OUT', 'Clock out during break');
      return res.status(403).json({ 
        error: 'Cannot clock out while on break. Please end break first.' 
      });
    }

    // Build update query with optional GPS fields
    let updateQuery = `
      UPDATE shifts
      SET clock_out_time = NOW()
    `;
    
    const queryParams = [userId, companyId];
    let paramIndex = 3;

    // Add GPS coordinates if provided
    if (clock_out_lat !== undefined && clock_out_lng !== undefined) {
      updateQuery += `,
        clock_out_lat = $${paramIndex},
        clock_out_lng = $${paramIndex + 1}
      `;
      queryParams.push(clock_out_lat, clock_out_lng);
      paramIndex += 2;
    }

    updateQuery += `
      WHERE user_id = $1
      AND company_id = $2
      AND clock_out_time IS NULL
      AND id = $3
      RETURNING *
    `;

    queryParams.push(activeShift.id);
    const result = await query(updateQuery, queryParams);

    if (result.rows.length === 0) {
      loggingHelpers.logSecurity(req, 'data_corruption', {
        operation: 'clock_out_update',
        expectedRows: 1,
        actualRows: result.rows.length,
        shiftId: activeShift.id
      });
      
      return res.status(500).json({ error: 'Clock out failed - shift state changed' });
    }

    const completedShift = result.rows[0];

    // 🔥 LOG ACTIVITY
    loggingHelpers.logLifecycle(req, 'clock_out_completed', completedShift.id, {
      hasGPS: !!(clock_out_lat === undefined || clock_out_lng === undefined),
      gpsCoordinates: clock_out_lat && clock_out_lng ? { lat: clock_out_lat, lng: clock_out_lng } : null
    });

    // Log performance metrics
    loggingHelpers.logPerformance(req, 'clock_out', {
      duration: Date.now() - startTime,
      databaseQueries: 2, // existing check, update
      validationSteps: ['existing_check', 'break_check', 'gps_validation']
    });

    // Clear state cache
    req.attendanceLogger?.clearCache(userId);

    return loggingHelpers.loggedResponse(res, {
      success: true,
      shift: completedShift
    });

  } catch (error) {
    loggingHelpers.logSecurity(req, 'server_error', {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      error: 'Clock out failed'
    });
  }
});

//
// =======================
// ⏸️ START BREAK (Enhanced)
// =======================
router.post('/break/start', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;

    const parsed = breakStartRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      return breakValidationFailed(res, parsed.error);
    }

    const { shift_id, reason, location } = parsed.data;

    // 🔹 Validate active shift with row locking
    const shiftRes = await query(`
      SELECT * FROM shifts
      WHERE id = $1
      AND user_id = $2
      AND company_id = $3
      AND clock_out_time IS NULL
      FOR UPDATE
    `, [shift_id, userId, companyId]);

    const activeShift = shiftRes.rows[0];
    if (!activeShift) {
      loggingHelpers.logInvalidState(req, 'NO_SHIFT', 'ON_BREAK', 'Active shift not found');
      return res.status(404).json({ error: 'Active shift not found' });
    }

    // 🔹 Prevent duplicate breaks with idempotency
    if (activeShift.break_started_at) {
      loggingHelpers.logDuplicate(req, 'break_start_attempt', activeShift.id, {
        type: 'state_based',
        window: 0,
        existingState: 'ON_BREAK',
        attemptedState: 'ON_BREAK'
      });

      return loggingHelpers.loggedResponse(res, {
        success: true,
        break: {
          id: activeShift.id,
          shift_id: activeShift.id,
          break_started_at: activeShift.break_started_at,
        },
        idempotent: true
      });
    }

    // 🔹 Start break
    const result = await query(`
      UPDATE shifts
      SET break_started_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [shift_id]);

    // 🔥 LOG ACTIVITY
    loggingHelpers.logLifecycle(req, 'break_start_completed', result.rows[0].id, {
      reason,
      hasLocation: !!location
    });

    // Log performance metrics
    loggingHelpers.logPerformance(req, 'break_start', {
      duration: Date.now() - startTime,
      databaseQueries: 2, // shift check, update
      validationSteps: ['shift_validation', 'duplicate_check']
    });

    return loggingHelpers.loggedResponse(res, {
      success: true,
      break: {
        id: result.rows[0].id,
        shift_id: result.rows[0].id,
        break_started_at: result.rows[0].break_started_at,
      }
    }, LogLevel.INFO); // Use INFO level for successful operations

  } catch (error) {
    loggingHelpers.logSecurity(req, 'server_error', {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      error: 'Break start failed'
    });
  }
});

//
// =======================
// ▶️ END BREAK (Enhanced)
// =======================
router.post('/break/end', authenticateToken, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;

    const parsed = breakEndRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      return breakValidationFailed(res, parsed.error);
    }

    const { shift_id } = parsed.data;

    // 🔹 Validate active shift with row locking
    const shiftRes = await query(`
      SELECT * FROM shifts
      WHERE id = $1
      AND user_id = $2
      AND company_id = $3
      AND clock_out_time IS NULL
      FOR UPDATE
    `, [shift_id, userId, companyId]);

    const activeShift = shiftRes.rows[0];
    if (!activeShift) {
      loggingHelpers.logInvalidState(req, 'NO_SHIFT', 'BREAK_ENDED', 'Active shift not found');
      return res.status(404).json({ error: 'Active shift not found' });
    }

    // 🔹 Validate active break with idempotency
    if (!activeShift.break_started_at) {
      loggingHelpers.logDuplicate(req, 'break_end_attempt', activeShift.id, {
        type: 'state_based',
        window: 0,
        existingState: 'BREAK_ENDED',
        attemptedState: 'BREAK_ENDED'
      });

      return loggingHelpers.loggedResponse(res, {
        success: true,
        break: {
          id: activeShift.id,
          shift_id: activeShift.id,
          total_break_seconds: activeShift.total_break_seconds,
        },
        idempotent: true
      });
    }

    // 🔹 Calculate break duration
    const breakDuration = await query(`
      SELECT EXTRACT(EPOCH FROM (NOW() - break_started_at)) as seconds
      FROM shifts
      WHERE id = $1
    `, [shift_id]);

    const breakSeconds = Math.floor(breakDuration.rows[0].seconds);
    const totalBreakSeconds = (activeShift.total_break_seconds || 0) + breakSeconds;

    // 🔹 End break
    const result = await query(`
      UPDATE shifts
      SET 
        break_started_at = NULL,
        total_break_seconds = $1
      WHERE id = $2
      RETURNING *
    `, [totalBreakSeconds, shift_id]);

    // 🔥 LOG ACTIVITY
    loggingHelpers.logLifecycle(req, 'break_end_completed', result.rows[0].id, {
      breakDuration: breakSeconds,
      totalBreakSeconds: totalBreakSeconds,
      accurateDuration: breakSeconds > 0 // Was actually on break
    });

    // Log performance metrics
    loggingHelpers.logPerformance(req, 'break_end', {
      duration: Date.now() - startTime,
      databaseQueries: 3, // shift check, duration calc, update
      validationSteps: ['shift_validation', 'break_validation', 'duration_calculation']
    });

    return loggingHelpers.loggedResponse(res, {
      success: true,
      break: {
        id: result.rows[0].id,
        shift_id: result.rows[0].id,
        break_started_at: result.rows[0].break_started_at,
        total_break_seconds: totalBreakSeconds
      }
    });

  } catch (error) {
    loggingHelpers.logSecurity(req, 'server_error', {
      error: error.message,
      stack: error.stack
    });
    
    return res.status(500).json({
      error: 'Break end failed'
    });
  }
});

module.exports = router;
