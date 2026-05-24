const config = require("../config/env");
const logger = require("../utils/logger");

function notFound(req, res) {
  return res.status(404).json({
    error: "Route not found",
  });
}

function errorHandler(err, req, res, next) {
  logger.error("SERVER ERROR", err);

  const status = err.status || 500;
  const payload = {
    error:
      status >= 500 && config.isProduction
        ? "Internal server error"
        : err.message || "Internal server error",
  };

  if (!config.isProduction && err.stack) {
    payload.stack = err.stack;
  }

  return res.status(status).json(payload);
}

module.exports = {
  notFound,
  errorHandler,
};
