const { isValidDate } = require('./validators');

// Helpers for booking dates. Dates are always text like '2027-07-10'.
// We use UTC so the result is the same on every computer.

const MAX_NIGHTS = 30;

// Gives the list of nights between check-in and check-out.
// The check-out day is not a night, so 10 July -> 15 July gives 5 nights.
function getNights(checkIn, checkOut) {
  const nights = [];
  const day = new Date(checkIn + 'T00:00:00Z');
  const end = new Date(checkOut + 'T00:00:00Z');

  while (day < end) {
    nights.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return nights;
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

// Checks booking dates. Returns an error message, or null if the dates are fine.
// (Dates written as YYYY-MM-DD can be compared as text.)
function checkBookingDates(checkIn, checkOut) {
  if (!isValidDate(checkIn) || !isValidDate(checkOut)) {
    return 'Dates must be real dates written as YYYY-MM-DD.';
  }
  if (checkIn < todayString()) {
    return 'Check-in can not be in the past.';
  }
  if (checkOut <= checkIn) {
    return 'Check-out must be after check-in.';
  }
  if (getNights(checkIn, checkOut).length > MAX_NIGHTS) {
    return 'You can book up to ' + MAX_NIGHTS + ' nights.';
  }
  return null;
}

// Works out the total price. Each night uses the seasonal price if there is one
// for that date (like a summer price), otherwise the normal price.
function calculateTotal(nights, basePrice, seasonalPrices) {
  let total = 0;

  for (const night of nights) {
    let price = Number(basePrice);
    for (const season of seasonalPrices) {
      if (night >= season.start_date && night <= season.end_date) {
        price = Number(season.price_per_night);
      }
    }
    total += price;
  }

  return Math.round(total * 100) / 100;
}

module.exports = { getNights, todayString, checkBookingDates, calculateTotal };
