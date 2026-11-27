const listingModel = require('../models/listingModel');
const bookingModel = require('../models/bookingModel');
const { ok, fail } = require('../utils/response');
const { encrypt } = require('../utils/security');
const { toWholeNumber, toPrice, cleanText, isValidLicenseNumber } = require('../utils/validators');

const MAX_ID = 2147483647;
const PROPERTY_TYPES = ['apartment', 'chalet', 'villa', 'studio'];

// ---------- Use case: Create Listing ----------

// POST /api/v1/host/listings   (step 1: save the details as a draft)
async function createListing(req, res, next) {
  try {
    const body = req.body || {};
    const errors = [];

    const title = cleanText(body.title, 5, 120);
    const description = cleanText(body.description, 20, 5000);
    const address = cleanText(body.address, 5, 255);
    const destinationId = toWholeNumber(body.destinationId, 1, MAX_ID);
    const propertyType = body.propertyType;
    const maxGuests = toWholeNumber(body.maxGuests, 1, 20);
    const bedrooms = toWholeNumber(body.bedrooms, 0, 20);
    const bathrooms = toWholeNumber(body.bathrooms, 1, 20);
    const basePrice = toPrice(body.basePrice);

    let houseRules = null;
    if (body.houseRules) {
      houseRules = cleanText(body.houseRules, 1, 2000);
      if (!houseRules) errors.push('House rules can be up to 2000 characters.');
    }

    if (!title) errors.push('Title must be 5 to 120 characters.');
    if (!description) errors.push('Description must be 20 to 5000 characters.');
    if (!address) errors.push('Address must be 5 to 255 characters.');
    if (!destinationId) errors.push('Please choose a destination.');
    if (!PROPERTY_TYPES.includes(propertyType)) errors.push('Property type must be apartment, chalet, villa or studio.');
    if (!maxGuests) errors.push('Max guests must be a number from 1 to 20.');
    if (bedrooms === null) errors.push('Bedrooms must be a number from 0 to 20.');
    if (!bathrooms) errors.push('Bathrooms must be a number from 1 to 20.');
    if (!basePrice) errors.push('Price per night must be a positive number in EGP.');

    if (errors.length > 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Please check the form.', errors);
    }

    if (!(await listingModel.destinationExists(destinationId))) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Please check the form.', ['This destination does not exist.']);
    }

    const listingId = await listingModel.createListing(req.user.id, {
      destinationId,
      title,
      description,
      propertyType,
      addressEncrypted: encrypt(address), // the address is saved encrypted
      maxGuests,
      bedrooms,
      bathrooms,
      basePrice,
      houseRules
    });

    return ok(res, { id: listingId, status: 'draft' }, 201);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/host/listings   (the host's own homes)
async function getMyListings(req, res, next) {
  try {
    const rows = await listingModel.findByHost(req.user.id);
    const listings = rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      licenseNumber: row.license_number,
      basePrice: Number(row.base_price),
      rejectionReason: row.rejection_reason,
      createdAt: row.created_at
    }));
    return ok(res, listings);
  } catch (err) {
    next(err);
  }
}

// PUT /api/v1/host/listings/:id/license   (step 2: add the tourism licence number)
async function addLicense(req, res, next) {
  try {
    const listingId = toWholeNumber(req.params.id, 1, MAX_ID);
    const listing = listingId ? await listingModel.findByIdForHost(listingId, req.user.id) : null;
    if (!listing) {
      // same answer if the home does not exist or belongs to another host
      return fail(res, 404, 'NOT_FOUND', 'Home not found.');
    }

    if (listing.status !== 'draft' && listing.status !== 'rejected') {
      return fail(res, 400, 'NOT_EDITABLE', 'The licence can only be changed while the home is a draft or rejected.');
    }

    const body = req.body || {};
    const licenseNumber = typeof body.licenseNumber === 'string' ? body.licenseNumber.trim().toUpperCase() : '';
    if (!isValidLicenseNumber(licenseNumber)) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Licence number must be 5 to 50 letters, numbers, "-" or "/".');
    }

    await listingModel.setLicense(listingId, licenseNumber);
    return ok(res, { id: listingId, licenseNumber: licenseNumber });
  } catch (err) {
    // the license_number column is UNIQUE: one licence can't be used for two homes
    if (err.code === 'ER_DUP_ENTRY') {
      return fail(res, 409, 'LICENSE_USED', 'This licence number is already used by another home.');
    }
    next(err);
  }
}

// POST /api/v1/host/listings/:id/submit   (step 3: send the home to an admin for review)
async function submitListing(req, res, next) {
  try {
    const listingId = toWholeNumber(req.params.id, 1, MAX_ID);
    const listing = listingId ? await listingModel.findByIdForHost(listingId, req.user.id) : null;
    if (!listing) {
      return fail(res, 404, 'NOT_FOUND', 'Home not found.');
    }

    if (listing.status !== 'draft' && listing.status !== 'rejected') {
      return fail(res, 400, 'ALREADY_SUBMITTED', `This home is already ${listing.status}.`);
    }
    if (!listing.license_number) {
      return fail(res, 400, 'LICENSE_MISSING', 'Please add the tourism licence number before submitting.');
    }

    await listingModel.setStatus(listingId, 'pending_review', null);
    return ok(res, { id: listingId, status: 'pending_review' });
  } catch (err) {
    next(err);
  }
}

// ---------- Use case: Book a Stay (host side) ----------

// GET /api/v1/host/bookings   (booking requests for the host's homes)
async function getHostBookings(req, res, next) {
  try {
    const rows = await bookingModel.findForHost(req.user.id);
    const bookings = rows.map((row) => ({
      id: row.id,
      listingId: row.listing_id,
      title: row.title,
      guestName: row.guest_name,
      checkIn: row.check_in,
      checkOut: row.check_out,
      nights: row.nights,
      guests: row.guests_count,
      totalPrice: Number(row.total_price),
      messageToHost: row.message_to_host,
      status: row.status,
      expiresAt: row.status === 'pending' ? row.expires_at : null
    }));
    return ok(res, bookings);
  } catch (err) {
    next(err);
  }
}

// PATCH /api/v1/host/bookings/:id   body: { "action": "accept" } or { "action": "decline" }
async function respondToBooking(req, res, next) {
  try {
    const bookingId = toWholeNumber(req.params.id, 1, MAX_ID);
    const action = (req.body || {}).action;

    if (action !== 'accept' && action !== 'decline') {
      return fail(res, 400, 'VALIDATION_ERROR', 'Action must be "accept" or "decline".');
    }

    const booking = bookingId ? await bookingModel.findByIdForHost(bookingId, req.user.id) : null;
    if (!booking) {
      return fail(res, 404, 'NOT_FOUND', 'Booking not found.');
    }
    if (booking.status !== 'pending') {
      return fail(res, 400, 'ALREADY_ANSWERED', `This booking is already ${booking.status}.`);
    }

    // the host has 24 hours to answer
    if (booking.is_expired) {
      await bookingModel.changeStatus(bookingId, 'pending', 'expired');
      return fail(res, 409, 'REQUEST_EXPIRED', 'This request is more than 24 hours old and has expired.');
    }

    const newStatus = action === 'accept' ? 'confirmed' : 'declined';
    const changed = await bookingModel.changeStatus(bookingId, 'pending', newStatus);
    if (!changed) {
      return fail(res, 409, 'BOOKING_CHANGED', 'This booking was just changed. Please refresh the page.');
    }

    return ok(res, { id: bookingId, status: newStatus });
  } catch (err) {
    next(err);
  }
}

module.exports = { createListing, getMyListings, addLicense, submitListing, getHostBookings, respondToBooking };
