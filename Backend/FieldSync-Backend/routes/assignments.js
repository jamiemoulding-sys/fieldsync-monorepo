const express = require('express');
const router = express.Router();

const {
  authenticateToken,
  requireCompany,
  requireRole,
} = require('../middleware/auth');

// ✅ NO requireRole — removed completely

router.get('/', authenticateToken, requireCompany, requireRole('manager'), async (req, res) => {
  try {
    res.json({ success: true, data: [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get assignments' });
  }
});

router.post('/', authenticateToken, requireCompany, requireRole('manager'), async (req, res) => {
  try {
    res.json({ success: true, message: 'Assignment created' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create assignment' });
  }
});

module.exports = router;
