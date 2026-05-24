const express = require("express");
const router = express.Router();

const { query } = require("../database/connection");
const {
  authenticateToken,
  requireCompany,
} = require("../middleware/auth");

function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function validLatitude(value) {
  return value !== null && value >= -90 && value <= 90;
}

function validLongitude(value) {
  return value !== null && value >= -180 && value <= 180;
}

async function logTrackingAudit(req, shiftId, metadata) {
  try {
    await query(
      `
      INSERT INTO audit_logs (user_id, action, entity, payload)
      VALUES ($1, $2, $3, $4)
      `,
      [
        req.user.id,
        "tracking_ping_created",
        "shift_route_logs",
        JSON.stringify({
          shift_id: shiftId,
          company_id: req.user.companyId,
          ...metadata,
        }),
      ]
    );
  } catch (err) {
    console.error("TRACKING AUDIT LOG FAILED:", err.message);
  }
}

router.post(
  "/pings",
  authenticateToken,
  requireCompany,
  async (req, res) => {
    try {
      if (req.user.role !== "employee") {
        return res.status(403).json({ error: "Employee access required" });
      }

      const shiftId = Number(req.body.shift_id || req.body.shiftId);
      const latitude = toNumber(req.body.latitude);
      const longitude = toNumber(req.body.longitude);
      const speed = toNumber(req.body.speed) || 0;
      const accuracy = toNumber(req.body.accuracy) || 0;
      const battery = toNumber(req.body.battery) || 0;

      if (!Number.isInteger(shiftId) || shiftId <= 0) {
        return res.status(400).json({ error: "Valid shift_id required" });
      }

      if (!validLatitude(latitude) || !validLongitude(longitude)) {
        return res.status(400).json({ error: "Valid coordinates required" });
      }

      const activeShift = await query(
        `
        SELECT id
        FROM shifts
        WHERE id = $1
        AND user_id = $2
        AND company_id = $3
        AND clock_out_time IS NULL
        LIMIT 1
        `,
        [shiftId, req.user.id, req.user.companyId]
      );

      if (!activeShift.rows[0]) {
        return res.status(409).json({ error: "No active shift for tracking" });
      }

      const result = await query(
        `
        INSERT INTO shift_route_logs
          (shift_id, user_id, company_id, latitude, longitude, speed, accuracy, battery)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, shift_id, created_at
        `,
        [
          shiftId,
          req.user.id,
          req.user.companyId,
          latitude,
          longitude,
          speed,
          accuracy,
          battery,
        ]
      );

      await logTrackingAudit(req, shiftId, {
        route_log_id: result.rows[0].id,
        accuracy,
      });

      return res.status(201).json({
        success: true,
        ping: result.rows[0],
      });
    } catch (error) {
      console.error("TRACKING PING ERROR:", error.message);
      return res.status(500).json({ error: "Tracking ping failed" });
    }
  }
);

module.exports = router;
