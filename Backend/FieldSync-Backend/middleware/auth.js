const { createClient } = require("@supabase/supabase-js");
const { query } = require("../database/connection");
/* ===================================
SUPABASE ADMIN CLIENT
=================================== */

const ws = require("ws");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    realtime: {
      transport: ws,
    },
  }
);

/* ===================================
🔐 FULL FIX AUTH MIDDLEWARE
(accepts Supabase JWT)
=================================== */

const authenticateToken = async (
  req,
  res,
  next
) => {
  console.log("AUTH MIDDLEWARE START");
  
  try {
    const authHeader =
      req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith(
        "Bearer "
      )
    ) {
      return res.status(401).json({
        error: "No token provided",
      });
    }

    const token =
      authHeader.split(" ")[1];

    console.log("TOKEN RECEIVED");

    console.log("TOKEN RECEIVED");

    if (
      !token ||
      token === "undefined" ||
      token === "null"
    ) {
      return res.status(401).json({
        error: "Invalid token",
      });
    }

    /* VERIFY SUPABASE TOKEN */
    const {
      data,
      error,
    } =
      await supabase.auth.getUser(
        token
      );

    if (
      error ||
      !data?.user
    ) {
      return res.status(401).json({
        error:
          "Unauthorized",
      });
    }

    const authUser =
      data.user;

    console.log("SUPABASE USER:", authUser?.id);

    /* GET LIVE USER FROM DB */
    const result =
      await query(
        `
        SELECT
          id,
          email,
          name,
          role,
          company_id,
          is_pro,
          temp_role,
          temp_role_expires
        FROM users
        WHERE id = $1
        LIMIT 1
        `,
        [authUser.id]
      );

    const user =
      result.rows[0];

    if (!user) {
      return res.status(401).json({
        error: "User not found",
      });
    }

    let finalRole =
      user.role ||
      "employee";

    /* TEMP ROLE SUPPORT */
    if (
      user.temp_role &&
      user.temp_role_expires
    ) {
      const now =
        new Date();

      const expiry =
        new Date(
          user.temp_role_expires
        );

      if (expiry > now) {
        finalRole =
          user.temp_role;
      } else {
        await query(
          `
          UPDATE users
          SET temp_role = NULL,
              temp_role_expires = NULL
          WHERE id = $1
          `,
          [user.id]
        );
      }
    }

    /* USER PAYLOAD */
    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: finalRole,

      companyId:
        user.company_id,

      company_id:
        user.company_id,

      isPro:
        user.is_pro || false,
    };

    console.log("AUTH MIDDLEWARE SUCCESS");
    console.log("CALLING NEXT()");
    next();
  } catch (err) {
    console.error(
      "AUTH ERROR:",
      err.message
    );

    return res.status(401).json({
      error:
        "Authentication failed",
    });
  }
};

/* ===================================
👑 ROLE ACCESS
=================================== */

const requireRole =
  (...roles) => {
    return (
      req,
      res,
      next
    ) => {
      if (!req.user) {
        return res
          .status(401)
          .json({
            error:
              "Unauthorized",
          });
      }

      const levels = {
        employee: 1,
        manager: 2,
        admin: 3,
      };

      const userLevel =
        levels[
          req.user.role
        ] || 0;

      const allowed =
        roles.some(
          (role) =>
            userLevel >=
            levels[role]
        );

      if (!allowed) {
        return res
          .status(403)
          .json({
            error:
              "Forbidden",
          });
      }

      next();
    };
  };

/* ===================================
🏢 COMPANY CHECK
=================================== */

const requireCompany = (
  req,
  res,
  next
) => {
  if (
    !req.user ||
    !req.user.companyId
  ) {
    return res.status(403).json({
      error:
        "No company assigned",
    });
  }

  next();
};

module.exports = {
  authenticateToken,
  requireRole,
  requireCompany,
};