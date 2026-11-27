const bcrypt = require('bcryptjs');
const userModel = require('../models/userModel');
const sessionModel = require('../models/sessionModel');
const { ok, fail } = require('../utils/response');
const { COOKIE_NAME, setSessionCookie, clearSessionCookie } = require('../utils/cookies');
const { hashToken, encrypt, decrypt } = require('../utils/security');
const { logSecurityEvent } = require('../utils/securityLog');
const { isValidName, isValidEmail, isStrongPassword, isValidPhone } = require('../utils/validators');

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_LOGINS = 5;

// Used when the email does not exist, so the answer takes the same time as a wrong password.
// This way nobody can guess which emails have accounts by timing the login.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password-123', BCRYPT_ROUNDS);

// POST /api/v1/auth/signup
async function signup(req, res, next) {
  try {
    const body = req.body || {};

    // only read the fields we expect. Things like "role" or "status" are ignored.
    const fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = body.password;
    const phone = body.phone ? String(body.phone).trim() : null;

    const errors = [];
    if (!isValidName(fullName)) errors.push('Full name must be 2 to 100 letters.');
    if (!isValidEmail(email)) errors.push('Email is not valid.');
    if (!isStrongPassword(password)) {
      errors.push('Password must be 10 to 64 characters with at least one letter and one number.');
    }
    if (phone && !isValidPhone(phone)) errors.push('Phone number is not valid.');

    if (errors.length > 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Please check the form.', errors);
    }

    const existing = await userModel.findByEmail(email);
    if (existing) {
      return fail(res, 409, 'EMAIL_TAKEN', 'An account with this email already exists.');
    }

    // hash the password (bcrypt adds a random salt) and encrypt the phone
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const phoneEncrypted = encrypt(phone);
    const userId = await userModel.createUser(fullName, email, phoneEncrypted, passwordHash);

    // log the new user in straight away
    const session = await sessionModel.createSession(userId);
    setSessionCookie(res, session.token);
    await logSecurityEvent(req, 'SIGNUP_SUCCESS', userId, null);

    return ok(res, { id: userId, fullName: fullName, role: 'guest', csrfToken: session.csrfToken }, 201);
  } catch (err) {
    // two sign ups with the same email at the same time: the UNIQUE rule catches the second one
    if (err.code === 'ER_DUP_ENTRY') {
      return fail(res, 409, 'EMAIL_TAKEN', 'An account with this email already exists.');
    }
    next(err);
  }
}

// POST /api/v1/auth/login
async function login(req, res, next) {
  try {
    const body = req.body || {};
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';

    if (!email || !password) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Email and password are required.');
    }

    // One message for every failed login: no account, wrong password or locked account.
    // This way nobody can find out which emails have accounts (OWASP Authentication Cheat Sheet).
    const failMessage = 'Email or password is wrong, or the account is locked for a while. Please try again.';
    const user = await userModel.findByEmail(email);

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      await logSecurityEvent(req, 'LOGIN_FAILED', null, `No account for ${email}`);
      return fail(res, 401, 'LOGIN_FAILED', failMessage);
    }

    // always check the password first, so a locked account answers in the same time
    const passwordIsRight = await bcrypt.compare(password, user.password_hash);

    if (user.is_locked) {
      await logSecurityEvent(req, 'LOGIN_BLOCKED', user.id, 'Account is locked after too many wrong passwords');
      return fail(res, 401, 'LOGIN_FAILED', failMessage);
    }

    if (!passwordIsRight) {
      const failedCount = user.failed_logins + 1;
      const lockNow = failedCount >= MAX_FAILED_LOGINS;

      await userModel.recordFailedLogin(user.id, lockNow);
      await logSecurityEvent(req, 'LOGIN_FAILED', user.id, `Wrong password (${failedCount} in a row)`);
      if (lockNow) {
        await logSecurityEvent(req, 'ACCOUNT_LOCKED', user.id, 'Locked for 15 minutes');
      }
      return fail(res, 401, 'LOGIN_FAILED', failMessage);
    }

    // checked after the password, so we don't tell strangers the account is suspended
    if (user.status !== 'active') {
      await logSecurityEvent(req, 'LOGIN_BLOCKED', user.id, 'Account is suspended');
      return fail(res, 403, 'ACCOUNT_SUSPENDED', 'This account has been suspended.');
    }

    await userModel.resetFailedLogins(user.id);

    // if the browser still had an old session, end it.
    // A new session code at every login stops session fixation attacks.
    const oldToken = req.cookies[COOKIE_NAME];
    if (oldToken) {
      await sessionModel.deleteSession(hashToken(oldToken));
    }

    const session = await sessionModel.createSession(user.id);
    setSessionCookie(res, session.token);
    await logSecurityEvent(req, 'LOGIN_SUCCESS', user.id, null);

    return ok(res, { id: user.id, fullName: user.full_name, role: user.role, csrfToken: session.csrfToken });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/auth/logout   (needs login + CSRF token)
async function logout(req, res, next) {
  try {
    await sessionModel.deleteSession(req.sessionData.id);
    clearSessionCookie(res);
    await logSecurityEvent(req, 'LOGOUT', req.user.id, null);
    return ok(res, { message: 'You are logged out.' });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/auth/me   (the front end calls this when a page opens)
async function me(req, res, next) {
  try {
    const user = await userModel.findById(req.user.id);
    return ok(res, {
      id: user.id,
      fullName: user.full_name,
      email: user.email,
      phone: decrypt(user.phone_encrypted),
      role: user.role,
      csrfToken: req.sessionData.csrfToken
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, logout, me };
