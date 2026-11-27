// Adds test data: one admin, one verified host and one published home.
// Run it once after schema.sql:  npm run seed
// (It is safe to run again, it skips anything that already exists.)

require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/config/db');
const { encrypt } = require('../src/utils/security');

// Test accounts for the demo only. Use other passwords on a real server.
const ADMIN = { fullName: 'Beity Admin', email: 'admin@beity.test', password: 'Admin-Pass-2026' };
const HOST = { fullName: 'Omar Fathy', email: 'host@beity.test', password: 'Host-Pass-2026', phone: '+201001234567' };

async function addUser(user, role) {
  const [rows] = await db.execute('SELECT id FROM users WHERE email = ?', [user.email]);
  if (rows.length > 0) {
    console.log(`${user.email} already exists`);
    return rows[0].id;
  }

  const passwordHash = await bcrypt.hash(user.password, 12);
  const [result] = await db.execute(
    'INSERT INTO users (full_name, email, phone_encrypted, password_hash, role) VALUES (?, ?, ?, ?, ?)',
    [user.fullName, user.email, encrypt(user.phone), passwordHash, role]
  );
  console.log(`Added ${role}: ${user.email}`);
  return result.insertId;
}

async function addSampleHome(hostId) {
  const licenseNumber = 'TEC-2026-00118';
  const [existing] = await db.execute('SELECT id FROM listings WHERE license_number = ?', [licenseNumber]);
  if (existing.length > 0) {
    console.log('Sample home already exists');
    return;
  }

  const [destinations] = await db.execute("SELECT id FROM destinations WHERE slug = 'north-coast'");

  const [result] = await db.execute(
    `INSERT INTO listings
       (host_id, destination_id, title, description, property_type, address_encrypted,
        max_guests, bedrooms, bathrooms, base_price, house_rules, license_number, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')`,
    [
      hostId,
      destinations[0].id,
      'Sea-view chalet',
      'Two-bedroom chalet with a sea view, five minutes walk from the beach.',
      'chalet',
      encrypt('Chalet 14, Sea View Resort, km 125 Alexandria-Matrouh Road'),
      4,
      2,
      1,
      5500,
      'No parties. Quiet hours after midnight.',
      licenseNumber
    ]
  );

  // summer price, same example as Milestone 3: 6,300 EGP x 5 nights = 31,500 EGP
  await db.execute(
    'INSERT INTO seasonal_prices (listing_id, name, start_date, end_date, price_per_night) VALUES (?, ?, ?, ?, ?)',
    [result.insertId, 'Summer 2027', '2027-06-01', '2027-09-30', 6300]
  );

  console.log(`Added sample home with id ${result.insertId}`);
}

async function main() {
  await addUser(ADMIN, 'admin');
  const hostId = await addUser(HOST, 'host');
  await addSampleHome(hostId);
  await db.end();
  console.log('Seed finished.');
}

main().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
