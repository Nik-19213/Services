CREATE TABLE IF NOT EXISTS phone_verifications (
  phone_number TEXT PRIMARY KEY,
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS kyc_sessions (
  session_id TEXT PRIMARY KEY,
  phone_number TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Looking up the latest session for a phone number is the hot path (status polling, new
-- session checks), so index the FK column ordered by recency.
CREATE INDEX IF NOT EXISTS idx_kyc_sessions_phone_number_created_at
  ON kyc_sessions (phone_number, created_at DESC);
