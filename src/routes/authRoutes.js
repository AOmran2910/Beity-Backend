const express = require('express');
const authController = require('../controllers/authController');
const { requireLogin, checkCsrf } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.post('/logout', requireLogin, checkCsrf, authController.logout);
router.get('/me', requireLogin, authController.me);

module.exports = router;
