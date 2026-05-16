const express = require('express');
const router = express.Router();

router.post('/send-via-sendgrid', async (req, res) => {
  try {
    console.log("EMAIL REQUEST:", req.body);

    res.json({
      success: true,
      messageId: 'test-id'
    });
  } catch (err) {
    res.status(500).json({ error: 'Email failed' });
  }
});

router.post('/log-activity', async (req, res) => {
  res.json({ success: true });
});

module.exports = router;