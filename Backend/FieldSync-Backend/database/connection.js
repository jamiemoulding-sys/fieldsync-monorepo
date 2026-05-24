const { Pool } = require("pg");
const logger = require("../utils/logger");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

(async () => {
  try {
    const client = await pool.connect();
    logger.info("Database connected");
    client.release();
  } catch (err) {
    logger.error("Database connection failed", err);
  }
})();

module.exports = {
  query: async (text, params) => {
    try {
      const startTime = Date.now();
      const result = await pool.query(text, params);
      const duration = Date.now() - startTime;

      if (duration > 1000) {
        logger.warn("Slow database query", { duration });
      }

      return result;
    } catch (err) {
      logger.error("Database query failed", err);
      throw err;
    }
  },
};
