const express = require('express');
const priceController = require('../controllers/priceController');

const router = express.Router();

router.get('/quote', priceController.getQuote);
router.get('/currencies/crypto', priceController.listCryptoCurrencies);
router.get('/currencies/fiat', priceController.listFiatCurrencies);

module.exports = router;
