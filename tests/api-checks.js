// API checks for Milestone 4.
// Goes through login, Create Listing and Book a Stay like a real user would,
// and checks that the security rules work.
//
// How to run:
//   1. npm run seed      (adds the admin, the host and the sample home)
//   2. npm start         (in another terminal)
//   3. npm run test:api

require('dotenv').config();

// Our local certificate is self-signed, so Node would refuse the connection.
// This line is ONLY for testing on our own computer.
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const BASE = process.env.API_URL || `https://localhost:${process.env.HTTPS_PORT || 3443}/api/v1`;

let passed = 0;
let failed = 0;

function check(name, condition, extra) {
  if (condition) {
    passed++;
    console.log('  PASS  ' + name);
  } else {
    failed++;
    console.log('  FAIL  ' + name + (extra ? '\n        got: ' + JSON.stringify(extra) : ''));
  }
}

// Each user keeps their own cookies and CSRF token, like a browser would
// (cookie = the login cookie, other = beity_prefs and beity_recent)
function newUser() {
  return { cookie: null, csrf: null, other: {} };
}

async function call(user, method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  const cookies = [];
  if (user && user.cookie) cookies.push(user.cookie);
  if (user && user.other) cookies.push(...Object.values(user.other));
  if (cookies.length > 0) headers['Cookie'] = cookies.join('; ');
  if (user && user.csrf) headers['X-CSRF-Token'] = user.csrf;

  const res = await fetch(BASE + path, {
    method: method,
    headers: headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
  });

  // remember the cookies the server sent
  let sessionCookie = null;
  const setCookies = res.headers.getSetCookie();
  for (const cookie of setCookies) {
    const value = cookie.split(';')[0];
    const name = value.split('=')[0];
    if (name === '__Host-beity_sid') {
      sessionCookie = cookie;
      if (user) user.cookie = value.endsWith('=') ? null : value; // "name=" means the cookie was cleared
    } else if (user && user.other) {
      user.other[name] = value;
    }
  }

  const json = await res.json();
  if (user && json.data && json.data.csrfToken) {
    user.csrf = json.data.csrfToken;
  }

  return { status: res.status, body: json, cookie: sessionCookie, setCookies: setCookies, headers: res.headers };
}

function addDays(dateText, days) {
  const date = new Date(dateText + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function main() {
  console.log('Testing ' + BASE + '\n');
  const stamp = Date.now(); // makes emails unique, so the test can run many times
  let r;

  // ------------------------------------------------------------------
  console.log('1. Sign up, log in and sessions');

  const guest = newUser();
  const guestEmail = `mariam${stamp}@beity.test`;
  r = await call(guest, 'POST', '/auth/signup', {
    fullName: 'Mariam Hassan',
    email: guestEmail,
    password: 'Sahel-Summer-2027',
    phone: '+201112223334',
    role: 'admin' // trying to make herself an admin
  });
  check('Sign up a new guest -> 201', r.status === 201, r.body);
  check('The extra "role" field is ignored (she is a guest)', r.body.data && r.body.data.role === 'guest');
  check(
    'Session cookie is HttpOnly, Secure and SameSite=Strict',
    r.cookie && /HttpOnly/i.test(r.cookie) && /Secure/i.test(r.cookie) && /SameSite=Strict/i.test(r.cookie),
    r.cookie
  );

  r = await call(null, 'POST', '/auth/signup', { fullName: 'Test User', email: `weak${stamp}@beity.test`, password: '12345' });
  check('Weak password is refused -> 400', r.status === 400, r.body);

  r = await call(null, 'POST', '/auth/signup', { fullName: 'Mariam Hassan', email: guestEmail, password: 'Sahel-Summer-2027' });
  check('Same email twice -> 409', r.status === 409, r.body);

  r = await call(null, 'GET', '/auth/me');
  check('No cookie -> 401', r.status === 401, r.body);

  r = await call(guest, 'GET', '/auth/me');
  check('With the cookie -> 200, and the phone is decrypted', r.status === 200 && r.body.data.phone === '+201112223334', r.body);

  const wrongPassword = await call(null, 'POST', '/auth/login', { email: guestEmail, password: 'Wrong-pass-123' });
  const noAccount = await call(null, 'POST', '/auth/login', { email: `nobody${stamp}@beity.test`, password: 'Wrong-pass-123' });
  check(
    'Wrong password and unknown email get the same 401 message',
    wrongPassword.status === 401 && noAccount.status === 401 && wrongPassword.body.error.message === noAccount.body.error.message
  );

  r = await call(null, 'POST', '/auth/login', { email: "' OR '1'='1' -- ", password: "' OR '1'='1" });
  check('SQL injection text in the login form is treated as plain text -> 401', r.status === 401, r.body);

  // ------------------------------------------------------------------
  console.log('\n2. Use case: Create Listing');

  const host = newUser();
  r = await call(host, 'POST', '/auth/login', { email: 'host@beity.test', password: 'Host-Pass-2026' });
  check('Host logs in -> 200', r.status === 200 && r.body.data.role === 'host', r.body);

  const newHome = {
    title: 'Family apartment near the marina',
    description: 'Bright two-bedroom apartment, ten minutes walk from the beach and the marina.',
    destinationId: 3,
    propertyType: 'apartment',
    address: 'Building 7, Abu Tig Marina, El Gouna',
    maxGuests: 4,
    bedrooms: 2,
    bathrooms: 1,
    basePrice: 3200,
    houseRules: 'No parties. No smoking inside.'
  };

  r = await call({ cookie: host.cookie, csrf: null }, 'POST', '/host/listings', newHome);
  check('Request without the CSRF token -> 403', r.status === 403 && r.body.error.code === 'CSRF_FAILED', r.body);

  r = await call(guest, 'POST', '/host/listings', newHome);
  check('A guest can not add a home -> 403', r.status === 403, r.body);

  r = await call(host, 'POST', '/host/listings', { ...newHome, maxGuests: 50, basePrice: -10 });
  check('Wrong details are refused -> 400', r.status === 400, r.body);

  r = await call(host, 'POST', '/host/listings', newHome);
  check('Host saves the home as a draft -> 201', r.status === 201 && r.body.data.status === 'draft', r.body);
  const listingId = r.body.data ? r.body.data.id : 0;

  r = await call(host, 'POST', `/host/listings/${listingId}/submit`);
  check('Submit without a licence -> 400', r.status === 400 && r.body.error.code === 'LICENSE_MISSING', r.body);

  r = await call(host, 'PUT', `/host/listings/${listingId}/license`, { licenseNumber: 'TEC-2026-00118' });
  check('Licence already used by another home -> 409', r.status === 409, r.body);

  r = await call(host, 'PUT', `/host/listings/${listingId}/license`, { licenseNumber: 'TEC-2026-' + String(stamp).slice(-6) });
  check('Host adds the licence number -> 200', r.status === 200, r.body);

  r = await call(host, 'POST', `/host/listings/${listingId}/submit`);
  check('Host submits the home -> pending_review', r.status === 200 && r.body.data.status === 'pending_review', r.body);

  r = await call(null, 'GET', `/listings/${listingId}`);
  check('The home is not public before an admin approves it -> 404', r.status === 404, r.body);

  const admin = newUser();
  r = await call(admin, 'POST', '/auth/login', { email: 'admin@beity.test', password: 'Admin-Pass-2026' });
  check('Admin logs in -> 200', r.status === 200, r.body);

  r = await call(admin, 'GET', '/admin/listings');
  check('Admin sees the home in the review list', r.status === 200 && r.body.data.some((l) => l.id === listingId), r.body);

  r = await call(admin, 'PATCH', `/admin/listings/${listingId}`, { action: 'approve' });
  check('Admin approves the home -> published', r.status === 200 && r.body.data.status === 'published', r.body);

  r = await call(null, 'GET', `/listings/${listingId}`);
  check(
    'The home is public now, licensed, and the address is hidden',
    r.status === 200 && r.body.data.licensed === true && r.body.data.address === undefined,
    r.body
  );

  // ------------------------------------------------------------------
  console.log('\n3. Use case: Book a Stay');

  // a random week in summer 2027, so the test can be run many times
  const checkIn = addDays('2027-06-01', Math.floor(Math.random() * 100));
  const checkOut = addDays(checkIn, 5);

  r = await call(null, 'GET', `/listings/${listingId}/availability?checkIn=${checkIn}&checkOut=${checkOut}`);
  check(
    'Check availability -> free, 5 nights x 3,200 = 16,000 EGP',
    r.status === 200 && r.body.data.available === true && r.body.data.totalPrice === 16000,
    r.body
  );

  r = await call(null, 'GET', '/listings/1/availability?checkIn=2027-07-10&checkOut=2027-07-15');
  check('Summer price is used: 5 nights x 6,300 = 31,500 EGP (Milestone 3 example)', r.status === 200 && r.body.data.totalPrice === 31500, r.body);

  r = await call(guest, 'POST', '/bookings', { listingId, checkIn, checkOut, guests: 10 });
  check('More guests than the home allows -> 400', r.status === 400, r.body);

  r = await call(guest, 'POST', '/bookings', { listingId, checkIn: '2020-01-01', checkOut: '2020-01-05', guests: 2 });
  check('Dates in the past -> 400', r.status === 400, r.body);

  r = await call(guest, 'POST', '/bookings', {
    listingId,
    checkIn,
    checkOut,
    guests: 3,
    totalPrice: 1, // trying to pay 1 EGP
    messageToHost: 'We are a family of three.'
  });
  check('Guest books the home -> 201 pending', r.status === 201 && r.body.data.status === 'pending', r.body);
  check('The price sent by the browser is ignored (server says 16,000)', r.body.data && r.body.data.totalPrice === 16000, r.body);
  const bookingId = r.body.data ? r.body.data.id : 0;

  const guest2 = newUser();
  const guest2Email = `karim${stamp}@beity.test`;
  await call(guest2, 'POST', '/auth/signup', { fullName: 'Karim Adel', email: guest2Email, password: 'Dahab-Winter-2027' });

  r = await call(guest2, 'POST', '/bookings', { listingId, checkIn: addDays(checkIn, 3), checkOut: addDays(checkIn, 6), guests: 2 });
  check('A second guest asks for some of the same nights -> 409 (no double booking)', r.status === 409, r.body);

  r = await call(guest2, 'POST', '/bookings', { listingId, checkIn: checkOut, checkOut: addDays(checkOut, 2), guests: 2 });
  check('Arriving on the first guest\'s check-out day is fine -> 201', r.status === 201, r.body);
  const booking2Id = r.body.data ? r.body.data.id : 0;

  r = await call(guest2, 'GET', `/bookings/${bookingId}`);
  check("Opening another user's booking -> 404", r.status === 404, r.body);

  r = await call(guest, 'GET', `/bookings/${bookingId}`);
  check('The address is hidden while the booking is pending', r.status === 200 && r.body.data.address === null, r.body);

  r = await call(host, 'GET', '/host/bookings');
  check('Host sees the booking request', r.status === 200 && r.body.data.some((b) => b.id === bookingId), r.body);

  r = await call(host, 'PATCH', `/host/bookings/${bookingId}`, { action: 'accept' });
  check('Host accepts -> confirmed', r.status === 200 && r.body.data.status === 'confirmed', r.body);

  r = await call(guest, 'GET', `/bookings/${bookingId}`);
  check('After confirmation the guest sees the decrypted address', r.status === 200 && r.body.data.address === newHome.address, r.body);

  r = await call(host, 'PATCH', `/host/bookings/${booking2Id}`, { action: 'decline' });
  check('Host declines the second request -> declined', r.status === 200 && r.body.data.status === 'declined', r.body);

  r = await call(guest, 'POST', `/bookings/${bookingId}/cancel`);
  check('Guest cancels before check-in -> cancelled', r.status === 200 && r.body.data.status === 'cancelled', r.body);

  r = await call(null, 'GET', `/listings/${listingId}/availability?checkIn=${checkIn}&checkOut=${checkOut}`);
  check('The nights are free again after cancelling', r.status === 200 && r.body.data.available === true, r.body);

  // ------------------------------------------------------------------
  console.log('\n4. Security');

  for (let i = 1; i <= 5; i++) {
    await call(null, 'POST', '/auth/login', { email: guest2Email, password: 'Wrong-pass-' + i });
  }
  r = await call(null, 'POST', '/auth/login', { email: guest2Email, password: 'Dahab-Winter-2027' });
  check('After 5 wrong passwords the account is locked, even the right password gets 401', r.status === 401, r.body);

  r = await call(admin, 'GET', '/admin/security-logs?event=LOGIN_FAILED');
  const firstLog = r.body.data && r.body.data[0];
  check('Failed logins are in the security log with IP and time', r.status === 200 && firstLog && firstLog.ipAddress && firstLog.time, firstLog);

  r = await call(admin, 'GET', '/admin/security-logs?event=ACCOUNT_LOCKED');
  check('The account lock is in the security log', r.status === 200 && r.body.data.some((l) => l.email === guest2Email), r.body);

  r = await call(guest, 'GET', '/admin/security-logs');
  check('A guest can not read the security log -> 403', r.status === 403, r.body);

  r = await call(null, 'POST', '/auth/login', '{"email": "broken json');
  check('Broken JSON -> 400', r.status === 400, r.body);

  check(
    'Security headers are sent (HSTS, nosniff, no X-Powered-By)',
    r.headers.get('strict-transport-security') && r.headers.get('x-content-type-options') === 'nosniff' && !r.headers.get('x-powered-by')
  );

  const oldCookie = guest.cookie;
  r = await call(guest, 'POST', '/auth/logout');
  check('Logout -> 200 and the cookie is cleared', r.status === 200 && guest.cookie === null, r.body);

  r = await call({ cookie: oldCookie, csrf: null }, 'GET', '/auth/me');
  check('The old cookie does not work after logout -> 401', r.status === 401, r.body);

  // ------------------------------------------------------------------
  console.log('\n5. Preference and "recently viewed" cookies');

  const visitor = newUser(); // not logged in
  r = await call(visitor, 'PUT', '/preferences', { language: 'ar', lastDestination: 'north-coast' });
  const prefsCookie = r.setCookies.find((c) => c.startsWith('beity_prefs=')) || '';
  check('Save preferences -> 200', r.status === 200 && r.body.data.language === 'ar', r.body);
  check(
    'beity_prefs is HttpOnly, Secure, SameSite=Lax and lasts 180 days',
    /HttpOnly/i.test(prefsCookie) && /Secure/i.test(prefsCookie) && /SameSite=Lax/i.test(prefsCookie) && /Max-Age=15552000/.test(prefsCookie),
    prefsCookie
  );

  r = await call(visitor, 'GET', '/preferences');
  check('Preferences are read back from the cookie', r.status === 200 && r.body.data.lastDestination === 'north-coast', r.body);

  r = await call(visitor, 'PUT', '/preferences', { language: 'fr' });
  check('A language that is not allowed -> 400', r.status === 400, r.body);

  await call(visitor, 'GET', '/listings/1');
  r = await call(visitor, 'GET', `/listings/${listingId}`);
  const recentCookie = r.setCookies.find((c) => c.startsWith('beity_recent=')) || '';
  check('Viewing a home sets beity_recent (30 days)', /Max-Age=2592000/.test(recentCookie) && /SameSite=Lax/i.test(recentCookie), recentCookie);

  r = await call(visitor, 'GET', '/listings/recent');
  check(
    'Recently viewed homes come back newest first',
    r.status === 200 && r.body.data.length === 2 && r.body.data[0].id === listingId && r.body.data[1].id === 1,
    r.body
  );

  // ------------------------------------------------------------------
  console.log(`\nResult: ${passed} passed, ${failed} failed`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((err) => {
  console.error('\nCould not finish the tests:', err.message);
  console.error('Is the server running? (npm start)');
  process.exitCode = 1;
});
