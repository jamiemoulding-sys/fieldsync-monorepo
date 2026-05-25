const express = require('express');
const router = express.Router();
const { query } = require('../database/connection');
const {
  authenticateToken,
  requireCompany,
  requireRole,
} = require('../middleware/auth');

const logActivity = async (userId, companyId, action, metadata = {}) => {
  try {
    await query(`
      INSERT INTO activity_logs (user_id, company_id, action, metadata)
      VALUES ($1, $2, $3, $4)
    `, [userId, companyId, action, JSON.stringify(metadata)]);
  } catch (err) {
    console.error("Activity log failed:", err.message);
  }
};

function normalizeRouteLocations(value) {
  return Array.isArray(value) ? value : [];
}

router.get('/all', authenticateToken, requireCompany, async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;

    if (req.user.role === 'manager' || req.user.role === 'admin') {
      const result = await query(`
        SELECT *
        FROM tasks
        WHERE company_id = $1
        ORDER BY created_at DESC, id DESC
      `, [companyId]);

      return res.json(result.rows);
    }

    const shiftRes = await query(`
      SELECT location_id FROM shifts
      WHERE user_id = $1
      AND company_id = $2
      AND clock_out_time IS NULL
      LIMIT 1
    `, [userId, companyId]);

    if (shiftRes.rows.length === 0) {
      return res.json([]);
    }

    const locationId = shiftRes.rows[0].location_id;

    const result = await query(`
      SELECT *
      FROM tasks
      WHERE company_id = $1
      AND is_active = true
      AND (
        location_id = $2
        OR assigned_to = $3
        OR assigned_to IS NULL
      )
      ORDER BY id DESC
    `, [companyId, locationId, userId]);

    return res.json(result.rows);
  } catch (error) {
    console.error('GET TASKS ERROR:', error);
    return res.status(500).json({
      error: "REAL_ERROR",
      message: error.message
    });
  }
});

router.post('/', authenticateToken, requireCompany, requireRole('manager'), async (req, res) => {
  try {
    const {
      title,
      description,
      location_id,
      assigned_to,
      assigned_users,
      route_locations,
      due_date,
      priority,
      status,
      completed,
    } = req.body;
    const companyId = req.user.companyId;

    if (!title) {
      return res.status(400).json({
        error: "Title is required"
      });
    }

    if (location_id) {
      const locationCheck = await query(
        `SELECT id FROM locations WHERE id = $1 AND company_id = $2`,
        [location_id, companyId]
      );

      if (locationCheck.rows.length === 0) {
        return res.status(403).json({
          error: "Invalid location"
        });
      }
    }

    const result = await query(`
      INSERT INTO tasks (
        title,
        description,
        location_id,
        company_id,
        created_by,
        assigned_to,
        assigned_users,
        route_locations,
        due_date,
        priority,
        status,
        completed
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12)
      RETURNING *
    `, [
      title,
      description || null,
      location_id || null,
      companyId,
      req.user.id,
      assigned_to || null,
      Array.isArray(assigned_users) ? assigned_users : null,
      JSON.stringify(normalizeRouteLocations(route_locations)),
      due_date || null,
      priority || 'normal',
      status || 'todo',
      completed === true,
    ]);

    await logActivity(req.user.id, companyId, 'task_created', {
      title
    });

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('CREATE TASK ERROR:', error);
    return res.status(500).json({
      error: "REAL_ERROR",
      message: error.message
    });
  }
});

router.put('/:id', authenticateToken, requireCompany, requireRole('manager'), async (req, res) => {
  try {
    const payload = req.body || {};

    if (payload.location_id) {
      const locationCheck = await query(
        `SELECT id FROM locations WHERE id = $1 AND company_id = $2`,
        [payload.location_id, req.user.companyId]
      );

      if (locationCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Invalid location' });
      }
    }

    const result = await query(`
      UPDATE tasks
      SET
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        location_id = COALESCE($3, location_id),
        assigned_to = COALESCE($4, assigned_to),
        assigned_users = COALESCE($5, assigned_users),
        route_locations = COALESCE($6::jsonb, route_locations),
        due_date = COALESCE($7, due_date),
        priority = COALESCE($8, priority),
        status = COALESCE($9, status),
        completed = COALESCE($10, completed),
        is_active = COALESCE($11, is_active),
        completed_by = CASE WHEN $10 = true THEN $12 ELSE completed_by END,
        completed_at = CASE WHEN $10 = true THEN NOW() ELSE completed_at END
      WHERE id = $13
      AND company_id = $14
      RETURNING *
    `, [
      payload.title,
      payload.description,
      payload.location_id,
      payload.assigned_to,
      Array.isArray(payload.assigned_users) ? payload.assigned_users : null,
      payload.route_locations === undefined
        ? null
        : JSON.stringify(normalizeRouteLocations(payload.route_locations)),
      payload.due_date,
      payload.priority,
      payload.status,
      payload.completed,
      payload.is_active,
      req.user.id,
      req.params.id,
      req.user.companyId,
    ]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await logActivity(req.user.id, req.user.companyId, 'task_updated', {
      task_id: req.params.id,
    });

    return res.json(result.rows[0]);
  } catch (error) {
    console.error('UPDATE TASK ERROR:', error);
    return res.status(500).json({
      error: "REAL_ERROR",
      message: error.message
    });
  }
});

router.delete('/:id', authenticateToken, requireCompany, requireRole('manager'), async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM tasks WHERE id = $1 AND company_id = $2 RETURNING id`,
      [req.params.id, req.user.companyId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await logActivity(req.user.id, req.user.companyId, 'task_deleted', {
      task_id: req.params.id,
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('DELETE TASK ERROR:', error);
    return res.status(500).json({
      error: "REAL_ERROR",
      message: error.message
    });
  }
});

router.post('/complete', authenticateToken, requireCompany, async (req, res) => {
  try {
    const userId = req.user.id;
    const companyId = req.user.companyId;
    const { task_id } = req.body;

    if (!task_id) {
      return res.status(400).json({
        error: "Task ID required"
      });
    }

    const taskCheck = await query(
      `SELECT id, title FROM tasks WHERE id = $1 AND company_id = $2`,
      [task_id, companyId]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(403).json({
        error: "Invalid task"
      });
    }

    const taskName = taskCheck.rows[0].title;

    const shiftRes = await query(`
      SELECT id FROM shifts
      WHERE user_id = $1
      AND company_id = $2
      AND clock_out_time IS NULL
      LIMIT 1
    `, [userId, companyId]);

    if (shiftRes.rows.length === 0) {
      return res.status(400).json({
        error: 'No active shift'
      });
    }

    const shiftId = shiftRes.rows[0].id;

    const existing = await query(`
      SELECT id FROM task_completions
      WHERE task_id = $1
      AND user_id = $2
      AND shift_id = $3
    `, [task_id, userId, shiftId]);

    if (existing.rows.length > 0) {
      return res.status(400).json({
        error: 'Already completed'
      });
    }

    await query(`
      INSERT INTO task_completions (task_id, user_id, shift_id)
      VALUES ($1, $2, $3)
    `, [task_id, userId, shiftId]);

    await query(`
      UPDATE tasks
      SET completed = true,
          status = 'done',
          completed_by = $1,
          completed_at = NOW()
      WHERE id = $2
      AND company_id = $3
    `, [userId, task_id, companyId]);

    await logActivity(userId, companyId, 'task_completed', {
      task: taskName
    });

    return res.json({ success: true });
  } catch (error) {
    console.error('COMPLETE TASK ERROR:', error);
    return res.status(500).json({
      error: "REAL_ERROR",
      message: error.message
    });
  }
});

module.exports = router;
