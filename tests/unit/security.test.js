// Unit tests for hashing, token checks and encryption
const test = require('node:test');
const assert = require('node:assert');
const crypto = require('crypto');

// a random key just for these tests
process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
const security = require('../../src/utils/security');

test('random tokens are 64 characters and never the same', () => {
  const a = security.randomToken();
  const b = security.randomToken();
  assert.strictEqual(a.length, 64);
  assert.notStrictEqual(a, b);
});

test('the session hash is always the same for the same token, and is not the token', () => {
  const token = security.randomToken();
  assert.strictEqual(security.hashToken(token), security.hashToken(token));
  assert.notStrictEqual(security.hashToken(token), token);
});

test('safeCompare', () => {
  assert.strictEqual(security.safeCompare('abc123', 'abc123'), true);
  assert.strictEqual(security.safeCompare('abc123', 'abc124'), false);
  assert.strictEqual(security.safeCompare('abc', 'abc123'), false);
});

test('encrypt then decrypt gives back the same text', () => {
  const phone = '+201001234567';
  const saved = security.encrypt(phone);
  assert.notStrictEqual(saved, phone);
  assert.ok(!saved.includes(phone));
  assert.strictEqual(security.decrypt(saved), phone);
});

test('the same text encrypted twice looks different (random IV)', () => {
  assert.notStrictEqual(security.encrypt('Marassi, North Coast'), security.encrypt('Marassi, North Coast'));
});

test('changed encrypted data is detected', () => {
  const saved = security.encrypt('Building 7, El Gouna');
  const parts = saved.split(':');
  // change the last character of the encrypted part
  parts[2] = parts[2].slice(0, -1) + (parts[2].endsWith('0') ? '1' : '0');
  assert.throws(() => security.decrypt(parts.join(':')));
});

test('empty values are not encrypted', () => {
  assert.strictEqual(security.encrypt(null), null);
  assert.strictEqual(security.encrypt(''), null);
  assert.strictEqual(security.decrypt(null), null);
});
