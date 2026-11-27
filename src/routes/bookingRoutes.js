const express = require('express');
const bookingController = require('../controllers/bookingController');
const { requireLogin, checkCsrf } = require('../middleware/auth');

const router = express.Router();

// any logged-in user can book (guests, and hosts booking someone else's home)
router.use(requireLogin, checkCsrf);

router.post('/', bookingController.createBooking);
router.get('/', bookingController.getMyBookings);
router.get('/:id', bookingController.getBooking);
router.post('/:id/cancel', bookingController.cancelBooking);

module.exports = router;
