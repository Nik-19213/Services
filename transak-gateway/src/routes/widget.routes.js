const express = require('express');
const { requireAuth } = require('../middleware/auth');
const widgetController = require('../controllers/widgetController');

const router = express.Router();

router.post('/session', requireAuth, widgetController.createSession);

module.exports = router;
