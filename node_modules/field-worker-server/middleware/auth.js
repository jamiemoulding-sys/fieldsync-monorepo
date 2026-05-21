const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
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
  console.log("=== AUTH MIDDLEWARE START ===");
  console.log("AUTH HEADER:", req.headers.authorization);
  
  try {
    const authHeader =
      req.headers.authorization;

    if (
      !authHeader ||
      !authHeader.startsWith(
        "Bearer "
      )
    ) {
      console.log("ERROR: No token provided");
      return res.status(401).json({
        error: "No token provided",
      });
    }

    const token =
      authHeader.split(" ")[1];

    console.log("TOKEN:", token ? token.substring(0, 20) + "..." : "null");

    if (
      !token ||
      token === "undefined" ||
      token === "null"
    ) {
      console.log("ERROR: Invalid token");
      return res.status(401).json({
        error: "Invalid token",
      });
    }

    /* VERIFY SUPABASE TOKEN */
    console.log("CALLING SUPABASE AUTH.GETUSER");
    const {
      data,
      error,
    } =
      await supabase.auth.getUser(
        token
      );

    console.log("SUPABASE DATA:", JSON.stringify(data, null, 2));
    console.log("SUPABASE ERROR:", error ? JSON.stringify(error, null, 2) : "null");

    if (
      error ||
      !data?.user
    ) {
      console.log("ERROR: Supabase auth failed -", error?.message || "No user data");
      return res.status(401).json({
        error: "Unauthorized",
        details: error?.message
      });
    }

    req.user = data.user;
    console.log("AUTH MIDDLEWARE SUCCESS - USER ID:", req.user.id);
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