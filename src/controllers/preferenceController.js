const listingModel = require('../models/listingModel');
const { ok, fail } = require('../utils/response');
const { PREFS_COOKIE, setPrefsCookie, readPrefs } = require('../utils/cookies');

// Preferences are kept in the beity_prefs cookie, not in the database,
// so they also work for visitors who are not logged in.

// GET /api/v1/preferences
function getPreferences(req, res) {
  return ok(res, readPrefs(req.cookies[PREFS_COOKIE]));
}

// PUT /api/v1/preferences   body: { "language": "ar", "lastDestination": "north-coast" }
async function savePreferences(req, res, next) {
  try {
    const body = req.body || {};
    const prefs = readPrefs(req.cookies[PREFS_COOKIE]); // start from what is already saved

    if (body.language !== undefined) {
      if (body.language !== 'en' && body.language !== 'ar') {
        return fail(res, 400, 'VALIDATION_ERROR', 'Language must be "en" or "ar".');
      }
      prefs.language = body.language;
    }

    if (body.lastDestination !== undefined) {
      const slug = body.lastDestination;
      const destination = typeof slug === 'string' ? await listingModel.findDestinationBySlug(slug) : null;
      if (!destination) {
        return fail(res, 400, 'VALIDATION_ERROR', 'This destination does not exist.');
      }
      prefs.lastDestination = destination.slug;
    }

    setPrefsCookie(res, prefs);
    return ok(res, prefs);
  } catch (err) {
    next(err);
  }
}

module.exports = { getPreferences, savePreferences };
