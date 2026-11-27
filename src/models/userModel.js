const db = require('../config/db');

// All SQL for the users table. Every query uses ? placeholders (prepared statements),
// so user input is never mixed into the SQL text. This stops SQL injection.

async function findByEmail(email) {
  const [rows] = await db.execute(
    `SELECT id, full_name, email, password_hash, role, status, failed_logins,
            (locked_until IS NOT NULL AND locked_until > NOW()) AS is_locked
     FROM users
     WHERE email = ?`,
    [email]
  );
  return rows[0] || null;
}

async function findById(userId) {
  const [rows] = await db.execute(
    'SELECT id, full_name, email, phone_encrypted, role, status, created_at FROM users WHERE id = ?',
    [userId]
  );
  return rows[0] || null;
}

// New accounts always start as 'guest' (the default in the table).
// The role is never taken from the request.
async function createUser(fullName, email, phoneEncrypted, passwordHash) {
  const [result] = await db.execute(
    'INSERT INTO users (full_name, email, phone_encrypted, password_hash) VALUES (?, ?, ?, ?)',
    [fullName, email, phoneEncrypted, passwordHash]
  );
  return result.insertId;
}

// Adds one to the count of wrong passwords.
// On the 5th one, the account is locked for 15 minutes and the count starts again.
async function recordFailedLogin(userId, lockAccount) {
  if (lockAccount) {
    await db.execute(
      'UPDATE users SET failed_logins = 0, locked_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?',
      [userId]
    );
  } else {
    await db.execute('UPDATE users SET failed_logins = failed_logins + 1 WHERE id = ?', [userId]);
  }
}

async function resetFailedLogins(userId) {
  await db.execute('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = ?', [userId]);
}

module.exports = { findByEmail, findById, createUser, recordFailedLogin, resetFailedLogins };
