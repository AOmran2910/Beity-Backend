// The login cookie. It only holds a random code, never personal data.
// The "__Host-" prefix makes the browser refuse it unless it is Secure, has Path=/ and no Domain.
const COOKIE_NAME = '__Host-beity_sid';
const TWO_HOURS = 2 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,     // JavaScript can't read it, so XSS can't steal it
  secure: true,       // only sent over HTTPS
  sameSite: 'strict', // not sent from other websites (helps stop CSRF)
  path: '/'
};

// Called at login and on every request, so it ends after 2 hours without use
function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, { ...cookieOptions, maxAge: TWO_HOURS });
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, cookieOptions);
}

// ---------- the other two cookies (Milestone 3, Table 6) ----------
// They make the site easier to use: language, last searched place and recently viewed homes.
// They hold no personal data and give no access to anything, so SameSite=Lax is enough.
const PREFS_COOKIE = 'beity_prefs';
const RECENT_COOKIE = 'beity_recent';
const ONE_DAY = 24 * 60 * 60 * 1000;
const MAX_RECENT = 10;

const lightOptions = { httpOnly: true, secure: true, sameSite: 'lax', path: '/' };

function setPrefsCookie(res, prefs) {
  res.cookie(PREFS_COOKIE, JSON.stringify(prefs), { ...lightOptions, maxAge: 180 * ONE_DAY });
}

// A cookie comes from the browser, so we never trust it: every value is checked again
function readPrefs(value) {
  const prefs = { language: 'en', lastDestination: null };
  try {
    const saved = JSON.parse(value);
    if (saved.language === 'en' || saved.language === 'ar') {
      prefs.language = saved.language;
    }
    if (typeof saved.lastDestination === 'string' && /^[a-z0-9-]{2,100}$/.test(saved.lastDestination)) {
      prefs.lastDestination = saved.lastDestination;
    }
  } catch (err) {
    // no cookie or a broken one: keep the defaults
  }
  return prefs;
}

// "5.118.7" -> [5, 118, 7]  (only whole numbers, no repeats, at most 10)
function readRecent(value) {
  if (typeof value !== 'string') {
    return [];
  }
  const ids = value.split('.').map(Number).filter((id) => Number.isInteger(id) && id > 0);
  return [...new Set(ids)].slice(0, MAX_RECENT);
}

// puts the home at the front of the list and keeps the newest 10
function addRecent(list, listingId) {
  return [listingId, ...list.filter((id) => id !== listingId)].slice(0, MAX_RECENT);
}

function setRecentCookie(res, list) {
  res.cookie(RECENT_COOKIE, list.join('.'), { ...lightOptions, maxAge: 30 * ONE_DAY });
}

module.exports = {
  COOKIE_NAME,
  setSessionCookie,
  clearSessionCookie,
  PREFS_COOKIE,
  RECENT_COOKIE,
  setPrefsCookie,
  readPrefs,
  readRecent,
  addRecent,
  setRecentCookie
};
