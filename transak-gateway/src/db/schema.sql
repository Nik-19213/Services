-- Run via: npm run migrate

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS orders (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ID we generate and hand to Transak as `partnerOrderId` so we can
  -- correlate the widget session with the eventual webhook, even before
  -- Transak's own order id exists.
  partner_order_id    TEXT NOT NULL UNIQUE,

  -- Transak's own order id, filled in once known (widget callback or webhook).
  transak_order_id    TEXT UNIQUE,

  user_id             TEXT NOT NULL,
  order_type          TEXT NOT NULL CHECK (order_type IN ('BUY', 'SELL')),
  status              TEXT NOT NULL DEFAULT 'CREATED',

  fiat_currency       TEXT,
  fiat_amount         NUMERIC,
  crypto_currency     TEXT,
  crypto_amount       NUMERIC,
  network             TEXT,
  wallet_address      TEXT,
  payment_method      TEXT,
  redirect_url        TEXT,

  raw_webhook_payload JSONB,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders (user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_transak_order_id ON orders (transak_order_id);

CREATE TABLE IF NOT EXISTS webhook_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         TEXT,
  event_name       TEXT,
  partner_order_id TEXT,
  transak_order_id TEXT,
  signature_valid  BOOLEAN NOT NULL,
  payload          JSONB NOT NULL,
  received_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_partner_order_id ON webhook_events (partner_order_id);
