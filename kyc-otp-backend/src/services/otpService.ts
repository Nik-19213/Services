import twilio from 'twilio';
import { env } from '../config/env';

const client = twilio(env.twilio.accountSid, env.twilio.authToken);

/**
 * Sends an OTP code to the given phone number via Twilio Verify.
 * Twilio manages code generation, expiry, and delivery (SMS/call/WhatsApp).
 */
export async function sendOtp(phoneNumber: string) {
  const verification = await client.verify.v2
    .services(env.twilio.verifyServiceSid)
    .verifications.create({ to: phoneNumber, channel: 'sms' });

  return {
    status: verification.status, // 'pending'
    sid: verification.sid,
  };
}

/**
 * Verifies a code entered by the user against Twilio Verify.
 */
export async function verifyOtp(phoneNumber: string, code: string) {
  const check = await client.verify.v2
    .services(env.twilio.verifyServiceSid)
    .verificationChecks.create({ to: phoneNumber, code });

  return {
    status: check.status, // 'approved' | 'pending' | 'canceled'
    valid: check.valid,
  };
}
