const config = require('../config');
const orderService = require('../services/orderService');
const transakClient = require('../services/transakClient');

const VALID_TYPES = ['BUY', 'SELL'];

/**
 * POST /api/v1/widget/session
 *
 * Creates a local order record (status CREATED), then asks Transak's
 * create-widget-session API to mint a ready-to-use widgetUrl (Transak
 * deprecated building this URL by hand from query params — see
 * docs.transak.com/api/public/create-widget-url). The API secret never
 * leaves this backend.
 */
async function createSession(req, res, next) {
  try {
    const {
      type, // 'BUY' or 'SELL'
      fiatCurrency,
      fiatAmount,
      cryptoCurrency,
      network,
      walletAddress,
      paymentMethod,
      redirectUrl,
      userEmail,
    } = req.body;

    if (!VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `type must be one of ${VALID_TYPES.join(', ')}` });
    }
    if (!cryptoCurrency) {
      return res.status(400).json({ error: 'cryptoCurrency is required' });
    }
    if (type === 'SELL' && !walletAddress) {
      return res
        .status(400)
        .json({ error: 'walletAddress is required for SELL (source of the crypto being sold)' });
    }

    const order = await orderService.createPendingOrder({
      userId: req.userId,
      orderType: type,
      fiatCurrency,
      fiatAmount,
      cryptoCurrency,
      network,
      walletAddress,
      paymentMethod,
      redirectUrl,
    });

    const widgetParams = {
      apiKey: config.transak.apiKey,
      referrerDomain: config.transak.referrerDomain,
      productsAvailed: type,
      partnerOrderId: order.partner_order_id,
      fiatCurrency,
      fiatAmount,
      cryptoCurrencyCode: cryptoCurrency,
      network,
      walletAddress,
      paymentMethod,
      redirectURL: redirectUrl,
      email: userEmail,
    };

    const cleanParams = Object.fromEntries(
      Object.entries(widgetParams).filter(([, v]) => v !== undefined && v !== null && v !== '')
    );

    const widgetUrl = await transakClient.createWidgetSession(cleanParams, req.ip);

    return res.status(201).json({
      partnerOrderId: order.partner_order_id,
      widgetUrl,
    });
  } catch (err) {
    return next(err);
  }
}

module.exports = { createSession };
