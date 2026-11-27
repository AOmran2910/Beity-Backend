const listingModel = require('../models/listingModel');
const { ok, fail } = require('../utils/response');
const { toWholeNumber } = require('../utils/validators');
const { getNights, checkBookingDates, calculateTotal } = require('../utils/dates');
const { RECENT_COOKIE, readRecent, addRecent, setRecentCookie } = require('../utils/cookies');

const MAX_ID = 2147483647; // biggest INT in MySQL

// GET /api/v1/listings/:id   (anyone can view a published home)
async function getListing(req, res, next) {
  try {
    const listingId = toWholeNumber(req.params.id, 1, MAX_ID);
    const listing = listingId ? await listingModel.findPublishedById(listingId) : null;
    if (!listing) {
      return fail(res, 404, 'NOT_FOUND', 'This home does not exist.');
    }

    // remember this home in the "recently viewed" cookie
    const recent = addRecent(readRecent(req.cookies[RECENT_COOKIE]), listing.id);
    setRecentCookie(res, recent);

    // the address is not sent here. Guests only see it after a confirmed booking.
    return ok(res, {
      id: listing.id,
      title: listing.title,
      description: listing.description,
      propertyType: listing.property_type,
      destination: listing.destination,
      maxGuests: listing.max_guests,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      basePrice: Number(listing.base_price),
      houseRules: listing.house_rules,
      licenseNumber: listing.license_number,
      licensed: true, // only homes with a checked licence can be published
      hostName: listing.host_name
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/listings/:id/availability?checkIn=2027-07-10&checkOut=2027-07-15
// This is the "Check Availability" step of Book a Stay
async function checkAvailability(req, res, next) {
  try {
    const listingId = toWholeNumber(req.params.id, 1, MAX_ID);
    const listing = listingId ? await listingModel.findPublishedById(listingId) : null;
    if (!listing) {
      return fail(res, 404, 'NOT_FOUND', 'This home does not exist.');
    }

    const checkIn = req.query.checkIn;
    const checkOut = req.query.checkOut;
    const dateError = checkBookingDates(checkIn, checkOut);
    if (dateError) {
      return fail(res, 400, 'VALIDATION_ERROR', dateError);
    }

    const nights = getNights(checkIn, checkOut);
    const takenNights = await listingModel.getTakenNights(listingId, checkIn, checkOut);
    const seasonalPrices = await listingModel.getSeasonalPrices(listingId);

    return ok(res, {
      listingId: listingId,
      checkIn: checkIn,
      checkOut: checkOut,
      nights: nights.length,
      available: takenNights.length === 0,
      takenNights: takenNights,
      totalPrice: calculateTotal(nights, listing.base_price, seasonalPrices)
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/v1/listings/recent   (homes saved in the beity_recent cookie, newest first)
async function getRecentListings(req, res, next) {
  try {
    const ids = readRecent(req.cookies[RECENT_COOKIE]);
    const homes = [];

    for (const id of ids) {
      const listing = await listingModel.findPublishedById(id);
      // skip homes that are not published any more
      if (listing) {
        homes.push({
          id: listing.id,
          title: listing.title,
          destination: listing.destination,
          basePrice: Number(listing.base_price)
        });
      }
    }

    return ok(res, homes);
  } catch (err) {
    next(err);
  }
}

module.exports = { getListing, checkAvailability, getRecentListings };
