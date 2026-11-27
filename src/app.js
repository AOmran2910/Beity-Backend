const express = require('express');
const cookieParser = require('cookie-parser');

const securityHeaders = require('./middleware/securityHeaders');
const rateLimit = require('./middleware/rateLimit');
const errorHandler = require('./middleware/errorHandler');
const { fail } = require('./utils/response');

const authRoutes = require('./routes/authRoutes');
const listingRoutes = require('./routes/listingRoutes');
const hostRoutes = require('./routes/hostRoutes');
const bookingRoutes = require('./routes/bookingRoutes');
const adminRoutes = require('./routes/adminRoutes');
const preferenceRoutes = require('./routes/preferenceRoutes');

const app = express();

// behind a cloud host (Render, Railway...) this makes req.ip the real user IP
if (process.env.TRUST_PROXY === 'true') {
  app.set('trust proxy', 1);
}
app.disable('x-powered-by'); // don't tell attackers we use Express

// middleware that runs for every request, in this order
app.use(securityHeaders);
app.use(express.json({ limit: '10kb' })); // JSON only, and small bodies only
app.use(cookieParser());
app.use('/api/v1', rateLimit(1000, 15)); // 1000 requests per 15 minutes for each IP

// routes
app.use('/api/v1/auth', rateLimit(100, 15), authRoutes); // stricter limit on login and sign up
app.use('/api/v1/listings', listingRoutes);
app.use('/api/v1/host', hostRoutes);
app.use('/api/v1/bookings', bookingRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/preferences', preferenceRoutes);

// nothing matched
app.use((req, res) => {
  fail(res, 404, 'NOT_FOUND', 'This endpoint does not exist.');
});

app.use(errorHandler);

module.exports = app;
