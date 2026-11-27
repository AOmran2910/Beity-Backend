const db = require('../config/db');

// Saves the booking and all its nights together (a transaction): all or nothing.
// If one night is already in calendar_nights, MySQL refuses it because of the primary key
// (error ER_DUP_ENTRY), we roll back, and nothing is saved.
async function createBooking(booking, nights) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute(
      `INSERT INTO bookings
         (listing_id, guest_id, check_in, check_out, nights, guests_count, total_price, message_to_host, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 24 HOUR))`,
      [
        booking.listingId,
        booking.guestId,
        booking.checkIn,
        booking.checkOut,
        nights.length,
        booking.guests,
        booking.totalPrice,
        booking.messageToHost
      ]
    );
    const bookingId = result.insertId;

    for (const night of nights) {
      await conn.execute('INSERT INTO calendar_nights (listing_id, night_date, booking_id) VALUES (?, ?, ?)', [
        booking.listingId,
        night,
        bookingId
      ]);
    }

    await conn.commit();
    return bookingId;
  } catch (err) {
    await conn.rollback();
    throw err; // the controller turns ER_DUP_ENTRY into 409 Conflict
  } finally {
    conn.release();
  }
}

// Changes the status only if it is still what we expect, so two people can't change it at once.
// When a booking ends (declined, cancelled or expired) its nights become free again.
async function changeStatus(bookingId, fromStatus, toStatus) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [result] = await conn.execute('UPDATE bookings SET status = ? WHERE id = ? AND status = ?', [
      toStatus,
      bookingId,
      fromStatus
    ]);
    const changed = result.affectedRows === 1;

    if (changed && toStatus !== 'confirmed') {
      await conn.execute('DELETE FROM calendar_nights WHERE booking_id = ?', [bookingId]);
    }

    await conn.commit();
    return changed;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// ---------- for the guest ----------

async function findByGuest(guestId) {
  const [rows] = await db.execute(
    `SELECT b.id, b.listing_id, l.title, b.check_in, b.check_out, b.nights, b.guests_count,
            b.total_price, b.status, b.created_at
     FROM bookings b
     JOIN listings l ON l.id = b.listing_id
     WHERE b.guest_id = ?
     ORDER BY b.created_at DESC`,
    [guestId]
  );
  return rows;
}

// "AND b.guest_id = ?" means a guest can only open their own bookings
async function findByIdForGuest(bookingId, guestId) {
  const [rows] = await db.execute(
    `SELECT b.*, l.title, l.address_encrypted, u.full_name AS host_name
     FROM bookings b
     JOIN listings l ON l.id = b.listing_id
     JOIN users u ON u.id = l.host_id
     WHERE b.id = ? AND b.guest_id = ?`,
    [bookingId, guestId]
  );
  return rows[0] || null;
}

// ---------- for the host ----------

async function findForHost(hostId) {
  const [rows] = await db.execute(
    `SELECT b.id, b.listing_id, l.title, u.full_name AS guest_name, b.check_in, b.check_out,
            b.nights, b.guests_count, b.total_price, b.message_to_host, b.status, b.expires_at
     FROM bookings b
     JOIN listings l ON l.id = b.listing_id
     JOIN users u ON u.id = b.guest_id
     WHERE l.host_id = ?
     ORDER BY b.created_at DESC`,
    [hostId]
  );
  return rows;
}

// Only finds the booking if it is for one of this host's homes
async function findByIdForHost(bookingId, hostId) {
  const [rows] = await db.execute(
    `SELECT b.id, b.status, (b.expires_at < NOW()) AS is_expired
     FROM bookings b
     JOIN listings l ON l.id = b.listing_id
     WHERE b.id = ? AND l.host_id = ?`,
    [bookingId, hostId]
  );
  return rows[0] || null;
}

// Clean-up job: requests the host did not answer within 24 hours become 'expired'
async function expireOldBookings() {
  const [rows] = await db.execute("SELECT id FROM bookings WHERE status = 'pending' AND expires_at < NOW()");
  for (const row of rows) {
    await changeStatus(row.id, 'pending', 'expired');
  }
  return rows.length;
}

module.exports = {
  createBooking,
  changeStatus,
  findByGuest,
  findByIdForGuest,
  findForHost,
  findByIdForHost,
  expireOldBookings
};
