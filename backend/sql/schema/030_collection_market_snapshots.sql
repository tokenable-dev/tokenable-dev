-- collection_market_snapshots — materialized Cardhedger pricing per bucket key
-- Entity: backend/src/marketplace/entities/collection-market-snapshot.entity.ts

CREATE TABLE IF NOT EXISTS collection_market_snapshots (
  collection_key varchar(64) PRIMARY KEY,
  cardhedger_card_id varchar(64),
  psa10_usd double precision,
  psa9_usd double precision,
  raw_usd double precision,
  headline_usd double precision,
  spot_price_basis varchar(32),
  change_7d_pct double precision,
  change_30d_pct double precision,
  sparkline_90d_json jsonb,
  preview_json jsonb,
  external_usd_json jsonb,
  grade_prices_json jsonb,
  category_label varchar(512),
  history_tier varchar(32),
  reliability_score smallint,
  market_state varchar(16) NOT NULL DEFAULT 'empty',
  synced_at timestamptz,
  stale_after timestamptz,
  source_version smallint NOT NULL DEFAULT 1,
  last_viewed_at timestamptz,
  last_refresh_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT collection_market_snapshots_market_state_check
    CHECK (market_state IN ('fresh', 'stale', 'error', 'empty')),
  CONSTRAINT collection_market_snapshots_reliability_score_check
    CHECK (reliability_score IS NULL OR (reliability_score >= 0 AND reliability_score <= 100)),
  CONSTRAINT collection_market_snapshots_source_version_check
    CHECK (source_version >= 1)
);

CREATE INDEX IF NOT EXISTS idx_collection_market_snapshots_stale_after
  ON collection_market_snapshots (stale_after);

CREATE INDEX IF NOT EXISTS idx_collection_market_snapshots_last_viewed_at
  ON collection_market_snapshots (last_viewed_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_collection_market_snapshots_market_state
  ON collection_market_snapshots (market_state);

CREATE INDEX IF NOT EXISTS idx_collection_market_snapshots_synced_at
  ON collection_market_snapshots (synced_at DESC NULLS LAST);

COMMENT ON TABLE collection_market_snapshots IS
  'Materialized Cardhedger market state. API read path is DB-first; workers upsert rows.';
COMMENT ON COLUMN collection_market_snapshots.external_usd_json IS
  'Up to ~365d external USD series — serves market-series and price-history without upstream.';
COMMENT ON COLUMN collection_market_snapshots.stale_after IS
  'After this instant the row is stale (still served; SWR enqueues background refresh).';
