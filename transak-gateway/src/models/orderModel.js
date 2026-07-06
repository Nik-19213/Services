const { query } = require('../config/database');

async function createOrder({
  partnerOrderId,
  userId,
  orderType,
  fiatCurrency,
  fiatAmount,
  cryptoCurrency,
  network,
  walletAddress,
  paymentMethod,
  redirectUrl,
}) {
  const result = await query(
    `INSERT INTO orders
       (partner_order_id, user_id, order_type, status, fiat_currency, fiat_amount,
        crypto_currency, network, wallet_address, payment_method, redirect_url)
     VALUES ($1, $2, $3, 'CREATED', $4, $5, $6, $7, $8, $9, $10)
     RETURNING *`,
    [
      partnerOrderId,
      userId,
      orderType,
      fiatCurrency || null,
      fiatAmount || null,
      cryptoCurrency || null,
      network || null,
      walletAddress || null,
      paymentMethod || null,
      redirectUrl || null,
    ]
  );
  return result.rows[0];
}

async function findByPartnerOrderId(partnerOrderId) {
  const result = await query('SELECT * FROM orders WHERE partner_order_id = $1', [
    partnerOrderId,
  ]);
  return result.rows[0] || null;
}

async function findByTransakOrderId(transakOrderId) {
  const result = await query('SELECT * FROM orders WHERE transak_order_id = $1', [
    transakOrderId,
  ]);
  return result.rows[0] || null;
}

async function listByUser(userId, { limit = 20, offset = 0 } = {}) {
  const result = await query(
    `SELECT * FROM orders WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`,
    [userId, limit, offset]
  );
  return result.rows;
}

async function updateFromWebhook(partnerOrderId, { transakOrderId, status, cryptoAmount, payload }) {
  const result = await query(
    `UPDATE orders SET
       transak_order_id = COALESCE($2, transak_order_id),
       status = COALESCE($3, status),
       crypto_amount = COALESCE($4, crypto_amount),
       raw_webhook_payload = $5,
       updated_at = now()
     WHERE partner_order_id = $1
     RETURNING *`,
    [partnerOrderId, transakOrderId || null, status || null, cryptoAmount || null, payload || null]
  );
  return result.rows[0] || null;
}

async function updateStatus(partnerOrderId, status) {
  const result = await query(
    `UPDATE orders SET status = $2, updated_at = now()
     WHERE partner_order_id = $1
     RETURNING *`,
    [partnerOrderId, status]
  );
  return result.rows[0] || null;
}

async function logWebhookEvent({
  eventId,
  eventName,
  partnerOrderId,
  transakOrderId,
  signatureValid,
  payload,
}) {
  await query(
    `INSERT INTO webhook_events
       (event_id, event_name, partner_order_id, transak_order_id, signature_valid, payload)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      eventId || null,
      eventName || null,
      partnerOrderId || null,
      transakOrderId || null,
      signatureValid,
      payload,
    ]
  );
}

module.exports = {
  createOrder,
  findByPartnerOrderId,
  findByTransakOrderId,
  listByUser,
  updateFromWebhook,
  updateStatus,
  logWebhookEvent,
};
