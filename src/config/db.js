const mysql = require('mysql2/promise');

// One shared pool of connections for the whole app.
// Every file that needs the database requires this same pool.
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  // give dates back as text like '2027-07-10' so time zones can't move them by a day
  dateStrings: true
});

module.exports = pool;
