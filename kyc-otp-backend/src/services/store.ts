import { pool } from '../db/pool';

interface PhoneVerificationRecord {
  phoneNumber: string;
  verified: boolean;
  verifiedAt?: string; // ISO timestamp
}

export async function markPhoneVerified(phoneNumber: string): Promise<void> {
  await pool.query(
    `INSERT INTO phone_verifications (phone_number, verified, verified_at)
     VALUES ($1, TRUE, now())
     ON CONFLICT (phone_number) DO UPDATE SET verified = TRUE, verified_at = now()`,
    [phoneNumber]
  );
}

export async function getVerificationRecord(phoneNumber: string): Promise<PhoneVerificationRecord> {
  const result = await pool.query<{ phone_number: string; verified: boolean; verified_at: Date | null }>(
    `SELECT phone_number, verified, verified_at FROM phone_verifications WHERE phone_number = $1`,
    [phoneNumber]
  );

  const row = result.rows[0];
  if (!row) return { phoneNumber, verified: false };

  return {
    phoneNumber: row.phone_number,
    verified: row.verified,
    verifiedAt: row.verified_at?.toISOString(),
  };
}
