const express = require('express');
const hostController = require('../controllers/hostController');
const { requireLogin, requireRole, checkCsrf } = require('../middleware/auth');

const router = express.Router();

// every route here needs: a login, the host role and the CSRF token
router.use(requireLogin, requireRole('host'), checkCsrf);

// Create Listing
router.get('/listings', hostController.getMyListings);
router.post('/listings', hostController.createListing);
router.put('/listings/:id/license', hostController.addLicense);
router.post('/listings/:id/submit', hostController.submitListing);

// Book a Stay (the host answers the request)
router.get('/bookings', hostController.getHostBookings);
router.patch('/bookings/:id', hostController.respondToBooking);

module.exports = router;
