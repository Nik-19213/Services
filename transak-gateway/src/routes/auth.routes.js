const express = require('express');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');

const router = express.Router();

// Tighter than the global API limiter — signup/login are the endpoints most
// worth slowing down against credential-stuffing / brute-force attempts.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many attempts, please try again later' },
});

router.post('/signup', authLimiter, authController.signup);
router.post('/login', authLimiter, authController.login);

module.exports = router;
