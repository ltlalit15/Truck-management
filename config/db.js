/**
 * Database Configuration
 * Creates and exports a MySQL connection pool using mysql2
 */

const mysql = require("mysql2/promise");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,            // ✅ VERY IMPORTANT
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  ssl: {
    rejectUnauthorized: false,          // ✅ REQUIRED FOR RAILWAY
  },

  waitForConnections: true,
  connectionLimit: 10,                  // ✅ keep low
  queueLimit: 0,
  connectTimeout: 10000,                // ✅ 10 seconds
});

// Test connection
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log("✅ Database connected successfully");
    connection.release();
  } catch (err) {
    console.error("❌ Database connection error:", err);
  }
})();

module.exports = pool;
