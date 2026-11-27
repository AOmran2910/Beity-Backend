const db = require('../config/db');

// Latest 100 security events, newest first. Can be filtered by event type.
async function findLatest(eventType) {
  let sql = `SELECT l.id, l.event_type, l.user_id, u.email, l.ip_address, l.details, l.created_at
             FROM security_logs l
             LEFT JOIN users u ON u.id = l.user_id`;
  const params = [];

  if (eventType) {
    sql += ' WHERE l.event_type = ?';
    params.push(eventType);
  }
  sql += ' ORDER BY l.id DESC LIMIT 100';

  const [rows] = await db.execute(sql, params);
  return rows;
}

module.exports = { findLatest };
