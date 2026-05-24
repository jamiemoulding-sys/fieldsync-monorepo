require("dotenv").config();
require("cross-fetch/polyfill");

const express = require("express");
const cors = require("cors");
const path = require("path");

const config = require("./config/env");
const { query } = require("./database/connection");
const { notFound, errorHandler } = require("./middleware/errorHandler");
const logger = require("./utils/logger");

const authRoutes = require("./routes/auth");
const shiftRoutes = require("./routes/shifts");
const taskRoutes = require("./routes/tasks");
const locationRoutes = require("./routes/locations");
const uploadRoutes = require("./routes/uploads");
const assignmentRoutes = require("./routes/assignments");
const userRoutes = require("./routes/users");
const paymentRoutes = require("./routes/payments");
const scheduleRoutes = require("./routes/schedules");
const companyRoutes = require("./routes/companies");
const reportRoutes = require("./routes/reports");
const billingRoutes = require("./routes/billing");
const performanceRoutes = require("./routes/performance");
const dashboardRoutes = require("./routes/dashboard");
const inviteRoutes = require("./routes/invite");
const announcementRoutes = require("./routes/announcements");
const trackingRoutes = require("./routes/tracking");
const payslipRoutes = require("./routes/payslips");

const app = express();

app.set("trust proxy", 1);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || config.allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Blocked by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "apikey",
      "x-client-info",
      "Prefer",
    ],
    exposedHeaders: ["Content-Range", "X-Total-Count"],
  })
);

app.options("*", cors());

app.use(
  "/api/billing/webhook",
  express.raw({
    type: "application/json",
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

app.get("/api/health", async (req, res) => {
  try {
    await query("SELECT 1");
    return res.json({
      status: "OK",
      database: "OK",
      uptime: process.uptime(),
      env: process.env.NODE_ENV || "development",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return res.status(503).json({
      status: "DEGRADED",
      database: "ERROR",
      timestamp: new Date().toISOString(),
    });
  }
});

app.get("/api/ready", async (req, res) => {
  try {
    await query("SELECT 1");
    return res.json({ ready: true });
  } catch {
    return res.status(503).json({ ready: false });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/shifts", shiftRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/assignments", assignmentRoutes);
app.use("/api/users", userRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/schedules", scheduleRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/invite", inviteRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/performance", performanceRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/tracking", trackingRoutes);
app.use("/api/payslips", payslipRoutes);

app.get("/", (req, res) => {
  res.send("Zorvia API Running");
});

app.use("*", notFound);
app.use(errorHandler);

app.listen(config.port, "0.0.0.0", () => {
  logger.info(`Server running on port ${config.port}`);
});
