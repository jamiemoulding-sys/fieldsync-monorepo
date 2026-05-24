const isProduction = process.env.NODE_ENV === "production";

function parseList(value, fallback = []) {
  if (!value) return fallback;
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

const allowedOrigins = parseList(process.env.CORS_ORIGINS, [
  "https://app.zorviatech.co.uk",
  "https://www.app.zorviatech.co.uk",
  "http://localhost:3000",
]);

module.exports = {
  isProduction,
  port: process.env.PORT || 10000,
  allowedOrigins,
};
