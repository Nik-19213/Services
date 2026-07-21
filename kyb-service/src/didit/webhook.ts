import crypto from "node:crypto";
import { config } from "../config.js";

const MAX_CLOCK_SKEW_SECONDS = 300;

// Verifies the X-Signature-Simple header: HMAC-SHA256 over
// "{timestamp}:{session_id}:{status}:{webhook_type}". This is the
// envelope-only variant Didit documents as a fallback -- it doesn't depend on
// exact byte-for-byte body reproduction the way X-Signature/X-Signature-V2
// do, which matters here since Express's JSON body parser re-serializes the
// body before we ever see it.
export function verifyDiditWebhook(params: {
  signatureHeader: string | undefined;
  timestampHeader: string | undefined;
  sessionId: string;
  status: string;
  webhookType: string;
}): { valid: boolean; reason?: string } {
  const { signatureHeader, timestampHeader, sessionId, status, webhookType } = params;

  if (!signatureHeader || !timestampHeader) {
    return { valid: false, reason: "missing signature or timestamp header" };
  }

  const timestamp = Number(timestampHeader);
  if (!Number.isFinite(timestamp)) {
    return { valid: false, reason: "malformed timestamp header" };
  }
  if (Math.abs(Date.now() / 1000 - timestamp) > MAX_CLOCK_SKEW_SECONDS) {
    return { valid: false, reason: "timestamp outside allowed clock skew" };
  }

  const expected = crypto
    .createHmac("sha256", config.didit.webhookSecret)
    .update(`${timestampHeader}:${sessionId}:${status}:${webhookType}`)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signatureHeader, "hex");
  if (expectedBuf.length !== actualBuf.length || !crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    return { valid: false, reason: "signature mismatch" };
  }

  return { valid: true };
}
