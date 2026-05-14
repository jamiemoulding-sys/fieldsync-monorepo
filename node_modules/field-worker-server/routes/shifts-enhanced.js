/**
 * Enhanced Attendance Routes with State Machine Integration
 * 
 * Demonstrates how to integrate the state machine with existing attendance endpoints
 * while preserving current behavior and adding lightweight protection.
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
const { createStateMachineMiddleware, stateValidation } = require('../middleware/attendanceStateMiddleware');

/**
 * Apply state machine middleware to all attendance routes
 */
router.use(createStateMachineMiddleware());

function pickClockInPayload(body) {
  const keys = ['location_id', 'latitude', 'longitude', 'shift_type', 'verified'];
  const picked = {};
  for (const k of keys) {
    if (body[k] !== undefined) picked[k] = body[k];
  }
  return picked;
}

function clockInValidationFailed(res, zodError) {
  return res.status(400).json({
    error: 'Validation failed',
    issues: zodError.issues
  });
}

function clockOutValidationFailed(res, zodError) {
  return res.status(400).json({
    error: 'Validation failed',
    issues: zodError.issues
  });
}

function breakValidationFailed(res, zodError) {
  return res.status(400).json({
    error: 'Validation failed',
    issues: zodError.issues
  });
}

const logActivity = async (userId, companyId, action, metadata = {}) => {
  try {
    await query(`
      INSERT INTO activity_logs (user_id, company_id, action, metadata)
      VALUES ($1, $2, $3, $4)
    `, [userId, companyId, action, JSON.stringify(metadata)]);
  } catch (err) {
    console.error("❌ Activity log failed:", err.message);
  }
};

//
// =======================
// ✅ CLOCK IN (Enhanced)
// =======================
router.post('/clock-in', authenticateToken, async (req, res) => {
  try {
    // State machine validation
    const validationResult = await stateValidation.validateClockIn(req, res);
    if (!validationResult.valid) {
      return; // Response already sent
    }

    const { state, shift } = validationResult;

    // Continue with existing clock-in logic
    // The existing endpoint already handles all the validation and idempotency
    // We just add state machine context

    const userId = req.user.id;
    const companyId = req.user.companyId;

    if (!companyId) {
      return res.status(403).json({ error: "No company assigned" });
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
      return res.status(403).json({
        error: `Outside allowed location (${Math.round(distance)}m away)`
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
    await logActivity(userId, companyId, 'clock_in', {
      isLate,
      location_id,
      state: AttendanceState.CLOCKED_IN
    });

    // Clear state cache
    req.stateMachine?.clearCache(userId);

    return res.json({
      message: isLate ? 'Clocked in (late)' : 'Clocked in',
      shift: result.rows[0],
      state: AttendanceState.CLOCKED_IN
    });

  } catch (error) {
    console.error('CLOCK IN ERROR:', error);
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
  try {
    // State machine validation
    const validationResult = await stateValidation.validateClockOut(req, res);
    if (!validationResult.valid) {
      return; // Response already sent
    }

    const { state, shift } = validationResult;

    // Continue with existing clock-out logic
    // The existing endpoint already handles all the validation and idempotency
    // We just add state machine context

    const parsed = clockOutRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      return clockOutValidationFailed(res, parsed.error);
    }

    const { clock_out_lat, clock_out_lng } = parsed.data;

    // Build update query with optional GPS fields
    let updateQuery = `
      UPDATE shifts
      SET clock_out_time = NOW()
    `;
    
    const queryParams = [req.user.id, req.user.companyId];
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

    queryParams.push(shift.id);

    const result = await query(updateQuery, queryParams);

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Clock out failed - shift state changed' });
    }

    const completedShift = result.rows[0];

    // 🔥 LOG ACTIVITY
    await logActivity(req.user.id, req.user.companyId, 'clock_out', {
      state: AttendanceState.CLOCKED_OUT
    });

    // Clear state cache
    req.stateMachine?.clearCache(req.user.id);

    return res.json({
      success: true,
      shift: completedShift,
      state: AttendanceState.CLOCKED_OUT
    });

  } catch (err) {
    console.error('CLOCK OUT ERROR:', err);
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
  try {
    // State machine validation
    const validationResult = await stateValidation.validateBreakStart(req, res);
    if (!validationResult.valid) {
      return; // Response already sent
    }

    const { state, shift } = validationResult;

    // Continue with existing break start logic
    // The existing endpoint already handles all the validation and idempotency
    // We just add state machine context

    const parsed = breakStartRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      return breakValidationFailed(res, parsed.error);
    }

    const { shift_id, reason, location } = parsed.data;

    // 🔹 Start break
    const result = await query(`
      UPDATE shifts
      SET break_started_at = NOW()
      WHERE id = $1
      RETURNING *
    `, [shift_id]);

    // 🔥 LOG ACTIVITY
    await logActivity(req.user.id, req.user.companyId, 'break_start', {
      shift_id,
      state: AttendanceState.ON_BREAK
    });

    return res.status(201).json({
      success: true,
      break: {
        id: result.rows[0].id,
        shift_id: result.rows[0].id,
        break_started_at: result.rows[0].break_started_at,
      },
      state: AttendanceState.ON_BREAK
    });

  } catch (error) {
    console.error('BREAK START ERROR:', error);
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
  try {
    // State machine validation
    const validationResult = await stateValidation.validateBreakEnd(req, res);
    if (!validationResult.valid) {
      return; // Response already sent
    }

    const { state, shift } = validationResult;

    // Continue with existing break end logic
    // The existing endpoint already handles all the validation and idempotency
    // We just add state machine context

    const parsed = breakEndRequestSchema.safeParse(req.body);

    if (!parsed.success) {
      return breakValidationFailed(res, parsed.error);
    }

    const { shift_id } = parsed.data;

    // 🔹 Calculate break duration
    const breakDuration = await query(`
      SELECT EXTRACT(EPOCH FROM (NOW() - break_started_at)) as seconds
      FROM shifts
      WHERE id = $1
    `, [shift_id]);

    const breakSeconds = Math.floor(breakDuration.rows[0].seconds);
    const totalBreakSeconds = (shift.total_break_seconds || 0) + breakSeconds;

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
    await logActivity(req.user.id, req.user.companyId, 'break_end', {
      shift_id,
      break_duration_seconds: breakSeconds,
      total_break_seconds: totalBreakSeconds,
      state: AttendanceState.BREAK_ENDED
    });

    return res.json({
      success: true,
      break: {
        id: result.rows[0].id,
        shift_id: result.rows[0].id,
        total_break_seconds: totalBreakSeconds
      },
      state: AttendanceState.BREAK_ENDED
    });

  } catch (error) {
    console.error('BREAK END ERROR:', error);
    return res.status(500).json({
      error: 'Break end failed'
    });
  }
});

module.exports = router;
