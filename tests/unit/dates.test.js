// Unit tests for nights and prices (Book a Stay)
const test = require('node:test');
const assert = require('node:assert');
const { getNights, checkBookingDates, calculateTotal } = require('../../src/utils/dates');

test('10 to 15 July is 5 nights, and the check-out day is not a night', () => {
  const nights = getNights('2027-07-10', '2027-07-15');
  assert.deepStrictEqual(nights, ['2027-07-10', '2027-07-11', '2027-07-12', '2027-07-13', '2027-07-14']);
});

test('nights work across the end of a month', () => {
  assert.deepStrictEqual(getNights('2027-06-29', '2027-07-02'), ['2027-06-29', '2027-06-30', '2027-07-01']);
});

test('booking date rules', () => {
  assert.strictEqual(checkBookingDates('2027-07-10', '2027-07-15'), null);
  assert.ok(checkBookingDates('2020-01-01', '2020-01-05')); // in the past
  assert.ok(checkBookingDates('2027-07-15', '2027-07-10')); // check-out before check-in
  assert.ok(checkBookingDates('2027-07-10', '2027-07-10')); // 0 nights
  assert.ok(checkBookingDates('2027-07-01', '2027-08-15')); // more than 30 nights
  assert.ok(checkBookingDates('2027-02-30', '2027-03-02')); // date does not exist
});

const summer = [{ start_date: '2027-06-01', end_date: '2027-09-30', price_per_night: '6300.00' }];

test('summer price: 5 nights x 6,300 = 31,500 EGP (Milestone 3 example)', () => {
  assert.strictEqual(calculateTotal(getNights('2027-07-10', '2027-07-15'), '5500.00', summer), 31500);
});

test('normal price outside the season', () => {
  assert.strictEqual(calculateTotal(getNights('2027-11-01', '2027-11-04'), '5500.00', summer), 16500);
});

test('a stay that starts before the season mixes both prices', () => {
  // 30 and 31 May at 5,500 + 1 and 2 June at 6,300
  assert.strictEqual(calculateTotal(getNights('2027-05-30', '2027-06-03'), 5500, summer), 23600);
});
