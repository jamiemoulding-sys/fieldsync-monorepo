const express = require('express');
const router = express.Router();

const {
  authenticateToken,
  requireCompany,
  requireRole,
} = require('../middleware/auth');

// ✅ NO requireRole ANYWHERE

router.get('/currency-info', authenticateToken, requireCompany, async (req, res) => {
  try {
    res.json({ success: true, data: {} });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get currency info' });
  }
});

router.get('/', authenticateToken, requireCompany, requireRole('manager'), async (req, res) => {
  try {
    res.json({ success: true, data: [] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to get payments' });
  }
});

router.post('/', authenticateToken, requireCompany, requireRole('admin'), async (req, res) => {
  try {
    res.json({ success: true, message: 'Payment created' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

module.exports = router;
