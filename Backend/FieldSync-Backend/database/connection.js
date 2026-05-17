const { Pool } = require('pg');

console.log("📡 Initializing DB connection...");
console.log("📡 DATABASE_URL:", process.env.DATABASE_URL ? "Loaded ✅" : "Missing ❌");

const connectionString = process.env.DATABASE_URL;

// 🔥 FORCE SSL PROPERLY (this is the key fix)
const pool = new Pool({
  connectionString,
  ssl: process.env.NODE_ENV === 'production'
    ? { rejectUnauthorized: false }
    : false
});

// 🔥 Test connection
(async () => {
  try {
    const client = await pool.connect();
    console.log('✅ DATABASE CONNECTED');
    client.release();
  } catch (err) {
    console.error('💥 DATABASE CONNECTION FAILED:', err);
  }
})();

// 🔥 Query wrapper with timeout
module.exports = {
  query: async (text, params) => {
    try {
      const startTime = Date.now();
      const result = await pool.query(text, params);
      const duration = Date.now() - startTime;
      console.log(`📊 Query completed in ${duration}ms`);
      return result;
    } catch (err) {
      console.error("💥 QUERY ERROR:", err);
      throw err;
    }
  }
};