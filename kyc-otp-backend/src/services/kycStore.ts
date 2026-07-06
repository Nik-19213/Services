import { pool } from '../db/pool';
import { DiditSessionStatus } from '../types';

interface KycRecord {
  phoneNumber: string;
  sessionId: string;
  status: DiditSessionStatus;
  updatedAt: string; // ISO timestamp
}

interface KycRow {
  session_id: string;
  phone_number: string;
  status: DiditSessionStatus;
  updated_at: Date;
}

function toRecord(row: KycRow): KycRecord {
  return {
    phoneNumber: row.phone_number,
    sessionId: row.session_id,
    status: row.status,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function saveKycSession(
  phoneNumber: string,
  sessionId: string,
  status: DiditSessionStatus
): Promise<void> {
  await pool.query(
    `INSERT INTO kyc_sessions (session_id, phone_number, status)
     VALUES ($1, $2, $3)
     ON CONFLICT (session_id) DO UPDATE SET status = EXCLUDED.status, updated_at = now()`,
    [sessionId, phoneNumber, status]
  );
}

export async function updateKycStatusBySessionId(
  sessionId: string,
  status: DiditSessionStatus
): Promise<KycRecord | undefined> {
  const result = await pool.query<KycRow>(
    `UPDATE kyc_sessions SET status = $2, updated_at = now()
     WHERE session_id = $1
     RETURNING session_id, phone_number, status, updated_at`,
    [sessionId, status]
  );

  const row = result.rows[0];
  return row ? toRecord(row) : undefined;
}

// A phone number can accumulate multiple sessions over time (e.g. RESUBMITTED flows), so
// this returns the most recently created one rather than assuming a 1:1 mapping.
export async function getKycRecordByPhoneNumber(phoneNumber: string): Promise<KycRecord | undefined> {
  const result = await pool.query<KycRow>(
    `SELECT session_id, phone_number, status, updated_at FROM kyc_sessions
     WHERE phone_number = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [phoneNumber]
  );

  const row = result.rows[0];
  return row ? toRecord(row) : undefined;
}
