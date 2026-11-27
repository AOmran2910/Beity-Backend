const express = require('express');
const adminController = require('../controllers/adminController');
const { requireLogin, requireRole, checkCsrf } = require('../middleware/auth');

const router = express.Router();

router.use(requireLogin, requireRole('admin'), checkCsrf);

router.get('/listings', adminController.getListingsForReview);
router.patch('/listings/:id', adminController.reviewListing);
router.get('/security-logs', adminController.getSecurityLogs);

module.exports = router;
