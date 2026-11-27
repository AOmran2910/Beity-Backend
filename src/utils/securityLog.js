const db = require('../config/db');

// Saves a security event (login, failed login, blocked request...) with the IP and time.
// Admins can read these with GET /api/v1/admin/security-logs
async function logSecurityEvent(req, eventType, userId, details) {
  const ip = req.ip || 'unknown';
  const userAgent = (req.get('User-Agent') || '').slice(0, 255);
  const time = new Date().toISOString();

  const cleanDetails = details ? String(details).slice(0, 500) : null;

  // also print it, so we can watch the log in the terminal
  const line = `[security] ${time} ${eventType} user=${userId || '-'} ip=${ip}`;
  console.log(line, cleanDetails || '');

  try {
    await db.execute(
      `INSERT INTO security_logs
         (user_id, event_type, ip_address, user_agent, details)
       VALUES (?, ?, ?, ?, ?)`,
      [userId || null, eventType, ip, userAgent, cleanDetails]
    );
  } catch (err) {
    // a problem with the log should not stop the user's request
    console.error('Could not save the security log:', err.message);
  }
}

module.exports = { logSecurityEvent };
