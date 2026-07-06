import crypto from 'crypto';
import { DiditSessionStatus } from '../types';
import { env } from '../config/env';
import { logger } from '../logger';

interface CreateSessionResult {
  sessionId: string;
  url: string;
  status: DiditSessionStatus;
}

const KNOWN_STATUSES: DiditSessionStatus[] = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'IN_REVIEW',
  'APPROVED',
  'DECLINED',
  'RESUBMITTED',
  'ABANDONED',
  'EXPIRED',
];

/**
 * Didit's API and webhooks send statuses as Title Case ("Not Started", "Approved"),
 * not the SCREAMING_SNAKE_CASE documented at docs.didit.me/reference/verification-statuses.
 * Normalize at this boundary so the rest of the app can rely on one canonical format.
 */
export function normalizeStatus(raw: string): DiditSessionStatus {
  const normalized = raw.toUpperCase().replace(/\s+/g, '_') as DiditSessionStatus;
  if (!KNOWN_STATUSES.includes(normalized)) {
    logger.warn({ raw }, 'Received unrecognized Didit status; storing as-is');
    return raw as DiditSessionStatus;
  }
  return normalized;
}

/**
 * Creates a Didit identity verification session for a user.
 * vendorData ties the session back to our own user identifier (here, the OTP-verified
 * phone number) so the webhook can be matched to a local record.
 */
export async function createKycSession(vendorData: string): Promise<CreateSessionResult> {
  const response = await fetch(`${env.didit.baseUrl}/v3/session/`, {
    method: 'POST',
    headers: {
      'x-api-key': env.didit.apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workflow_id: env.didit.workflowId,
      vendor_data: vendorData,
      callback: env.didit.callbackUrl,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Didit session creation failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { session_id: string; url: string; status: string };
  return { sessionId: data.session_id, url: data.url, status: normalizeStatus(data.status) };
}

/**
 * Fetches the current decision/status for a session directly from Didit.
 * Used as a fallback when polling, in case a webhook was missed.
 */
export async function getSessionDecision(sessionId: string): Promise<{ status: DiditSessionStatus }> {
  const response = await fetch(`${env.didit.baseUrl}/v3/session/${sessionId}/decision/`, {
    headers: { 'x-api-key': env.didit.apiKey },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Didit decision fetch failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as { status: string };
  return { status: normalizeStatus(data.status) };
}

/**
 * Verifies the HMAC-SHA256 signature Didit sends with every webhook request,
 * computed over the raw (unparsed) request body, and checks the timestamp is
 * recent to guard against replay. Requires the raw body bytes, not the
 * JSON-parsed object, since re-serializing JSON can change byte-for-byte output.
 */
export function verifyWebhookSignature(rawBody: Buffer, signatureHeader: string | undefined, timestampHeader: string | undefined): boolean {
  if (!signatureHeader || !timestampHeader) return false;

  const timestampSeconds = Number(timestampHeader);
  if (!Number.isFinite(timestampSeconds)) return false;

  const ageSeconds = Math.abs(Date.now() / 1000 - timestampSeconds);
  if (ageSeconds > 5 * 60) return false; // reject stale/replayed webhooks

  const expected = crypto.createHmac('sha256', env.didit.webhookSecret).update(rawBody).digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const actualBuf = Buffer.from(signatureHeader, 'utf8');
  if (expectedBuf.length !== actualBuf.length) return false;

  return crypto.timingSafeEqual(expectedBuf, actualBuf);
}
