const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");
const { query } = require("../database/connection");

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

const ROLE_LEVELS = {
  employee: 1,
  manager: 2,
  admin: 3,
};

function normalizeRole(role) {
  const normalized = String(role || "employee").trim().toLowerCase();
  return ROLE_LEVELS[normalized] ? normalized : "employee";
}

function normalizeUser(row) {
  const role = normalizeRole(row.role);
  const companyId = row.company_id || null;

  return {
    ...row,
    role,
    companyId,
    company_id: companyId,
  };
}

async function getAuthenticatedUserId(token) {
  if (process.env.JWT_SECRET) {
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      if (decoded?.id) return decoded.id;
      if (decoded?.sub) return decoded.sub;
    } catch {
      // Fall through to Supabase token validation.
    }
  }

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data?.user?.id) return null;

  return data.user.id;
}

const authenticateToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const token = authHeader.slice("Bearer ".length).trim();

    if (!token || token === "undefined" || token === "null") {
      return res.status(401).json({ error: "Invalid token" });
    }

    const userId = await getAuthenticatedUserId(token);

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const result = await query(
      `
      SELECT
        u.id,
        u.email,
        u.name,
        u.phone,
        u.role,
        u.company_id,
        u.job_title,
        u.hourly_rate,
        u.overtime_rate,
        u.night_rate,
        u.contracted_hours,
        u.employment_type,
        u.department,
        u.holiday_allowance,
        u.payroll_id,
        u.status,
        u.is_active,
        c.name AS company_name,
        c.is_pro,
        c.current_plan,
        c.subscription_status,
        c.stripe_customer_id
      FROM users u
      LEFT JOIN companies c
        ON c.id = u.company_id
      WHERE u.id = $1
      LIMIT 1
      `,
      [userId]
    );

    const user = result.rows[0];

    if (!user || user.is_active === false || user.status === "inactive") {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.user = normalizeUser(user);
    return next();
  } catch (err) {
    console.error("AUTH ERROR:", err.message);
    return res.status(401).json({ error: "Authentication failed" });
  }
};

const requireRole = (...roles) => {
  const allowedRoles = roles.map(normalizeRole);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userLevel = ROLE_LEVELS[req.user.role] || 0;
    const allowed = allowedRoles.some(
      (role) => userLevel >= ROLE_LEVELS[role]
    );

    if (!allowed) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return next();
  };
};

const requireCompany = (req, res, next) => {
  if (!req.user?.companyId) {
    return res.status(403).json({ error: "No company assigned" });
  }

  return next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requireCompany,
  normalizeRole,
};
