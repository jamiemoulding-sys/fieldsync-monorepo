const { Pool } = require('pg');

console.log("📡 Initializing DB connection...");
console.log("📡 DATABASE_URL exists:", !!process.env.DATABASE_URL);

const connectionString = process.env.DATABASE_URL;

// Parse connection string for logging (without password)
let dbInfo = { host: 'unknown', database: 'unknown' };
if (connectionString) {
  try {
    const url = new URL(connectionString.replace('postgresql://', 'http://'));
    dbInfo.host = url.hostname;
    dbInfo.database = url.pathname.replace('/', '');
    console.log("📡 DB Host:", dbInfo.host);
    console.log("📡 DB Database:", dbInfo.database);
  } catch (e) {
    console.log("📡 Could not parse DATABASE_URL");
  }
}

// 🔥 RENDER-COMPATIBLE SSL CONFIG
// Render Postgres requires SSL with rejectUnauthorized: false
const pool = new Pool({
  connectionString,
  ssl: connectionString ? { rejectUnauthorized: false } : false
});

// 🔥 Test connection with graceful failure
(async () => {
  try {
    const client = await pool.connect();
    console.log('✅ DATABASE CONNECTED to', dbInfo.host);
    client.release();
  } catch (err) {
    console.error('💥 DATABASE CONNECTION FAILED:', err.message);
    console.error('💥 App will continue but DB operations will fail');
  }
})();

// 🔥 Query wrapper with error handling
module.exports = {
  query: async (text, params) => {
    try {
      return await pool.query(text, params);
    } catch (err) {
      console.error("💥 QUERY ERROR:", err.message);
      throw err;
    }
  },
  pool // Export pool for direct access if needed
};