import { Router, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { sendOtp, verifyOtp } from '../services/otpService';
import { markPhoneVerified, getVerificationRecord } from '../services/store';
import { logger } from '../logger';
import {
  SendOtpRequest,
  SendOtpResponse,
  VerifyOtpRequest,
  VerifyOtpResponse,
  VerificationStatusResponse,
} from '../types';

const router = Router();

// Prevent OTP spam/abuse: max 5 send requests per phone per 15 min window (basic example)
const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyGenerator: (req) => req.body?.phoneNumber || req.ip,
  message: { success: false, message: 'Too many OTP requests. Please try again later.' },
});

const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => req.body?.phoneNumber || req.ip,
  message: { success: false, verified: false, message: 'Too many attempts. Please try again later.' },
});

function isValidE164(phone: string): boolean {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

/**
 * POST /api/otp/send
 * body: { phoneNumber: "+14155552671" }
 */
router.post('/send', otpSendLimiter, async (req: Request, res: Response) => {
  const { phoneNumber } = req.body as SendOtpRequest;

  if (!phoneNumber || !isValidE164(phoneNumber)) {
    return res.status(400).json({
      success: false,
      message: 'A valid phone number in E.164 format is required (e.g. +14155552671)',
    } as SendOtpResponse);
  }

  try {
    const result = await sendOtp(phoneNumber);
    return res.json({
      success: true,
      message: 'OTP sent successfully',
      status: result.status,
    } as SendOtpResponse);
  } catch (err: any) {
    logger.error({ err }, 'sendOtp error');
    return res.status(502).json({
      success: false,
      message: 'Failed to send OTP. Please try again.',
    } as SendOtpResponse);
  }
});

/**
 * POST /api/otp/verify
 * body: { phoneNumber: "+14155552671", code: "123456" }
 */
router.post('/verify', otpVerifyLimiter, async (req: Request, res: Response) => {
  const { phoneNumber, code } = req.body as VerifyOtpRequest;

  if (!phoneNumber || !isValidE164(phoneNumber) || !code) {
    return res.status(400).json({
      success: false,
      verified: false,
      message: 'phoneNumber and code are required',
    } as VerifyOtpResponse);
  }

  try {
    const result = await verifyOtp(phoneNumber, code);

    if (result.status === 'approved' && result.valid) {
      await markPhoneVerified(phoneNumber);
      return res.json({
        success: true,
        verified: true,
        message: 'Phone number verified successfully',
      } as VerifyOtpResponse);
    }

    return res.status(400).json({
      success: false,
      verified: false,
      message: 'Invalid or expired code',
    } as VerifyOtpResponse);
  } catch (err: any) {
    logger.error({ err }, 'verifyOtp error');
    return res.status(502).json({
      success: false,
      verified: false,
      message: 'Failed to verify OTP. Please try again.',
    } as VerifyOtpResponse);
  }
});

/**
 * GET /api/otp/status/:phoneNumber
 * Returns whether this phone number has completed OTP verification.
 * phoneNumber must be URL-encoded (e.g. %2B14155552671).
 */
router.get('/status/:phoneNumber', async (req: Request, res: Response) => {
  const { phoneNumber } = req.params;

  if (!isValidE164(phoneNumber)) {
    return res.status(400).json({
      success: false,
      phoneNumber,
      verified: false,
      message: 'A valid phone number in E.164 format is required',
    });
  }

  try {
    const record = await getVerificationRecord(phoneNumber);
    return res.json({
      success: true,
      phoneNumber: record.phoneNumber,
      verified: record.verified,
      verifiedAt: record.verifiedAt,
    } as VerificationStatusResponse);
  } catch (err: any) {
    logger.error({ err }, 'getVerificationRecord error');
    return res.status(500).json({
      success: false,
      phoneNumber,
      verified: false,
      message: 'Failed to fetch verification status',
    });
  }
});

export default router;
