const listingModel = require('../models/listingModel');
const bookingModel = require('../models/bookingModel');
const { ok, fail } = require('../utils/response');
const { decrypt } = require('../utils/security');
const { toWholeNumber, cleanText } = require('../utils/validators');
const { getNights, todayString, checkBookingDates, calculateTotal } = require('../utils/dates');

const MAX_ID = 2147483647;

// ---------- Use case: Book a Stay (guest side) ----------

// POST /api/v1/bookings
// body: { listingId, checkIn, checkOut, guests, messageToHost (optional) }
async function createBooking(req, res, next) {
  try {
    const body = req.body || {};
    const errors = [];

    const listingId = toWholeNumber(body.listingId, 1, MAX_ID);
    const guests = toWholeNumber(body.guests, 1, 20);
    const checkIn = body.checkIn;
    const checkOut = body.checkOut;

    let messageToHost = null;
    if (body.messageToHost) {
      messageToHost = cleanText(body.messageToHost, 1, 500);
      if (!messageToHost) errors.push('Message to the host can be up to 500 characters.');
    }

    if (!listingId) errors.push('listingId is not valid.');
    if (!guests) errors.push('Guests must be a number from 1 to 20.');
    const dateError = checkBookingDates(checkIn, checkOut);
    if (dateError) errors.push(dateError);

    if (errors.length > 0) {
      return fail(res, 400, 'VALIDATION_ERROR', 'Please check the booking details.', errors);
    }

    const listing = await listingModel.findPublishedById(listingId);
    if (!listing) {
      return fail(res, 404, 'NOT_FOUND', 'This home does not exist or is not open for booking.');
    }
    if (listing.host_id === req.user.id) {
      return fail(res, 400, 'OWN_HOME', 'You can not book your own home.');
    }
    if (guests > listing.max_guests) {
      return fail(res, 400, 'TOO_MANY_GUESTS', `This home allows up to ${listing.max_guests} guests.`);
    }

    // The price is always worked out here on the server.
    // If the browser sends a totalPrice, it is simply ignored.
    const nights = getNights(checkIn, checkOut);
    const seasonalPrices = await listingModel.getSeasonalPrices(listingId);
    const totalPrice = calculateTotal(nights, listing.base_price, seasonalPrices);

    const bookingId = await bookingModel.createBooking(
      { listingId, guestId: req.user.id, checkIn, checkOut, guests, totalPrice, messageToHost },
      nights
    );

    return ok(
      res,
      { id: bookingId, status: 'pending', checkIn: checkIn, checkOut: checkOut, nights: nights.length, totalPrice: totalPrice },
      201
    );
  } catch (err) {
    // one of the nights is already in calendar_nights (someone else booked it first)
    if (err.code === 'ER_DUP_ENTRY') {
      return fail(res, 409, 'DATES_TAKEN', 'Some of these nights are already booked. Please choose other dates.');
    }
    next(err);
  }
}

// GET /api/v1/bookings   (the logged-in user's bookings)
async function getMyBookings(req, res, next) {
  try {
    const rows = await bookingModel.findByGuest(req.user.id);
    const bookings = rows.map((row) => ({
      id: row.id,
      listingId: row.listing_id,
      title: row.title,
      checkIn: row.check_in,
      checkOut: row.check_out,
      nights: row.nights,
      guests: row.guests_count,
      totalPrice: Number(row.total_price),
      status: row.status
    }));
    return ok(res, bookings);
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/bookings/:id
async function getBooking(req, res, next) {
  try {
    const bookingId = toWholeNumber(req.params.id, 1, MAX_ID);
    const booking = bookingId ? await bookingModel.findByIdForGuest(bookingId, req.user.id) : null;
    if (!booking) {
      // also 404 if it is someone else's booking, so we don't even say it exists
      return fail(res, 404, 'NOT_FOUND', 'Booking not found.');
    }

    return ok(res, {
      id: booking.id,
      listingId: booking.listing_id,
      title: booking.title,
      hostName: booking.host_name,
      checkIn: booking.check_in,
      checkOut: booking.check_out,
      nights: booking.nights,
      guests: booking.guests_count,
      totalPrice: Number(booking.total_price),
      messageToHost: booking.message_to_host,
      status: booking.status,
      // the home's address is decrypted and shown only after the host confirms
      address: booking.status === 'confirmed' ? decrypt(booking.address_encrypted) : null
    });
  } catch (err) {
    next(err);
  }
}

// POST /api/v1/bookings/:id/cancel   (only before the check-in day)
async function cancelBooking(req, res, next) {
  try {
    const bookingId = toWholeNumber(req.params.id, 1, MAX_ID);
    const booking = bookingId ? await bookingModel.findByIdForGuest(bookingId, req.user.id) : null;
    if (!booking) {
      return fail(res, 404, 'NOT_FOUND', 'Booking not found.');
    }

    if (booking.status !== 'pending' && booking.status !== 'confirmed') {
      return fail(res, 400, 'CANNOT_CANCEL', `This booking is already ${booking.status}.`);
    }
    if (booking.check_in <= todayString()) {
      return fail(res, 400, 'CANNOT_CANCEL', 'A booking can only be cancelled before the check-in day.');
    }

    // cancelling also frees the nights so other guests can book them
    const changed = await bookingModel.changeStatus(bookingId, booking.status, 'cancelled');
    if (!changed) {
      return fail(res, 409, 'BOOKING_CHANGED', 'This booking was just changed. Please refresh the page.');
    }

    return ok(res, { id: bookingId, status: 'cancelled' });
  } catch (err) {
    next(err);
  }
}

module.exports = { createBooking, getMyBookings, getBooking, cancelBooking };
