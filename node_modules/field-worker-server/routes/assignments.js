const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../middleware/auth');

// ✅ NO requireRole — removed completely

router.get('/', authenticateToken, async (req, res) => {
  try {
    res.json({ success: true, data: [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get assignments' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    res.json({ success: true, message: 'Assignment created' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create assignment' });
  }
});

module.exports = router;
