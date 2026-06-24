-- Phase 8 — Cardhedger price webhook subscriptions + nightly delta import metadata
-- Entity: backend/src/cardhedger/entities/cardhedger-price-subscription.entity.ts

CREATE TABLE IF NOT EXISTS cardhedger_price_subscriptions (
  id SERIAL PRIMARY KEY,
  collection_key VARCHAR(128) NOT NULL,
  card_id VARCHAR(128) NOT NULL,
  grade VARCHAR(32) NOT NULL,
  external_id VARCHAR(192) NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  upstream_success BOOLEAN,
  upstream_error TEXT,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_webhook_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  CONSTRAINT cardhedger_price_subscriptions_external_id_uq UNIQUE (external_id),
  CONSTRAINT cardhedger_price_subscriptions_collection_card_grade_uq
    UNIQUE (collection_key, card_id, grade)
);

CREATE INDEX IF NOT EXISTS idx_cardhedger_price_subscriptions_card_id
  ON cardhedger_price_subscriptions (card_id)
  WHERE active = TRUE;

CREATE INDEX IF NOT EXISTS idx_cardhedger_price_subscriptions_collection_key
  ON cardhedger_price_subscriptions (collection_key)
  WHERE active = TRUE;

COMMENT ON TABLE cardhedger_price_subscriptions IS
  'Cardhedger subscribe-price-updates registrations (external_id = tokenable:{collectionKey}).';

CREATE TABLE IF NOT EXISTS cardhedger_price_delta_checkpoints (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_since_iso VARCHAR(40) NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE cardhedger_price_delta_checkpoints IS
  'Singleton checkpoint for POST /v1/cards/price-updates delta polling (Phase 8B fallback).';

CREATE TABLE IF NOT EXISTS cardhedger_daily_price_export_runs (
  file_date DATE PRIMARY KEY,
  source VARCHAR(32) NOT NULL,
  status VARCHAR(32) NOT NULL,
  row_count INTEGER,
  storage_path TEXT,
  error_message TEXT,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE cardhedger_daily_price_export_runs IS
  'Nightly import audit — csv_export (Elite/Enterprise) or price_updates_delta fallback.';
