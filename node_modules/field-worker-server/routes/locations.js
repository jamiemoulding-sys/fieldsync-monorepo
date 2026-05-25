const express = require('express');
const router = express.Router();
const { query } = require('../database/connection');

const {
  authenticateToken,
  requireCompany,
  requireRole
} = require('../middleware/auth');

const { locationCreationSchema } = require('@fieldsync/shared');

function validationFailed(res, zodError) {
  return res.status(400).json({
    error: 'Validation failed',
    issues: zodError.issues
  });
}

//
// =======================
// 📍 GET ALL
// =======================
router.get('/',
  authenticateToken,
  requireCompany,
  async (req, res) => {
    try {
      const result = await query(
        `SELECT *
         FROM locations
         WHERE company_id = $1
         ORDER BY id DESC`,
        [req.user.companyId]
      );

      res.json(result.rows);

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to fetch locations' });
    }
  }
);

//
// =======================
// ➕ CREATE (MANAGER+)
// =======================
router.post('/',
  authenticateToken,
  requireCompany,
  requireRole('manager', 'admin'),
  async (req, res) => {
    try {
      const parsed = locationCreationSchema.safeParse(req.body);

      if (!parsed.success) {
        return validationFailed(res, parsed.error);
      }

      const { name, address, latitude, longitude, radius } = parsed.data;

      const result = await query(
        `INSERT INTO locations 
         (name, address, latitude, longitude, radius, company_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [
          name,
          address || '',
          latitude,
          longitude,
          radius || 100,
          req.user.companyId
        ]
      );

      // 🧠 ACTIVITY LOG
      await query(
        `INSERT INTO activity_logs (company_id, user_id, action)
         VALUES ($1, $2, $3)`,
        [
          req.user.companyId,
          req.user.id,
          `Created location ${name}`
        ]
      );

      res.json(result.rows[0]);

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Create failed' });
    }
  }
);

//
// =======================
// ✏️ UPDATE (MANAGER+)
// =======================
router.put('/:id',
  authenticateToken,
  requireCompany,
  requireRole('manager', 'admin'),
  async (req, res) => {
    try {
      const archivedOnly =
        Object.keys(req.body).length === 1 &&
        req.body.archived !== undefined;

      let name;
      let address;
      let latitude;
      let longitude;
      let radius;

      if (!archivedOnly) {
        const parsed = locationCreationSchema.safeParse(req.body);

        if (!parsed.success) {
          return validationFailed(res, parsed.error);
        }

        ({ name, address, latitude, longitude, radius } = parsed.data);
      }

      const result = await query(
        `UPDATE locations
         SET name=COALESCE($1, name),
             address=COALESCE($2, address),
             latitude=COALESCE($3, latitude),
             longitude=COALESCE($4, longitude),
             radius=COALESCE($5, radius),
             archived=COALESCE($6, archived)
         WHERE id=$7 AND company_id=$8
         RETURNING *`,
        [
          name || null,
          address === undefined ? null : address,
          latitude,
          longitude,
          radius,
          typeof req.body.archived === 'boolean' ? req.body.archived : null,
          req.params.id,
          req.user.companyId
        ]
      );

      if (!result.rows[0]) {
        return res.status(404).json({
          error: 'Location not found'
        });
      }

      await query(
        `INSERT INTO activity_logs (company_id, user_id, action)
         VALUES ($1, $2, $3)`,
        [
          req.user.companyId,
          req.user.id,
          `Updated location ${req.params.id}`
        ]
      );

      res.json(result.rows[0]);

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Update failed' });
    }
  }
);

//
// =======================
// ❌ DELETE (ADMIN ONLY)
// =======================
router.delete('/:id',
  authenticateToken,
  requireCompany,
  requireRole('admin'),
  async (req, res) => {
    try {
      const result = await query(
        `DELETE FROM locations
         WHERE id=$1 AND company_id=$2
         RETURNING id`,
        [req.params.id, req.user.companyId]
      );

      if (!result.rows[0]) {
        return res.status(404).json({
          error: 'Location not found'
        });
      }

      await query(
        `INSERT INTO activity_logs (company_id, user_id, action)
         VALUES ($1, $2, $3)`,
        [
          req.user.companyId,
          req.user.id,
          `Deleted location ${req.params.id}`
        ]
      );

      res.json({ success: true });

    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Delete failed' });
    }
  }
);

module.exports = router;
