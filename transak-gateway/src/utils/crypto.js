const crypto = require('crypto');

/**
 * HMAC-SHA256 a payload with a secret, hex-encoded.
 */
function hmacSha256Hex(payload, secret) {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

/**
 * Timing-safe string comparison to avoid leaking info via response timing.
 */
function safeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify a Transak webhook signature.
 *
 * NOTE: Transak signs webhook payloads so you can confirm a call really came
 * from them. Confirm the exact header name and signing scheme currently
 * documented in your Transak dashboard (Settings -> Webhooks) — this
 * implementation assumes "HMAC-SHA256 of the raw request body, hex digest,
 * sent in a header", which is the common pattern, and exposes the header
 * name as an env var so you can adjust it without touching code.
 */
function verifyTransakWebhookSignature(rawBody, signatureHeaderValue, secret) {
  if (!signatureHeaderValue || !secret) return false;
  const expected = hmacSha256Hex(rawBody, secret);
  return safeEqual(expected, signatureHeaderValue);
}

module.exports = {
  hmacSha256Hex,
  safeEqual,
  verifyTransakWebhookSignature,
};
