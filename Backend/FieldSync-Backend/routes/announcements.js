const express = require("express");
const router = express.Router();

const { query } = require("../database/connection");
const {
  authenticateToken,
  requireCompany,
  requireRole,
} = require("../middleware/auth");

//
// =====================================
// 📢 FULL FIX ANNOUNCEMENTS ROUTES
// =====================================

// GET ALL ACTIVE
router.get(
  "/",
  authenticateToken,
  requireCompany,
  async (req, res) => {
    try {
      const companyId =
        req.user.companyId;

      if (!companyId) {
        return res.status(403).json({
          error:
            "No company assigned",
        });
      }

      const result =
        await query(
          `
          SELECT
            id,
            title,
            message,
            priority,
            expires_at,
            created_at
          FROM announcements
          WHERE company_id = $1
          AND (
            expires_at IS NULL
            OR expires_at > NOW()
          )
          ORDER BY created_at DESC
          LIMIT 50
          `,
          [companyId]
        );

      return res.json(
        result.rows || []
      );
    } catch (error) {
      console.error(
        "ANNOUNCEMENTS GET ERROR:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to load announcements",
      });
    }
  }
);

// CREATE
router.post(
  "/",
  authenticateToken,
  requireCompany,
  requireRole("manager"),
  async (req, res) => {
    try {
      const {
        title,
        message,
        priority,
        expiresAt,
      } = req.body;

      if (
        !title ||
        !message
      ) {
        return res.status(400).json({
          error:
            "Title and message required",
        });
      }

      const result =
        await query(
          `
          INSERT INTO announcements
          (
            company_id,
            title,
            message,
            priority,
            expires_at
          )
          VALUES ($1,$2,$3,$4,$5)
          RETURNING *
          `,
          [
            req.user.companyId,
            title,
            message,
            priority ||
              "normal",
            expiresAt ||
              null,
          ]
        );

      return res.json(
        result.rows[0]
      );
    } catch (error) {
      console.error(
        "ANNOUNCEMENTS CREATE ERROR:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to create announcement",
      });
    }
  }
);

// UPDATE
router.put(
  "/:id",
  authenticateToken,
  requireCompany,
  requireRole("manager"),
  async (req, res) => {
    try {
      const {
        title,
        message,
        priority,
        expiresAt,
        expires_at,
      } = req.body;

      const result =
        await query(
          `
          UPDATE announcements
          SET
            title = COALESCE($1, title),
            message = COALESCE($2, message),
            priority = COALESCE($3, priority),
            expires_at = COALESCE($4, expires_at)
          WHERE id = $5
          AND company_id = $6
          RETURNING *
          `,
          [
            title,
            message,
            priority,
            expiresAt ||
              expires_at ||
              null,
            req.params.id,
            req.user.companyId,
          ]
        );

      if (!result.rows[0]) {
        return res.status(404).json({
          error:
            "Announcement not found",
        });
      }

      return res.json(
        result.rows[0]
      );
    } catch (error) {
      console.error(
        "ANNOUNCEMENTS UPDATE ERROR:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to update announcement",
      });
    }
  }
);

// DELETE
router.delete(
  "/:id",
  authenticateToken,
  requireCompany,
  requireRole("manager"),
  async (req, res) => {
    try {
      await query(
        `
        DELETE FROM announcements
        WHERE id = $1
        AND company_id = $2
        `,
        [
          req.params.id,
          req.user.companyId,
        ]
      );

      return res.json({
        success: true,
      });
    } catch (error) {
      console.error(
        "ANNOUNCEMENTS DELETE ERROR:",
        error
      );

      return res.status(500).json({
        error:
          "Failed to delete announcement",
      });
    }
  }
);

module.exports = router;
