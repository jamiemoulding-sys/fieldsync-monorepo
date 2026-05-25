const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const multer = require("multer");

const router = express.Router();
const { query } = require("../database/connection");
const {
  authenticateToken,
  requireCompany,
  requireRole,
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
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

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
    uploaded_by: row.uploaded_by,
    created_at: row.created_at,
    sent_at: row.sent_at,
    downloaded_at: row.downloaded_at,
    file_name: row.file_path ? row.file_path.split("/").pop() : null,
    has_file: !!row.file_path,
  };
}

function isPdf(file) {
  return (
    file?.mimetype === "application/pdf" &&
    file.buffer?.slice(0, 4).toString() === "%PDF"
  );
}

function sanitizeFilePart(value) {
  return String(value || "payslip")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function parseMoney(value, field) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number < 0) {
    const error = new Error(`${field} must be a non-negative number`);
    error.statusCode = 400;
    throw error;
  }
  return number;
}

function parseRequiredDate(value, field) {
  if (!value || Number.isNaN(new Date(value).getTime())) {
    const error = new Error(`${field} is required`);
    error.statusCode = 400;
    throw error;
  }
  return new Date(value).toISOString().slice(0, 10);
}

async function loadEmployeeForCompany(employeeId, companyId) {
  const result = await query(
    `
    SELECT id, company_id
    FROM users
    WHERE id = $1
    AND company_id = $2
    LIMIT 1
    `,
    [employeeId, companyId]
  );

  return result.rows[0] || null;
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

router.post(
  "/",
  authenticateToken,
  requireCompany,
  requireRole("manager", "admin"),
  upload.single("file"),
  async (req, res) => {
    try {
      if (!isPdf(req.file)) {
        return res.status(400).json({ error: "A PDF payslip file is required" });
      }

      const employeeId = req.body.employee_id || req.body.user_id;
      const employee = await loadEmployeeForCompany(employeeId, req.user.companyId);

      if (!employee) {
        return res.status(404).json({ error: "Employee not found" });
      }

      const payPeriodStart = parseRequiredDate(
        req.body.pay_period_start || req.body.from,
        "pay_period_start"
      );
      const payPeriodEnd = parseRequiredDate(
        req.body.pay_period_end || req.body.to,
        "pay_period_end"
      );

      if (new Date(payPeriodEnd) < new Date(payPeriodStart)) {
        return res.status(400).json({ error: "Pay period end must be after start" });
      }

      const grossPay = parseMoney(req.body.gross_pay, "gross_pay");
      const netPay = parseMoney(req.body.net_pay, "net_pay");
      const hoursWorked = parseMoney(req.body.hours_worked, "hours_worked");
      const publish = req.body.publish === "true" || req.body.publish === true;

      const fileName = sanitizeFilePart(
        req.file.originalname || `payslip-${payPeriodStart}-${payPeriodEnd}.pdf`
      );
      const filePath = [
        req.user.companyId,
        employeeId,
        `${payPeriodStart}_${payPeriodEnd}_${Date.now()}_${fileName}`,
      ].join("/");

      const { error: uploadError } = await supabase.storage
        .from("payslips")
        .upload(filePath, req.file.buffer, {
          contentType: "application/pdf",
          upsert: false,
        });

      if (uploadError) {
        console.error("PAYSLIP STORAGE UPLOAD ERROR:", uploadError.message);
        return res.status(500).json({ error: "Failed to store payslip PDF" });
      }

      const result = await query(
        `
        INSERT INTO payslips (
          company_id,
          employee_id,
          pay_period_start,
          pay_period_end,
          gross_pay,
          net_pay,
          hours_worked,
          file_path,
          uploaded_by,
          sent_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $10 THEN NOW() ELSE NULL END)
        ON CONFLICT (employee_id, pay_period_start, pay_period_end)
        DO UPDATE SET
          company_id = EXCLUDED.company_id,
          gross_pay = EXCLUDED.gross_pay,
          net_pay = EXCLUDED.net_pay,
          hours_worked = EXCLUDED.hours_worked,
          file_path = EXCLUDED.file_path,
          uploaded_by = EXCLUDED.uploaded_by,
          sent_at = CASE WHEN $10 THEN NOW() ELSE payslips.sent_at END
        RETURNING *
        `,
        [
          req.user.companyId,
          employeeId,
          payPeriodStart,
          payPeriodEnd,
          grossPay,
          netPay,
          hoursWorked,
          filePath,
          req.user.id,
          publish,
        ]
      );

      return res.status(publish ? 201 : 200).json({
        payslip: publicPayslip(result.rows[0]),
      });
    } catch (error) {
      console.error("PAYSLIP UPLOAD ERROR:", error.message);
      return res.status(error.statusCode || 500).json({
        error: error.statusCode ? error.message : "Failed to upload payslip",
      });
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

router.put(
  "/:id/publish",
  authenticateToken,
  requireCompany,
  requireRole("manager", "admin"),
  async (req, res) => {
    try {
      const payslip = await loadPayslip(req, req.params.id);

      if (!payslip) {
        return res.status(404).json({ error: "Payslip not found" });
      }

      const result = await query(
        `
        UPDATE payslips
        SET sent_at = NOW()
        WHERE id = $1
        AND company_id = $2
        RETURNING *
        `,
        [req.params.id, req.user.companyId]
      );

      return res.json({
        payslip: publicPayslip(result.rows[0]),
      });
    } catch (error) {
      console.error("PAYSLIP PUBLISH ERROR:", error.message);
      return res.status(500).json({ error: "Failed to publish payslip" });
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

      if (payslip.employee_id === req.user.id) {
        await query(
          `
          UPDATE payslips
          SET downloaded_at = NOW()
          WHERE id = $1
          AND employee_id = $2
          AND company_id = $3
          `,
          [payslip.id, req.user.id, req.user.companyId]
        );
      }

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
