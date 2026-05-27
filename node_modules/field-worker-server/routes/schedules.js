const express = require('express');
const router = express.Router();

const {
  authenticateToken,
  requireRole,
  requireCompany
} = require('../middleware/auth');

const { query } = require('../database/connection');
const logger = require('../utils/logger');
const { 
  scheduleCreationSchema,
  leaveRequestCreateSchema 
} = require('@fieldsync/shared');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getCompanyId(req) {
  return req.user?.company_id || req.user?.companyId;
}

function routeMeta(req, routeName, status = undefined) {
  return {
    endpoint: `${req.method} ${req.baseUrl}${req.route?.path || ''}`,
    routeName,
    companyId: getCompanyId(req),
    userId: req.user?.id,
    status,
  };
}

function logRouteStart(req, routeName) {
  logger.info('Schedule route request', routeMeta(req, routeName, 'started'));
}

function logRouteFailure(req, routeName, error) {
  logger.error(`${routeName} failed`, error);
  logger.warn('Schedule route failed', routeMeta(req, routeName, 500));
}

function normalizeScheduleLocationId(locationId, req, routeName) {
  if (!locationId) return null;

  const value = String(locationId).trim();
  if (UUID_RE.test(value)) return value;

  logger.warn('Ignoring incompatible schedule location_id', {
    ...routeMeta(req, routeName),
    reason: 'schedules.location_id is uuid but locations.id is integer',
  });

  return null;
}

function pickScheduleCreatePayload(body) {
  const allowed = [
    'user_id',
    'date',
    'start_time',
    'end_time',
    'company_id',
    'location_id'
  ];
  const picked = {};
  for (const key of allowed) {
    if (body[key] !== undefined) picked[key] = body[key];
  }
  return picked;
}

function validationFailed(res, zodError, bulkIndex = null) {
  const payload = {
    error: 'Validation failed',
    issues: zodError.issues
  };
  if (bulkIndex !== null) payload.bulkIndex = bulkIndex;
  return res.status(400).json(payload);
}

function leaveValidationFailed(res, zodError) {
  return res.status(400).json({
    error: 'Validation failed',
    issues: zodError.issues
  });
}

function pickLeaveCreatePayload(body) {
  const picked = {};
  for (const key of ['start_date', 'end_date', 'user_id']) {
    if (body[key] !== undefined) picked[key] = body[key];
  }
  return picked;
}

//
// =======================
// 📅 GET ALL SCHEDULES
// =======================
router.get('/',
  authenticateToken,
  requireCompany,
  async (req, res) => {
    const routeName = 'schedules.list';
    logRouteStart(req, routeName);

    try {
      const companyId = getCompanyId(req);
      const result = await query(`
        SELECT s.*, u.name
        FROM schedules s
        JOIN users u ON u.id = s.user_id
        WHERE u.company_id = $1
        ORDER BY s.date DESC
      `, [companyId]);

      res.json(result.rows);

    } catch (error) {
      logRouteFailure(req, routeName, error);
      res.status(500).json({ error: 'Failed to fetch schedules' });
    }
  }
);

//
// =======================
// 👤 MY SCHEDULE
// =======================
router.get('/my-schedule',
  authenticateToken,
  requireCompany,
  async (req, res) => {
    const routeName = 'schedules.mySchedule';
    logRouteStart(req, routeName);

    try {
      const companyId = getCompanyId(req);
      const params = [req.user.id, companyId];
      const filters = [];
      const limit = Math.min(Number(req.query.limit) || 100, 200);

      if (req.query.from) {
        params.push(req.query.from);
        filters.push(`s.start_time >= $${params.length}`);
      }

      if (req.query.to) {
        params.push(req.query.to);
        filters.push(`s.start_time < $${params.length}`);
      }

      params.push(limit);

      const result = await query(`
        SELECT
          s.*,
          NULL::json AS locations
        FROM schedules s
        WHERE s.user_id = $1
        AND s.company_id = $2
        ${filters.length ? `AND ${filters.join(' AND ')}` : ''}
        ORDER BY s.start_time ASC, s.date ASC
        LIMIT $${params.length}
      `, params);

      res.json(result.rows);

    } catch (error) {
      logRouteFailure(req, routeName, error);
      res.status(500).json({ error: 'Failed to fetch schedule' });
    }
  }
);

//
// =======================
// ➕ CREATE SCHEDULE
// =======================
router.post('/',
  authenticateToken,
  requireCompany,
  requireRole('admin', 'manager'),
  async (req, res) => {
    const routeName = 'schedules.create';
    logRouteStart(req, routeName);

    try {
      const companyId = getCompanyId(req);
      const parsed = scheduleCreationSchema.safeParse(
        pickScheduleCreatePayload(req.body)
      );

      if (!parsed.success) {
        return validationFailed(res, parsed.error);
      }

      const { user_id, date, start_time, end_time, location_id } = parsed.data;
      const scheduleLocationId = normalizeScheduleLocationId(location_id, req, routeName);

      // 🔒 validate user belongs to company
      const userCheck = await query(
        `SELECT id FROM users WHERE id = $1 AND company_id = $2`,
        [user_id, companyId]
      );

      if (userCheck.rows.length === 0) {
        return res.status(403).json({
          error: 'Invalid user for this company'
        });
      }

      // 🚨 PREVENT DUPLICATE SHIFTS
      const existing = await query(
        `SELECT id FROM schedules
         WHERE user_id = $1 AND date = $2 AND company_id = $3`,
        [user_id, date, companyId]
      );

      if (existing.rows.length > 0) {
        return res.status(400).json({
          error: 'User already has a shift that day'
        });
      }

      const result = await query(`
        INSERT INTO schedules (user_id, date, start_time, end_time, company_id, location_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [user_id, date, start_time, end_time, companyId, scheduleLocationId]);

      // 🧠 ACTIVITY LOG
      await query(
        `INSERT INTO activity_logs (company_id, user_id, action)
         VALUES ($1, $2, $3)`,
        [
          companyId,
          req.user.id,
          `Created shift for user ${user_id} on ${date}`
        ]
      );

      res.status(201).json(result.rows[0]);

    } catch (error) {
      logRouteFailure(req, routeName, error);
      res.status(500).json({ error: 'Create failed' });
    }
  }
);

//
// =======================
// 🚀 BULK CREATE (THIS FIXES YOUR MAIN PAIN)
// =======================
router.post('/bulk',
  authenticateToken,
  requireCompany,
  requireRole('admin', 'manager'),
  async (req, res) => {
    const routeName = 'schedules.bulkCreate';
    logRouteStart(req, routeName);

    try {
      const companyId = getCompanyId(req);
      const { shifts } = req.body;

      if (!Array.isArray(shifts) || shifts.length === 0) {
        return res.status(400).json({
          error: 'Shifts array required'
        });
      }

      const created = [];

      for (let i = 0; i < shifts.length; i++) {
        const s = shifts[i];

        // skip invalid (preserves prior silent-skip behavior)
        if (!s.user_id || !s.date) continue;

        const parsed = scheduleCreationSchema.safeParse(
          pickScheduleCreatePayload(s)
        );

        if (!parsed.success) {
          return validationFailed(res, parsed.error, i);
        }

        const { user_id, date, start_time, end_time, location_id } = parsed.data;
        const scheduleLocationId = normalizeScheduleLocationId(location_id, req, routeName);

        // prevent duplicates
        const exists = await query(
          `SELECT id FROM schedules WHERE user_id=$1 AND date=$2 AND company_id=$3`,
          [user_id, date, companyId]
        );

        if (exists.rows.length > 0) continue;

        const userCheck = await query(
          `SELECT id FROM users WHERE id = $1 AND company_id = $2`,
          [user_id, companyId]
        );

        if (userCheck.rows.length === 0) continue;

        const result = await query(
          `INSERT INTO schedules
           (user_id, date, start_time, end_time, company_id, location_id)
           VALUES ($1,$2,$3,$4,$5,$6)
           RETURNING *`,
          [
            user_id,
            date,
            start_time,
            end_time,
            companyId,
            scheduleLocationId
          ]
        );

        created.push(result.rows[0]);
      }

      res.json({
        created: created.length,
        data: created
      });

    } catch (error) {
      logRouteFailure(req, routeName, error);
      res.status(500).json({ error: 'Bulk insert failed' });
    }
  }
);

//
// =======================
// ✏️ UPDATE
// =======================
router.put('/:id',
  authenticateToken,
  requireCompany,
  requireRole('admin', 'manager'),
  async (req, res) => {
    const routeName = 'schedules.update';
    logRouteStart(req, routeName);

    try {
      const companyId = getCompanyId(req);
      const { user_id, date, start_time, end_time, location_id } = req.body;
      const scheduleLocationId = normalizeScheduleLocationId(location_id, req, routeName);

      if (user_id) {
        const userCheck = await query(
          `SELECT id FROM users WHERE id = $1 AND company_id = $2`,
          [user_id, companyId]
        );

        if (userCheck.rows.length === 0) {
          return res.status(403).json({
            error: 'Invalid user for this company'
          });
        }
      }

      const result = await query(`
        UPDATE schedules
        SET user_id = COALESCE($1, user_id),
            date = COALESCE($2, date),
            start_time = COALESCE($3, start_time),
            end_time = COALESCE($4, end_time),
            location_id = COALESCE($5, location_id)
        WHERE id = $6
        AND company_id = $7
        RETURNING *
      `, [
        user_id,
        date,
        start_time,
        end_time,
        scheduleLocationId,
        req.params.id,
        companyId
      ]);

      if (!result.rows[0]) {
        return res.status(404).json({
          error: 'Schedule not found'
        });
      }

      res.json(result.rows[0]);

    } catch (error) {
      logRouteFailure(req, routeName, error);
      res.status(500).json({ error: 'Update failed' });
    }
  }
);

//
// =======================
// ❌ DELETE
// =======================
router.delete('/:id',
  authenticateToken,
  requireCompany,
  requireRole('admin'),
  async (req, res) => {
    const routeName = 'schedules.delete';
    logRouteStart(req, routeName);

    try {
      const companyId = getCompanyId(req);
      const result = await query(
        `DELETE FROM schedules
         WHERE id = $1 AND company_id = $2
         RETURNING id`,
        [req.params.id, companyId]
      );

      if (!result.rows[0]) {
        return res.status(404).json({
          error: 'Schedule not found'
        });
      }

      res.json({ message: 'Deleted' });

    } catch (error) {
      logRouteFailure(req, routeName, error);
      res.status(500).json({ error: 'Delete failed' });
    }
  }
);

//
// =======================
// 🚨 LATE ARRIVALS (FIXED)
// =======================
router.get('/late-arrivals',
  authenticateToken,
  requireCompany,
  async (req, res) => {
    const routeName = 'schedules.lateArrivals';
    logRouteStart(req, routeName);

    try {
      const companyId = getCompanyId(req);
      const result = await query(`
        SELECT u.name, s.date, s.start_time, sh.clock_in_time
        FROM schedules s
        JOIN users u ON u.id = s.user_id
        LEFT JOIN shifts sh 
          ON sh.user_id = s.user_id
          AND DATE(sh.clock_in_time) = s.date
        WHERE u.company_id = $1
        AND sh.clock_in_time IS NOT NULL
        AND sh.clock_in_time > s.start_time
      `, [companyId]);

      res.json(result.rows);

    } catch (error) {
      logRouteFailure(req, routeName, error);
      res.status(500).json({ error: 'Late arrivals failed' });
    }
  }
);

//
// =======================
// 📅 HOLIDAY REQUESTS (FIXED)
// =======================

// CREATE
router.post('/holiday-requests',
  authenticateToken,
  requireCompany,
  async (req, res) => {
    const routeName = 'holidays.create';
    logRouteStart(req, routeName);

    try {
      const companyId = getCompanyId(req);
      const parsed = leaveRequestCreateSchema.safeParse(
        pickLeaveCreatePayload(req.body)
      );

      if (!parsed.success) {
        return leaveValidationFailed(res, parsed.error);
      }

      const { start_date, end_date, user_id } = parsed.data;
      const requestedStatus = req.body.status;

      const canManage = req.user.role === 'manager' || req.user.role === 'admin';
      const targetUserId = canManage && user_id ? user_id : req.user.id;
      const status = canManage && ['pending', 'approved', 'rejected'].includes(requestedStatus)
        ? requestedStatus
        : 'pending';

      const userCheck = await query(
        `SELECT id FROM users WHERE id = $1 AND company_id = $2`,
        [targetUserId, companyId]
      );

      if (userCheck.rows.length === 0) {
        return res.status(403).json({
          error: 'Invalid user for this company'
        });
      }

      const result = await query(`
        INSERT INTO holidays 
        (user_id, start_date, end_date, status, company_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [targetUserId, start_date, end_date, status, companyId]);

      res.status(201).json(result.rows[0]);

    } catch (error) {
      logRouteFailure(req, routeName, error);
      res.status(500).json({ error: 'Create failed' });
    }
  }
);

// GET ALL
router.get('/holiday-requests',
  authenticateToken,
  requireCompany,
  async (req, res) => {
    const routeName = 'holidays.list';
    logRouteStart(req, routeName);

    try {
      const companyId = getCompanyId(req);
      const result = await query(`
        SELECT h.*, u.name
        FROM holidays h
        JOIN users u ON u.id = h.user_id
        WHERE h.company_id = $1
        ORDER BY h.start_date DESC
      `, [companyId]);

      res.json(result.rows);

    } catch (error) {
      logRouteFailure(req, routeName, error);
      res.status(500).json({ error: 'Fetch failed' });
    }
  }
);

// UPDATE STATUS
router.put('/holiday-requests/:id',
  authenticateToken,
  requireCompany,
  requireRole('admin', 'manager'),
  async (req, res) => {
    const routeName = 'holidays.update';
    logRouteStart(req, routeName);

    try {
      const companyId = getCompanyId(req);
      const { status } = req.body;

      const result = await query(`
        UPDATE holidays
        SET status = $1,
            reason = COALESCE($2, reason),
            approved_by = CASE WHEN $1 = 'approved' THEN $3 ELSE approved_by END,
            approved_at = CASE WHEN $1 = 'approved' THEN NOW() ELSE approved_at END
        WHERE id = $4 AND company_id = $5
        RETURNING *
      `, [
        status,
        req.body.reason || null,
        req.user.id,
        req.params.id,
        companyId,
      ]);

      if (!result.rows[0]) {
        return res.status(404).json({
          error: 'Holiday not found'
        });
      }

      res.json(result.rows[0]);

    } catch (error) {
      logRouteFailure(req, routeName, error);
      res.status(500).json({ error: 'Update failed' });
    }
  }
);

// DELETE
router.delete('/holiday-requests/:id',
  authenticateToken,
  requireCompany,
  requireRole('admin', 'manager'),
  async (req, res) => {
    const routeName = 'holidays.delete';
    logRouteStart(req, routeName);

    try {
      const companyId = getCompanyId(req);
      await query(
        `DELETE FROM holidays
         WHERE id = $1 AND company_id = $2`,
        [req.params.id, companyId]
      );

      res.json({ message: 'Deleted' });

    } catch (error) {
      logRouteFailure(req, routeName, error);
      res.status(500).json({ error: 'Delete failed' });
    }
  }
);

module.exports = router;
