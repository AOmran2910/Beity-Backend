const { logSecurityEvent } = require('../utils/securityLog');
const { fail } = require('../utils/response');

// A small rate limiter: each IP can make "maxRequests" requests every "minutes" minutes.
// After that the server answers 429 Too Many Requests.
// The counts are kept in memory, so they reset when the server restarts.
function rateLimit(maxRequests, minutes) {
  const windowMs = minutes * 60 * 1000;
  const counts = {}; // ip -> { count, start }

  return function (req, res, next) {
    const now = Date.now();
    let entry = counts[req.ip];

    // first request from this IP, or the time window has passed
    if (!entry || now - entry.start > windowMs) {
      entry = { count: 0, start: now };
      counts[req.ip] = entry;
    }

    entry.count++;

    if (entry.count > maxRequests) {
      // only log the first blocked request, so the log is not flooded
      if (entry.count === maxRequests + 1) {
        logSecurityEvent(req, 'RATE_LIMITED', null, `More than ${maxRequests} requests in ${minutes} minutes`);
      }
      return fail(res, 429, 'TOO_MANY_REQUESTS', 'Too many requests. Please wait and try again.');
    }

    next();
  };
}

module.exports = rateLimit;
