-- Per-run audit for POST /v1/cards/price-updates delta imports (replaces same-day overwrite on daily export table)
-- Entity: backend/src/cardhedger/entities/cardhedger-price-delta-import-run.entity.ts

CREATE TABLE IF NOT EXISTS cardhedger_price_delta_import_runs (
  id SERIAL PRIMARY KEY,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  since_iso VARCHAR(40) NOT NULL,
  latest_timestamp_iso VARCHAR(40),
  update_count INT NOT NULL DEFAULT 0,
  unique_card_ids INT NOT NULL DEFAULT 0,
  matched_collection_count INT NOT NULL DEFAULT 0,
  unmatched_update_count INT NOT NULL DEFAULT 0,
  enqueued_collection_keys JSONB NOT NULL DEFAULT '[]',
  matched_collections JSONB NOT NULL DEFAULT '[]',
  sample_updates JSONB NOT NULL DEFAULT '[]',
  status VARCHAR(32) NOT NULL DEFAULT 'success',
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_cardhedger_price_delta_import_runs_ran_at
  ON cardhedger_price_delta_import_runs (ran_at DESC);

COMMENT ON TABLE cardhedger_price_delta_import_runs IS
  'Audit log for Cardhedger price-updates delta poll — API-key path (no client_id required).';
