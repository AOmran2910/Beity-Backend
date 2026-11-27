const db = require('../config/db');

async function destinationExists(destinationId) {
  const [rows] = await db.execute('SELECT id FROM destinations WHERE id = ?', [destinationId]);
  return rows.length > 0;
}

async function findDestinationBySlug(slug) {
  const [rows] = await db.execute('SELECT id, name, slug FROM destinations WHERE slug = ?', [slug]);
  return rows[0] || null;
}

// Every new home starts as a draft
async function createListing(hostId, home) {
  const [result] = await db.execute(
    `INSERT INTO listings
       (host_id, destination_id, title, description, property_type, address_encrypted,
        max_guests, bedrooms, bathrooms, base_price, house_rules)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      hostId,
      home.destinationId,
      home.title,
      home.description,
      home.propertyType,
      home.addressEncrypted,
      home.maxGuests,
      home.bedrooms,
      home.bathrooms,
      home.basePrice,
      home.houseRules
    ]
  );
  return result.insertId;
}

// "AND host_id = ?" makes sure a host can only reach their own homes
async function findByIdForHost(listingId, hostId) {
  const [rows] = await db.execute('SELECT * FROM listings WHERE id = ? AND host_id = ?', [listingId, hostId]);
  return rows[0] || null;
}

async function findByHost(hostId) {
  const [rows] = await db.execute(
    `SELECT id, title, status, license_number, base_price, rejection_reason, created_at
     FROM listings
     WHERE host_id = ?
     ORDER BY created_at DESC`,
    [hostId]
  );
  return rows;
}

async function setLicense(listingId, licenseNumber) {
  await db.execute('UPDATE listings SET license_number = ? WHERE id = ?', [licenseNumber, listingId]);
}

async function setStatus(listingId, status, rejectionReason) {
  await db.execute('UPDATE listings SET status = ?, rejection_reason = ? WHERE id = ?', [
    status,
    rejectionReason || null,
    listingId
  ]);
}

async function findById(listingId) {
  const [rows] = await db.execute('SELECT * FROM listings WHERE id = ?', [listingId]);
  return rows[0] || null;
}

// Public view of a home. Only published homes can be seen, and the address is not included.
async function findPublishedById(listingId) {
  const [rows] = await db.execute(
    `SELECT l.id, l.host_id, l.title, l.description, l.property_type, l.max_guests, l.bedrooms,
            l.bathrooms, l.base_price, l.house_rules, l.license_number,
            d.name AS destination, u.full_name AS host_name
     FROM listings l
     JOIN destinations d ON d.id = l.destination_id
     JOIN users u ON u.id = l.host_id
     WHERE l.id = ? AND l.status = 'published'`,
    [listingId]
  );
  return rows[0] || null;
}

// For the admin: homes waiting for a decision
async function findWaitingForReview() {
  const [rows] = await db.execute(
    `SELECT l.id, l.title, l.license_number, l.created_at, u.full_name AS host_name, u.email AS host_email
     FROM listings l
     JOIN users u ON u.id = l.host_id
     WHERE l.status = 'pending_review'
     ORDER BY l.created_at`
  );
  return rows;
}

async function getSeasonalPrices(listingId) {
  const [rows] = await db.execute(
    'SELECT name, start_date, end_date, price_per_night FROM seasonal_prices WHERE listing_id = ?',
    [listingId]
  );
  return rows;
}

// Nights that are already booked or blocked between two dates (check-out day not included)
async function getTakenNights(listingId, fromDate, toDate) {
  const [rows] = await db.execute(
    `SELECT night_date FROM calendar_nights
     WHERE listing_id = ? AND night_date >= ? AND night_date < ?
     ORDER BY night_date`,
    [listingId, fromDate, toDate]
  );
  return rows.map((row) => row.night_date);
}

module.exports = {
  destinationExists,
  findDestinationBySlug,
  createListing,
  findByIdForHost,
  findByHost,
  setLicense,
  setStatus,
  findById,
  findPublishedById,
  findWaitingForReview,
  getSeasonalPrices,
  getTakenNights
};
