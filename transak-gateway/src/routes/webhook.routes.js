const express = require('express');
const webhookController = require('../controllers/webhookController');

const router = express.Router();

// application/json is deliberately parsed as a raw Buffer here (not
// express.json()) because the webhook signature must be verified against
// the exact raw bytes Transak sent — re-serializing a parsed object can
// produce different bytes and break HMAC verification.
router.post(
  '/transak',
  express.raw({ type: 'application/json', limit: '1mb' }),
  webhookController.handleTransakWebhook
);

module.exports = router;
