const config = require('../config');
const logger = require('../utils/logger');
const orderModel = require('../models/orderModel');
const orderService = require('../services/orderService');
const { verifyTransakWebhookSignature } = require('../utils/crypto');

/**
 * POST /api/v1/webhooks/transak
 *
 * IMPORTANT: this route must receive the RAW request body (see
 * routes/webhook.routes.js, which mounts express.raw() ahead of any JSON
 * body-parser) — HMAC signature verification only works against the exact
 * bytes Transak signed, not a re-serialized JSON object.
 *
 * Confirm against your Transak dashboard's webhook settings:
 *   - the header name the signature arrives in (default assumed here:
 *     x-transak-webhook-signature, configurable via
 *     TRANSAK_WEBHOOK_SIGNATURE_HEADER)
 *   - the exact field names in the payload (this handles a couple of
 *     reasonable shapes defensively, but verify against a real payload
 *     from your dashboard's webhook logs)
 */
async function handleTransakWebhook(req, res) {
  const rawBody = req.body; // Buffer, thanks to express.raw()
  const signatureHeader = req.headers[config.transak.webhookSignatureHeader];

  const signatureValid = verifyTransakWebhookSignature(
    rawBody,
    signatureHeader,
    config.transak.webhookSecret
  );

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    logger.warn('[webhook] Failed to parse webhook body as JSON');
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  const webhookData = payload.webhookData || payload.data || payload;
  const eventName = payload.eventID || payload.event || payload.eventName || webhookData.status;
  const transakOrderId = webhookData.id || webhookData.orderId || payload.orderId;
  const partnerOrderId = webhookData.partnerOrderId || payload.partnerOrderId;
  const status = webhookData.status;
  const cryptoAmount = webhookData.cryptoAmount;

  // Log every attempt (valid or not) for auditing before acting on it.
  try {
    await orderModel.logWebhookEvent({
      eventId: payload.eventID,
      eventName,
      partnerOrderId,
      transakOrderId,
      signatureValid,
      payload,
    });
  } catch (err) {
    logger.error('[webhook] Failed to persist webhook event log', err.message);
  }

  if (!signatureValid) {
    logger.warn('[webhook] Rejected webhook with invalid signature', { partnerOrderId });
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  if (!partnerOrderId) {
    logger.warn('[webhook] Webhook missing partnerOrderId, cannot correlate to an order', {
      transakOrderId,
    });
    // Still 200 — Transak will otherwise retry a payload we can never resolve.
    return res.status(200).json({ received: true, matched: false });
  }

  try {
    const updated = await orderService.applyWebhookUpdate({
      partnerOrderId,
      transakOrderId,
      status,
      cryptoAmount,
      payload,
    });

    if (!updated) {
      logger.warn('[webhook] No local order matched partnerOrderId', { partnerOrderId });
    } else {
      logger.info(`[webhook] Order ${partnerOrderId} updated to status ${status}`);
    }

    return res.status(200).json({ received: true, matched: Boolean(updated) });
  } catch (err) {
    logger.error('[webhook] Failed to apply webhook update', err.message);
    // Return 500 so Transak retries delivery.
    return res.status(500).json({ error: 'Failed to process webhook' });
  }
}

module.exports = { handleTransakWebhook };
