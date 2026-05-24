const express = require('express');
const router = express.Router();
const { query } = require('../database/connection');
const {
  authenticateToken,
  requireCompany,
  requireRole,
} = require('../middleware/auth');

//
// ✅ GET ALL COMPLETIONS
//
router.get('/all', authenticateToken, requireCompany, requireRole('manager'), async (req, res) => {
  try {
    const result = await query(`
      SELECT tc.*
      FROM task_completions tc
      JOIN tasks t ON t.id = tc.task_id
      WHERE t.company_id = $1
      ORDER BY tc.completed_at DESC
    `, [req.user.companyId]);

    res.json(result.rows);

  } catch (error) {
    console.error('Get uploads error:', error);
    res.status(500).json({
  error: "REAL_ERROR",
  message: error.message
});
  }
});

module.exports = router;
