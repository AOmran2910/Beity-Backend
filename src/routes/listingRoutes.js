const express = require('express');
const listingController = require('../controllers/listingController');

const router = express.Router();

// public: no login needed
// ('/recent' must come before '/:id', or Express would think "recent" is an id)
router.get('/recent', listingController.getRecentListings);
router.get('/:id', listingController.getListing);
router.get('/:id/availability', listingController.checkAvailability);

module.exports = router;
