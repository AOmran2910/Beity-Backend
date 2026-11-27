const sessionModel = require('../models/sessionModel');
const { hashToken, safeCompare } = require('../utils/security');
const { COOKIE_NAME, setSessionCookie, clearSessionCookie } = require('../utils/cookies');
const { logSecurityEvent } = require('../utils/securityLog');
const { fail } = require('../utils/response');

// 1) Authentication: is the user logged in?
// Reads the session cookie, checks it in the database and puts the user on req.user
async function requireLogin(req, res, next) {
  try {
    const token = req.cookies[COOKIE_NAME];
    if (!token) {
      return fail(res, 401, 'NOT_LOGGED_IN', 'Please log in first.');
    }

    const session = await sessionModel.findValidSession(hashToken(token));
    if (!session) {
      clearSessionCookie(res);
      return fail(res, 401, 'SESSION_EXPIRED', 'Your session has ended. Please log in again.');
    }

    if (session.status !== 'active') {
      await sessionModel.deleteSession(session.id);
      clearSessionCookie(res);
      await logSecurityEvent(req, 'BLOCKED_SUSPENDED_USER', session.user_id, 'Suspended user tried to use the site');
      return fail(res, 403, 'ACCOUNT_SUSPENDED', 'This account has been suspended.');
    }

    // the user is active, so keep the session alive for 2 more hours
    await sessionModel.touchSession(session.id);
    setSessionCookie(res, token);

    req.user = { id: session.user_id, fullName: session.full_name, role: session.role };
    req.sessionData = { id: session.id, csrfToken: session.csrf_token };
    next();
  } catch (err) {
    next(err);
  }
}

// 2) Authorization: is this user allowed to do this?
// Example: requireRole('host') or requireRole('admin')
function requireRole(...roles) {
  return function (req, res, next) {
    if (!roles.includes(req.user.role)) {
      logSecurityEvent(req, 'ACCESS_DENIED', req.user.id, `${req.method} ${req.originalUrl} needs role: ${roles.join(' or ')}`);
      return fail(res, 403, 'FORBIDDEN', 'You are not allowed to do this.');
    }
    next();
  };
}

// 3) CSRF check for requests that change data (POST, PUT, PATCH, DELETE).
// The front end must send the token it got at login in the X-CSRF-Token header.
// Another website can't read this token, so it can't send requests in the user's name.
function checkCsrf(req, res, next) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') {
    return next();
  }

  const sentToken = req.get('X-CSRF-Token') || '';
  if (!safeCompare(sentToken, req.sessionData.csrfToken)) {
    logSecurityEvent(req, 'CSRF_FAILED', req.user.id, `${req.method} ${req.originalUrl}`);
    return fail(res, 403, 'CSRF_FAILED', 'Missing or wrong CSRF token.');
  }
  next();
}

module.exports = { requireLogin, requireRole, checkCsrf };
