const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const router = express.Router();
const { query } = require("../database/connection");
const {
  authenticateToken,
  requireCompany,
} = require("../middleware/auth");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

const SIGNED_URL_TTL_SECONDS = 60 * 5;

function canAccessCompanyPayslips(user) {
  return user.role === "admin" || user.role === "manager";
}

function periodLabel(row) {
  const start = row.pay_period_start
    ? new Date(row.pay_period_start).toISOString().slice(0, 10)
    : "";
  const end = row.pay_period_end
    ? new Date(row.pay_period_end).toISOString().slice(0, 10)
    : "";

  return start && end ? `${start} to ${end}` : "Payslip";
}

function publicPayslip(row) {
  return {
    id: row.id,
    company_id: row.company_id,
    employee_id: row.employee_id,
    employee_name: row.employee_name,
    employee_email: row.employee_email,
    pay_period_start: row.pay_period_start,
    pay_period_end: row.pay_period_end,
    period_label: periodLabel(row),
    gross_pay: row.gross_pay,
    net_pay: row.net_pay,
    hours_worked: row.hours_worked,
    created_at: row.created_at,
    sent_at: row.sent_at,
    has_file: !!row.file_path,
  };
}

async function loadPayslip(req, id) {
  const params = [id, req.user.companyId];
  let accessClause = "";

  if (!canAccessCompanyPayslips(req.user)) {
    params.push(req.user.id);
    accessClause = "AND p.employee_id = $3";
  }

  const result = await query(
    `
    SELECT
      p.*,
      u.name AS employee_name,
      u.email AS employee_email
    FROM payslips p
    JOIN users u
      ON u.id = p.employee_id
    WHERE p.id = $1
    AND p.company_id = $2
    ${accessClause}
    LIMIT 1
    `,
    params
  );

  return result.rows[0] || null;
}

async function createSignedPayslipUrl(filePath, download = false) {
  const options = download ? { download: filePath.split("/").pop() } : undefined;
  const { data, error } = await supabase.storage
    .from("payslips")
    .createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS, options);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Could not create signed payslip URL");
  }

  return data.signedUrl;
}

router.get(
  "/",
  authenticateToken,
  requireCompany,
  async (req, res) => {
    try {
      const params = [req.user.companyId];
      let accessClause = "";

      if (!canAccessCompanyPayslips(req.user)) {
        params.push(req.user.id);
        accessClause = "AND p.employee_id = $2";
      } else if (req.query.employee_id) {
        params.push(req.query.employee_id);
        accessClause = "AND p.employee_id = $2";
      }

      const result = await query(
        `
        SELECT
          p.*,
          u.name AS employee_name,
          u.email AS employee_email
        FROM payslips p
        JOIN users u
          ON u.id = p.employee_id
        WHERE p.company_id = $1
        ${accessClause}
        ORDER BY p.pay_period_end DESC, p.created_at DESC
        LIMIT 100
        `,
        params
      );

      return res.json({
        payslips: result.rows.map(publicPayslip),
      });
    } catch (error) {
      console.error("PAYSLIPS LIST ERROR:", error.message);
      return res.status(500).json({ error: "Failed to load payslips" });
    }
  }
);

router.get(
  "/:id",
  authenticateToken,
  requireCompany,
  async (req, res) => {
    try {
      const payslip = await loadPayslip(req, req.params.id);

      if (!payslip) {
        return res.status(404).json({ error: "Payslip not found" });
      }

      const viewUrl = await createSignedPayslipUrl(payslip.file_path, false);

      return res.json({
        payslip: publicPayslip(payslip),
        view_url: viewUrl,
        expires_in: SIGNED_URL_TTL_SECONDS,
      });
    } catch (error) {
      console.error("PAYSLIP DETAIL ERROR:", error.message);
      return res.status(500).json({ error: "Failed to load payslip" });
    }
  }
);

router.get(
  "/:id/download",
  authenticateToken,
  requireCompany,
  async (req, res) => {
    try {
      const payslip = await loadPayslip(req, req.params.id);

      if (!payslip) {
        return res.status(404).json({ error: "Payslip not found" });
      }

      const downloadUrl = await createSignedPayslipUrl(payslip.file_path, true);

      return res.json({
        id: payslip.id,
        download_url: downloadUrl,
        file_name: payslip.file_path.split("/").pop(),
        expires_in: SIGNED_URL_TTL_SECONDS,
      });
    } catch (error) {
      console.error("PAYSLIP DOWNLOAD ERROR:", error.message);
      return res.status(500).json({ error: "Failed to create download link" });
    }
  }
);

module.exports = router;
