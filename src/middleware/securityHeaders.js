// Extra HTTP headers that tell the browser to be more careful with our responses
function securityHeaders(req, res, next) {
  // always use HTTPS for this site for the next year
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  // don't guess the file type, trust Content-Type
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // our API answers should never be shown inside a frame on another site
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
  res.setHeader('Referrer-Policy', 'no-referrer');
  // don't save answers with personal data in the browser cache
  res.setHeader('Cache-Control', 'no-store');
  next();
}

module.exports = securityHeaders;
