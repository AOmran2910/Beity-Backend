const db = require('../config/db');
const { randomToken, hashToken } = require('../utils/security');

// Starts a new session. The real code goes in the cookie, the database only gets its hash.
async function createSession(userId) {
  const token = randomToken();
  const csrfToken = randomToken();

  await db.execute(
    'INSERT INTO sessions (id, user_id, csrf_token, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))',
    [hashToken(token), userId, csrfToken]
  );

  return { token: token, csrfToken: csrfToken };
}

// A session is valid if it is less than 24 hours old
// and the user made a request in the last 2 hours.
async function findValidSession(sessionId) {
  const [rows] = await db.execute(
    `SELECT s.id, s.user_id, s.csrf_token, u.full_name, u.role, u.status
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ?
       AND s.expires_at > NOW()
       AND s.last_seen_at > DATE_SUB(NOW(), INTERVAL 2 HOUR)`,
    [sessionId]
  );
  return rows[0] || null;
}

async function touchSession(sessionId) {
  await db.execute('UPDATE sessions SET last_seen_at = NOW() WHERE id = ?', [sessionId]);
}

async function deleteSession(sessionId) {
  await db.execute('DELETE FROM sessions WHERE id = ?', [sessionId]);
}

// Clean-up job: removes sessions that can't be used any more
async function deleteOldSessions() {
  const [result] = await db.execute(
    'DELETE FROM sessions WHERE expires_at < NOW() OR last_seen_at < DATE_SUB(NOW(), INTERVAL 2 HOUR)'
  );
  return result.affectedRows;
}

module.exports = { createSession, findValidSession, touchSession, deleteSession, deleteOldSessions };
