const listingModel = require('../models/listingModel');
const securityLogModel = require('../models/securityLogModel');
const { ok, fail } = require('../utils/response');
const { toWholeNumber, cleanText } = require('../utils/validators');
const { logSecurityEvent } = require('../utils/securityLog');

const MAX_ID = 2147483647;

// GET /api/v1/admin/listings   (homes waiting for review)
async function getListingsForReview(req, res, next) {
  try {
    const rows = await listingModel.findWaitingForReview();
    const listings = rows.map((row) => ({
      id: row.id,
      title: row.title,
      licenseNumber: row.license_number,
      hostName: row.host_name,
      hostEmail: row.host_email,
      submittedAt: row.created_at
    }));
    return ok(res, listings);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/admin/listings/:id
// body: { "action": "approve" }  or  { "action": "reject", "reason": "..." }
// This is the last step of Create Listing: an admin checks the licence and publishes the home.
async function reviewListing(req, res, next) {
  try {
    const listingId = toWholeNumber(req.params.id, 1, MAX_ID);
    const listing = listingId ? await listingModel.findById(listingId) : null;
    if (!listing) {
      return fail(res, 404, 'NOT_FOUND', 'Home not found.');
    }
    if (listing.status !== 'pending_review') {
      return fail(res, 400, 'NOT_WAITING', 'This home is not waiting for review.');
    }

    const body = req.body || {};

    if (body.action === 'approve') {
      await listingModel.setStatus(listingId, 'published', null);
      await logSecurityEvent(req, 'LISTING_APPROVED', req.user.id, `Listing ${listingId}, licence ${listing.license_number}`);
      return ok(res, { id: listingId, status: 'published' });
    }

    if (body.action === 'reject') {
      const reason = cleanText(body.reason, 5, 500);
      if (!reason) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Please give a reason (5 to 500 characters) so the host can fix it.');
      }
      await listingModel.setStatus(listingId, 'rejected', reason);
      await logSecurityEvent(req, 'LISTING_REJECTED', req.user.id, `Listing ${listingId}: ${reason}`);
      return ok(res, { id: listingId, status: 'rejected', reason: reason });
    }

    return fail(res, 400, 'VALIDATION_ERROR', 'Action must be "approve" or "reject".');
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/admin/security-logs?event=LOGIN_FAILED
async function getSecurityLogs(req, res, next) {
  try {
    let eventType = null;
    if (req.query.event) {
      if (typeof req.query.event !== 'string' || !/^[A-Z_]{3,40}$/.test(req.query.event)) {
        return fail(res, 400, 'VALIDATION_ERROR', 'Event must be a name like LOGIN_FAILED.');
      }
      eventType = req.query.event;
    }

    const rows = await securityLogModel.findLatest(eventType);
    const logs = rows.map((row) => ({
      id: row.id,
      eventType: row.event_type,
      userId: row.user_id,
      email: row.email,
      ipAddress: row.ip_address,
      details: row.details,
      time: row.created_at
    }));
    return ok(res, logs);
  } catch (err) {
    next(err);
  }
}

module.exports = { getListingsForReview, reviewListing, getSecurityLogs };
