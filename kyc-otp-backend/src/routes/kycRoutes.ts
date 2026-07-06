import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { createKycSession, getSessionDecision, verifyWebhookSignature, normalizeStatus } from '../services/diditService';
import { saveKycSession, updateKycStatusBySessionId, getKycRecordByPhoneNumber } from '../services/kycStore';
import { getVerificationRecord } from '../services/store';
import { logger } from '../logger';
import { CreateKycSessionRequest, CreateKycSessionResponse, KycStatusResponse, DiditWebhookPayload, DiditSessionStatus } from '../types';

const router = Router();

// Once a session reaches one of these, it won't change again, so there's no need to
// keep polling Didit for it.
const TERMINAL_STATUSES: DiditSessionStatus[] = ['APPROVED', 'DECLINED', 'ABANDONED', 'EXPIRED'];

const kycSessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.body?.phoneNumber || req.ip,
  message: { success: false, message: 'Too many KYC session requests. Please try again later.' },
});

function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

/**
 * POST /api/kyc/session
 * body: { phoneNumber: "+14155552671" }
 * Requires the phone number to already be OTP-verified (see /api/otp) before starting
 * identity verification. Returns a hosted Didit URL to redirect the user to.
 */
router.post('/session', kycSessionLimiter, async (req: Request, res: Response) => {
  const { phoneNumber } = req.body as CreateKycSessionRequest;

  if (!phoneNumber || !isValidE164(phoneNumber)) {
    return res.status(400).json({
      success: false,
      message: 'A valid phone number in E.164 format is required (e.g. +14155552671)',
    } as CreateKycSessionResponse);
  }

  const verification = await getVerificationRecord(phoneNumber);
  if (!verification.verified) {
    return res.status(403).json({
      success: false,
      message: 'Phone number must complete OTP verification before starting identity verification',
    } as CreateKycSessionResponse);
  }

  try {
    const session = await createKycSession(phoneNumber);
    await saveKycSession(phoneNumber, session.sessionId, session.status);

    return res.json({
      success: true,
      message: 'KYC session created',
      sessionId: session.sessionId,
      url: session.url,
      status: session.status,
    } as CreateKycSessionResponse);
  } catch (err: any) {
    logger.error({ err }, 'createKycSession error');
    return res.status(502).json({
      success: false,
      message: 'Failed to create KYC session. Please try again.',
    } as CreateKycSessionResponse);
  }
});

/**
 * GET /api/kyc/status/:phoneNumber
 * phoneNumber must be URL-encoded (e.g. %2B14155552671).
 *
 * Normally kept up to date by the webhook. If no webhook is configured yet (e.g. local
 * dev without a tunnel), this falls back to polling Didit directly for any session
 * that hasn't reached a terminal status yet, so status checks work without one.
 */
router.get('/status/:phoneNumber', async (req: Request, res: Response) => {
  const { phoneNumber } = req.params;

  if (!isValidE164(phoneNumber)) {
    return res.status(400).json({
      success: false,
      phoneNumber,
      status: 'NOT_STARTED',
      message: 'A valid phone number in E.164 format is required',
    });
  }

  let record = await getKycRecordByPhoneNumber(phoneNumber);

  if (record && !TERMINAL_STATUSES.includes(record.status)) {
    try {
      const decision = await getSessionDecision(record.sessionId);
      if (decision.status !== record.status) {
        record = (await updateKycStatusBySessionId(record.sessionId, decision.status)) || record;
      }
    } catch (err: any) {
      logger.error({ err }, 'getSessionDecision error');
      // Fall through and return the last known local status.
    }
  }

  return res.json({
    success: true,
    phoneNumber,
    status: record?.status || 'NOT_STARTED',
    sessionId: record?.sessionId,
    updatedAt: record?.updatedAt,
  } as KycStatusResponse);
});

/**
 * POST /api/kyc/webhook
 * Didit calls this on every verification status change. Configured in the Didit
 * business console, pointing at this route's public URL, with the same secret as
 * DIDIT_WEBHOOK_SECRET_KEY. Requires the raw request body (see server.ts) since the
 * signature is an HMAC over the exact bytes Didit sent, not the re-serialized JSON.
 */
router.post('/webhook', async (req: Request, res: Response) => {
  const rawBody = (req as any).rawBody as Buffer | undefined;
  const signature = req.header('x-signature');
  const timestamp = req.header('x-timestamp');

  if (!rawBody || !verifyWebhookSignature(rawBody, signature, timestamp)) {
    return res.status(401).json({ success: false, message: 'Invalid webhook signature' });
  }

  const payload = req.body as DiditWebhookPayload;
  const status = normalizeStatus(payload.status);

  try {
    const updated = await updateKycStatusBySessionId(payload.session_id, status);
    if (!updated && payload.vendor_data) {
      await saveKycSession(payload.vendor_data, payload.session_id, status);
    }

    return res.json({ success: true });
  } catch (err: any) {
    logger.error({ err }, 'webhook processing error');
    // 500 so Didit retries the delivery instead of treating it as permanently handled.
    return res.status(500).json({ success: false, message: 'Failed to process webhook' });
  }
});

export default router;
