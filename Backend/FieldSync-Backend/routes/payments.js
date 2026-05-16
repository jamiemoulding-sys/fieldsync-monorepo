const express = require('express');
const router = express.Router();

const { authenticateToken } = require('../middleware/auth');

// ✅ NO requireRole ANYWHERE

router.get('/currency-info', authenticateToken, async (req, res) => {
  try {
    res.json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get currency info' });
  }
});

router.get('/', authenticateToken, async (req, res) => {
  try {
    res.json({ success: true, data: [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get payments' });
  }
});

router.post('/', authenticateToken, async (req, res) => {
  try {
    res.json({ success: true, message: 'Payment created' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

module.exports = router;
