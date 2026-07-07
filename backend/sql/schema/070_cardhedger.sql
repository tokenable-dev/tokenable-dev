-- Cardhedger pricing infra + Top 100 snapshots
-- Entities: backend/src/cardhedger/entities/*.ts

CREATE TABLE IF NOT EXISTS cardhedger_price_subscriptions (
  id serial PRIMARY KEY,
  collection_key varchar(128) NOT NULL,
  card_id varchar(128) NOT NULL,
  grade varchar(32) NOT NULL,
  external_id varchar(192) NOT NULL,
  active boolean NOT NULL DEFAULT true,
  upstream_success boolean,
  upstream_error text,
  subscribed_at timestamptz NOT NULL DEFAULT now(),
  last_webhook_at timestamptz,
  deactivated_at timestamptz,
  CONSTRAINT cardhedger_price_subscriptions_external_id_uq UNIQUE (external_id),
  CONSTRAINT cardhedger_price_subscriptions_collection_card_grade_uq
    UNIQUE (collection_key, card_id, grade)
);

CREATE INDEX IF NOT EXISTS idx_cardhedger_price_subscriptions_card_id
  ON cardhedger_price_subscriptions (card_id)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_cardhedger_price_subscriptions_collection_key
  ON cardhedger_price_subscriptions (collection_key)
  WHERE active = true;

COMMENT ON TABLE cardhedger_price_subscriptions IS
  'Cardhedger subscribe-price-updates registrations (external_id = tokenable:{collectionKey}).';

CREATE TABLE IF NOT EXISTS cardhedger_price_delta_checkpoints (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  last_since_iso varchar(40) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cardhedger_price_delta_checkpoints IS
  'Singleton checkpoint for Cardhedger price-updates delta polling.';

CREATE TABLE IF NOT EXISTS cardhedger_daily_price_export_runs (
  file_date date PRIMARY KEY,
  source varchar(32) NOT NULL,
  status varchar(32) NOT NULL,
  row_count integer,
  storage_path text,
  error_message text,
  ran_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE cardhedger_daily_price_export_runs IS
  'Nightly import audit — csv_export or price_updates_delta fallback.';

CREATE TABLE IF NOT EXISTS cardhedger_price_delta_import_runs (
  id serial PRIMARY KEY,
  ran_at timestamptz NOT NULL DEFAULT now(),
  since_iso varchar(40) NOT NULL,
  latest_timestamp_iso varchar(40),
  update_count int NOT NULL DEFAULT 0,
  unique_card_ids int NOT NULL DEFAULT 0,
  matched_collection_count int NOT NULL DEFAULT 0,
  delta_matched_collection_count int NOT NULL DEFAULT 0,
  catalog_fallback_count int NOT NULL DEFAULT 0,
  unmatched_update_count int NOT NULL DEFAULT 0,
  enqueued_collection_keys jsonb NOT NULL DEFAULT '[]',
  matched_collections jsonb NOT NULL DEFAULT '[]',
  sample_updates jsonb NOT NULL DEFAULT '[]',
  status varchar(32) NOT NULL DEFAULT 'success',
  error_message text
);

CREATE INDEX IF NOT EXISTS idx_cardhedger_price_delta_import_runs_ran_at
  ON cardhedger_price_delta_import_runs (ran_at DESC);

COMMENT ON TABLE cardhedger_price_delta_import_runs IS
  'Audit log for Cardhedger price-updates delta poll.';
COMMENT ON COLUMN cardhedger_price_delta_import_runs.delta_matched_collection_count IS
  'Collections matched from Cardhedger price-updates card_id → our catalog.';
COMMENT ON COLUMN cardhedger_price_delta_import_runs.catalog_fallback_count IS
  'Collections refreshed via catalog sync when delta feed had no catalog overlap.';

CREATE TABLE IF NOT EXISTS card_top100_daily_snapshots (
  id serial PRIMARY KEY,
  snapshot_date_kst date NOT NULL,
  category varchar(64) NOT NULL,
  grade varchar(32) NOT NULL,
  cards_json jsonb NOT NULL,
  total_pages int NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT card_top100_daily_snapshots_date_category_grade_uq
    UNIQUE (snapshot_date_kst, category, grade)
);

CREATE INDEX IF NOT EXISTS idx_card_top100_daily_snapshots_date
  ON card_top100_daily_snapshots (snapshot_date_kst);

CREATE INDEX IF NOT EXISTS idx_card_top100_daily_snapshots_category
  ON card_top100_daily_snapshots (category);

COMMENT ON TABLE card_top100_daily_snapshots IS
  'Daily Top 100 rank snapshots per category and grade (KST calendar date).';
