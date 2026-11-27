// Small functions to check user input.
// The server never trusts what the browser sends.

function isValidEmail(email) {
  return typeof email === 'string' && email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// 10 to 64 characters, at least one letter and one number (Milestone 3 rule).
// bcrypt only reads the first 72 bytes, so we also make sure it is not longer than that
// (Arabic letters and emojis take more than one byte each).
function isStrongPassword(password) {
  return (
    typeof password === 'string' &&
    password.length >= 10 &&
    password.length <= 64 &&
    Buffer.byteLength(password, 'utf8') <= 72 &&
    /[A-Za-z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

// Letters (English or Arabic), spaces, dots, dashes and apostrophes
function isValidName(name) {
  return typeof name === 'string' && name.length >= 2 && name.length <= 100 && /^[\p{L} .'-]+$/u.test(name);
}

// Egyptian or international number, e.g. +201001234567
function isValidPhone(phone) {
  return typeof phone === 'string' && /^\+?[0-9]{8,15}$/.test(phone);
}

// Tourism licence number, e.g. TEC-2026-00118
function isValidLicenseNumber(value) {
  return typeof value === 'string' && /^[A-Za-z0-9\/-]{5,50}$/.test(value);
}

// Checks the format is YYYY-MM-DD and that the date really exists (no 2027-02-30)
function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(value + 'T00:00:00Z');
  return !isNaN(date) && date.toISOString().slice(0, 10) === value;
}

// Returns a whole number between min and max, or null if the value is not valid
function toWholeNumber(value, min, max) {
  const number = Number(value);
  if (typeof value === 'boolean' || value === null || value === '' || !Number.isInteger(number)) {
    return null;
  }
  if (number < min || number > max) {
    return null;
  }
  return number;
}

// Returns a positive price rounded to 2 decimals, or null
function toPrice(value) {
  const number = Number(value);
  if (typeof value === 'boolean' || value === null || value === '' || !Number.isFinite(number)) {
    return null;
  }
  if (number <= 0 || number > 1000000) {
    return null;
  }
  return Math.round(number * 100) / 100;
}

// Trims text and checks its length. Returns the clean text or null.
function cleanText(value, minLength, maxLength) {
  if (typeof value !== 'string') {
    return null;
  }
  const text = value.trim();
  if (text.length < minLength || text.length > maxLength) {
    return null;
  }
  return text;
}

module.exports = {
  isValidEmail,
  isStrongPassword,
  isValidName,
  isValidPhone,
  isValidLicenseNumber,
  isValidDate,
  toWholeNumber,
  toPrice,
  cleanText
};
