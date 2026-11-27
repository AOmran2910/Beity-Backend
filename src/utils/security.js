const crypto = require('crypto');

// Random 64-character code, used for session codes and CSRF tokens
function randomToken() {
  return crypto.randomBytes(32).toString('hex');
}

// We only save the SHA-256 hash of the session code in the database.
// If someone steals the database, they still can't use the sessions.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// Compares two strings in constant time (stops timing attacks on the CSRF token)
function safeCompare(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

// ---------- encryption for personal data (phone numbers and home addresses) ----------
// AES-256-GCM: it hides the data and also detects if someone changed it.

function getKey() {
  const key = Buffer.from(process.env.ENCRYPTION_KEY || '', 'hex');
  if (key.length !== 32) {
    throw new Error('ENCRYPTION_KEY in .env must be 64 hex characters');
  }
  return key;
}

function encrypt(text) {
  if (text === null || text === undefined || text === '') {
    return null;
  }
  const iv = crypto.randomBytes(12); // new random IV every time
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const firstPart = cipher.update(String(text), 'utf8');
  const encrypted = Buffer.concat([firstPart, cipher.final()]);
  const tag = cipher.getAuthTag();

  // save the IV, the tag and the encrypted text together as "iv:tag:data"
  return [iv, tag, encrypted].map((part) => part.toString('hex')).join(':');
}

function decrypt(saved) {
  if (!saved) {
    return null;
  }
  const parts = saved.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const data = Buffer.from(parts[2], 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag); // if the data was changed, final() throws an error
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

module.exports = { randomToken, hashToken, safeCompare, encrypt, decrypt };
