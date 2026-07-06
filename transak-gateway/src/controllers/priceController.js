const transakClient = require('../services/transakClient');

async function getQuote(req, res, next) {
  try {
    const {
      fiatCurrency,
      cryptoCurrency,
      fiatAmount,
      cryptoAmount,
      isBuyOrSell = 'BUY',
      network,
      paymentMethod,
    } = req.query;

    if (!fiatCurrency || !cryptoCurrency) {
      return res.status(400).json({ error: 'fiatCurrency and cryptoCurrency are required' });
    }
    if (!fiatAmount && !cryptoAmount) {
      return res.status(400).json({ error: 'Provide either fiatAmount or cryptoAmount' });
    }

    const quote = await transakClient.getPriceQuote({
      fiatCurrency,
      cryptoCurrency,
      fiatAmount,
      cryptoAmount,
      isBuyOrSell,
      network,
      paymentMethod,
    });

    return res.json({ quote });
  } catch (err) {
    return next(err);
  }
}

async function listCryptoCurrencies(req, res, next) {
  try {
    const currencies = await transakClient.getCryptoCurrencies();
    return res.json({ currencies });
  } catch (err) {
    return next(err);
  }
}

async function listFiatCurrencies(req, res, next) {
  try {
    const currencies = await transakClient.getFiatCurrencies();
    return res.json({ currencies });
  } catch (err) {
    return next(err);
  }
}

module.exports = { getQuote, listCryptoCurrencies, listFiatCurrencies };
