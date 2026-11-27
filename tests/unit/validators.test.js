// Unit tests for the input checks. Run with: npm test
const test = require('node:test');
const assert = require('node:assert');
const v = require('../../src/utils/validators');

test('email check', () => {
  assert.strictEqual(v.isValidEmail('mariam@example.com'), true);
  assert.strictEqual(v.isValidEmail('mariam@example'), false);
  assert.strictEqual(v.isValidEmail('not an email'), false);
  assert.strictEqual(v.isValidEmail(123), false);
});

test('password rules: 10-64 characters, a letter and a number', () => {
  assert.strictEqual(v.isStrongPassword('Sahel-Summer-2027'), true);
  assert.strictEqual(v.isStrongPassword('short1'), false); // too short
  assert.strictEqual(v.isStrongPassword('onlyletters-here'), false); // no number
  assert.strictEqual(v.isStrongPassword('1234567890123'), false); // no letter
  assert.strictEqual(v.isStrongPassword('a1'.repeat(33)), false); // 66 characters
  assert.strictEqual(v.isStrongPassword('a1' + 'م'.repeat(40)), false); // 42 characters but 82 bytes
});

test('names can be English or Arabic, but no symbols', () => {
  assert.strictEqual(v.isValidName('Mariam Hassan'), true);
  assert.strictEqual(v.isValidName('مريم حسن'), true);
  assert.strictEqual(v.isValidName('<script>'), false);
  assert.strictEqual(v.isValidName('A'), false);
});

test('phone and licence number formats', () => {
  assert.strictEqual(v.isValidPhone('+201001234567'), true);
  assert.strictEqual(v.isValidPhone('010-123'), false);
  assert.strictEqual(v.isValidLicenseNumber('TEC-2026-00118'), true);
  assert.strictEqual(v.isValidLicenseNumber("1' OR '1'='1"), false);
});

test('dates must be real and written as YYYY-MM-DD', () => {
  assert.strictEqual(v.isValidDate('2027-07-10'), true);
  assert.strictEqual(v.isValidDate('2027-02-30'), false); // 30 February does not exist
  assert.strictEqual(v.isValidDate('10/07/2027'), false);
  assert.strictEqual(v.isValidDate(undefined), false);
});

test('whole numbers and prices', () => {
  assert.strictEqual(v.toWholeNumber('4', 1, 20), 4);
  assert.strictEqual(v.toWholeNumber(2.5, 1, 20), null);
  assert.strictEqual(v.toWholeNumber(50, 1, 20), null);
  assert.strictEqual(v.toWholeNumber(true, 1, 20), null);
  assert.strictEqual(v.toPrice(5500), 5500);
  assert.strictEqual(v.toPrice('99.999'), 100);
  assert.strictEqual(v.toPrice(-10), null);
  assert.strictEqual(v.toPrice('free'), null);
});

test('cleanText trims and checks the length', () => {
  assert.strictEqual(v.cleanText('  Sea-view chalet  ', 5, 120), 'Sea-view chalet');
  assert.strictEqual(v.cleanText('abc', 5, 120), null);
  assert.strictEqual(v.cleanText({ title: 'x' }, 1, 10), null);
});
