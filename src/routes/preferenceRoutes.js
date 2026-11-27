const express = require('express');
const preferenceController = require('../controllers/preferenceController');

const router = express.Router();

// public: language and last search are saved for visitors too
router.get('/', preferenceController.getPreferences);
router.put('/', preferenceController.savePreferences);

module.exports = router;
