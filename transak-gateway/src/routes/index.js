const express = require('express');

const authRoutes = require('./auth.routes');
const widgetRoutes = require('./widget.routes');
const orderRoutes = require('./order.routes');
const priceRoutes = require('./price.routes');

// Note: webhook routes are NOT mounted here on purpose — they need the raw
// request body for signature verification and are mounted separately in
// server.js, ahead of the global express.json() middleware.

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/widget', widgetRoutes);
router.use('/orders', orderRoutes);
router.use('/prices', priceRoutes);

module.exports = router;
