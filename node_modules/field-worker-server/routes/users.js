const express = require("express");
const router = express.Router();

const { query } = require("../database/connection");
const logger = require("../utils/logger");

const {
  authenticateToken,
  requireRole,
  requireCompany,
} = require("../middleware/auth");

/* ====================================
   👥 GET ALL USERS
==================================== */
router.get(
  "/",
  authenticateToken,
  requireCompany,
  requireRole("manager"),
  async (req, res) => {
    const endpoint = "GET /api/users";
    const companyId = req.user.company_id || req.user.companyId;

    try {
      logger.info("Users list request", {
        endpoint,
        status: "started",
        companyId,
        userId: req.user.id,
        role: req.user.role,
      });

      const result = await query(
        `
        SELECT *
        FROM users
        WHERE company_id = $1
        ORDER BY name ASC
        `,
        [companyId]
      );

      res.set("X-FieldSync-Endpoint", endpoint);
      res.set("X-FieldSync-Company-Id", String(companyId));

      logger.info("Users list response", {
        endpoint,
        status: 200,
        companyId,
        count: result.rows.length,
      });

      res.json(result.rows);
    } catch (error) {
      logger.error("GET USERS ERROR", error);
      logger.warn("Users list failed", {
        endpoint,
        status: 500,
        companyId,
      });

      res.status(500).json({
        error: "Failed to fetch users",
      });
    }
  }
);

/* ====================================
   ✏️ UPDATE USER
==================================== */
router.put(
  "/:id",
  authenticateToken,
  requireCompany,
  requireRole("admin"),
  async (req, res) => {
    try {
      const {
  name,
  email,
  phone,
  job_title,
  hourly_rate,
  overtime_rate,
  night_rate,
  contracted_hours,
  holiday_allowance,
  department,
  role,
  start_date,
} = req.body;

const result = await query(
  `
  UPDATE users
  SET
    name = COALESCE($1, name),
    email = COALESCE($2, email),
    phone = COALESCE($3, phone),
    job_title = COALESCE($4, job_title),
    hourly_rate = COALESCE($5, hourly_rate),
    overtime_rate = COALESCE($6, overtime_rate),
    night_rate = COALESCE($7, night_rate),
    contracted_hours = COALESCE($8, contracted_hours),
    holiday_allowance = COALESCE($9, holiday_allowance),
    department = COALESCE($10, department),
    role = COALESCE($11, role),
    start_date = COALESCE($12, start_date)
  WHERE id = $13
  AND company_id = $14
  RETURNING *
  `,
  [
    name,
    email,
    phone,
    job_title,
    hourly_rate,
    overtime_rate,
    night_rate,
    contracted_hours,
    holiday_allowance,
    department,
    role,
    start_date,
    req.params.id,
    req.user.companyId,
  ]
);

      if (!result.rows.length) {
        return res.status(404).json({
          error: "User not found",
        });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("UPDATE USER ERROR:", error);

      res.status(500).json({
        error: "Failed to update user",
      });
    }
  }
);

/* ====================================
   🔁 UPDATE ROLE
==================================== */
router.put(
  "/:id/role",
  authenticateToken,
  requireCompany,
  requireRole("admin"),
  async (req, res) => {
    try {
      const { role } = req.body;

      await query(
        `
        UPDATE users
        SET role = $1
        WHERE id = $2
        AND company_id = $3
        `,
        [
          role,
          req.params.id,
          req.user.companyId,
        ]
      );

      res.json({
        success: true,
      });
    } catch (error) {
      console.error("ROLE UPDATE ERROR:", error);

      res.status(500).json({
        error: "Failed to update role",
      });
    }
  }
);

/* ====================================
   ❌ DELETE USER
==================================== */
router.delete(
  "/:id",
  authenticateToken,
  requireCompany,
  requireRole("admin"),
  async (req, res) => {
    try {
      await query(
        `
        DELETE FROM users
        WHERE id = $1
        AND company_id = $2
        `,
        [
          req.params.id,
          req.user.companyId,
        ]
      );

      res.json({
        success: true,
      });
    } catch (error) {
      console.error("DELETE USER ERROR:", error);

      res.status(500).json({
        error: "Failed to delete user",
      });
    }
  }
);

module.exports = router;
