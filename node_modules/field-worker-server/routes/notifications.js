const express = require("express");
const router = express.Router();

const { query } = require("../database/connection");
const {
  authenticateToken,
  requireCompany,
  requireRole,
} = require("../middleware/auth");

function pickNotification(body, companyId) {
  return {
    user_id: body.user_id,
    company_id: companyId,
    title: String(body.title || "").trim(),
    message: String(body.message || "").trim(),
    type: String(body.type || "general").trim() || "general",
  };
}

router.get("/", authenticateToken, requireCompany, async (req, res) => {
  try {
    const result = await query(
      `
      SELECT *
      FROM notifications
      WHERE user_id = $1
      AND company_id = $2
      ORDER BY created_at DESC
      `,
      [req.user.id, req.user.companyId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("NOTIFICATIONS LIST ERROR:", error.message);
    return res.status(500).json({ error: "Failed to load notifications" });
  }
});

router.get("/unread-count", authenticateToken, requireCompany, async (req, res) => {
  try {
    const result = await query(
      `
      SELECT COUNT(*)::int AS count
      FROM notifications
      WHERE user_id = $1
      AND company_id = $2
      AND read = false
      `,
      [req.user.id, req.user.companyId]
    );

    return res.json({ count: result.rows[0]?.count || 0 });
  } catch (error) {
    console.error("NOTIFICATIONS COUNT ERROR:", error.message);
    return res.status(500).json({ error: "Failed to load notifications" });
  }
});

router.post(
  "/",
  authenticateToken,
  requireCompany,
  requireRole("manager", "admin"),
  async (req, res) => {
    try {
      const payload = pickNotification(req.body, req.user.companyId);

      if (!payload.user_id || !payload.title || !payload.message) {
        return res.status(400).json({ error: "user_id, title and message are required" });
      }

      const userRes = await query(
        `
        SELECT id
        FROM users
        WHERE id = $1
        AND company_id = $2
        LIMIT 1
        `,
        [payload.user_id, req.user.companyId]
      );

      if (!userRes.rows[0]) {
        return res.status(404).json({ error: "Notification recipient not found" });
      }

      const result = await query(
        `
        INSERT INTO notifications (user_id, company_id, title, message, type)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
        `,
        [
          payload.user_id,
          payload.company_id,
          payload.title,
          payload.message,
          payload.type,
        ]
      );

      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error("NOTIFICATION CREATE ERROR:", error.message);
      return res.status(500).json({ error: "Failed to create notification" });
    }
  }
);

router.put("/:id/read", authenticateToken, requireCompany, async (req, res) => {
  try {
    const result = await query(
      `
      UPDATE notifications
      SET read = true
      WHERE id = $1
      AND user_id = $2
      AND company_id = $3
      RETURNING *
      `,
      [req.params.id, req.user.id, req.user.companyId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Notification not found" });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error("NOTIFICATION READ ERROR:", error.message);
    return res.status(500).json({ error: "Failed to update notification" });
  }
});

router.put("/read-all", authenticateToken, requireCompany, async (req, res) => {
  try {
    const result = await query(
      `
      UPDATE notifications
      SET read = true
      WHERE user_id = $1
      AND company_id = $2
      AND read = false
      RETURNING id
      `,
      [req.user.id, req.user.companyId]
    );

    return res.json({ success: true, updated: result.rows.length });
  } catch (error) {
    console.error("NOTIFICATIONS READ ALL ERROR:", error.message);
    return res.status(500).json({ error: "Failed to update notifications" });
  }
});

router.delete("/", authenticateToken, requireCompany, async (req, res) => {
  try {
    const result = await query(
      `
      DELETE FROM notifications
      WHERE user_id = $1
      AND company_id = $2
      RETURNING id
      `,
      [req.user.id, req.user.companyId]
    );

    return res.json({ success: true, deleted: result.rows.length });
  } catch (error) {
    console.error("NOTIFICATIONS CLEAR ERROR:", error.message);
    return res.status(500).json({ error: "Failed to clear notifications" });
  }
});

router.delete("/:id", authenticateToken, requireCompany, async (req, res) => {
  try {
    const result = await query(
      `
      DELETE FROM notifications
      WHERE id = $1
      AND user_id = $2
      AND company_id = $3
      RETURNING id
      `,
      [req.params.id, req.user.id, req.user.companyId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "Notification not found" });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error("NOTIFICATION DELETE ERROR:", error.message);
    return res.status(500).json({ error: "Failed to delete notification" });
  }
});

module.exports = router;
