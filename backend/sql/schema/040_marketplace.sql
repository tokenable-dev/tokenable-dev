-- Marketplace buckets, materialized pricing, Seaport orders
-- Entities: backend/src/marketplace/entities/marketplace-collection.entity.ts
--           collection-market-snapshot.entity.ts, order.entity.ts

CREATE TABLE IF NOT EXISTS marketplace_collections (
  collection_key varchar(64) PRIMARY KEY,
  display_label varchar NOT NULL,
  query_used text,
  components jsonb NOT NULL,
  cover_image_url text,
  psa_cert_number varchar(32),
  market_parallel_key varchar(96) NOT NULL DEFAULT 'base',
  bucket_key_version smallint NOT NULL DEFAULT 2,
  review_status varchar(32) NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_collections_bucket_key_version_check
    CHECK (bucket_key_version >= 1),
  CONSTRAINT marketplace_collections_review_status_check
    CHECK (review_status IN ('pending_review', 'active', 'rejected'))
);

CREATE INDEX IF NOT EXISTS idx_marketplace_collections_psa_cert_number
  ON marketplace_collections (psa_cert_number)
  WHERE psa_cert_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_marketplace_collections_market_parallel_key
  ON marketplace_collections (market_parallel_key);

CREATE INDEX IF NOT EXISTS idx_marketplace_collections_created_at
  ON marketplace_collections (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_marketplace_collections_review_status
  ON marketplace_collections (review_status);

CREATE INDEX IF NOT EXISTS idx_mc_components_cardhedger_card_id
  ON marketplace_collections (LOWER(components->>'cardhedgerCardId'))
  WHERE components->>'cardhedgerCardId' IS NOT NULL;

COMMENT ON TABLE marketplace_collections IS
  'Logical collection bucket (computeMarketBucketKey). Created on first ask listing.';
COMMENT ON COLUMN marketplace_collections.components IS
  'Bucket fields + mint enrichments (cardhedgerCardId, listingDisplayTitle, PSA mirrors, …).';
COMMENT ON COLUMN marketplace_collections.psa_cert_number IS
  'Canonical PSA cert for active listings in this bucket.';
COMMENT ON COLUMN marketplace_collections.market_parallel_key IS
  'Indexed parallel facet (base or PSA Variety slug). Pricing in collection_market_snapshots.';
COMMENT ON COLUMN marketplace_collections.review_status IS
  'pending_review | active | rejected. New inserts are pending_review; Markets lists active only.';

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

CREATE INDEX IF NOT EXISTS idx_cms_cardhedger_card_id_lower
  ON collection_market_snapshots (LOWER(cardhedger_card_id))
  WHERE cardhedger_card_id IS NOT NULL;

COMMENT ON TABLE collection_market_snapshots IS
  'Materialized Cardhedger market state. API read path is DB-first; workers upsert rows.';
COMMENT ON COLUMN collection_market_snapshots.external_usd_json IS
  'Up to ~365d external USD series — serves market-series without upstream on hot reads.';
COMMENT ON COLUMN collection_market_snapshots.stale_after IS
  'After this instant the row is stale (still served; SWR enqueues background refresh).';

CREATE TABLE IF NOT EXISTS orders (
  id serial PRIMARY KEY,
  order_hash varchar(255) NOT NULL,
  offerer varchar(255) NOT NULL,
  side varchar(16) NOT NULL DEFAULT 'ask',
  token_contract varchar(255) NOT NULL,
  token_id varchar(255) NOT NULL,
  collection_key varchar(64),
  consideration_token varchar(255) NOT NULL,
  consideration_amount varchar(255) NOT NULL,
  parameters jsonb NOT NULL,
  signature varchar(255) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'active',
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_order_hash_unique UNIQUE (order_hash),
  CONSTRAINT orders_side_check CHECK (side IN ('ask', 'bid')),
  CONSTRAINT orders_status_check CHECK (
    status IN ('active', 'fulfilled', 'cancelled', 'expired')
  )
);

CREATE INDEX IF NOT EXISTS idx_orders_offerer ON orders (offerer);
CREATE INDEX IF NOT EXISTS idx_orders_token_id ON orders (token_id);
CREATE INDEX IF NOT EXISTS idx_orders_token_contract_id ON orders (token_contract, token_id);
CREATE INDEX IF NOT EXISTS idx_orders_collection_key ON orders (collection_key);
CREATE INDEX IF NOT EXISTS idx_orders_end_time ON orders (end_time);

CREATE INDEX IF NOT EXISTS idx_orders_collection_fulfilled_ask
  ON orders (collection_key, updated_at)
  WHERE status = 'fulfilled' AND side = 'ask' AND collection_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_collection_active_ask
  ON orders (collection_key)
  WHERE status = 'active' AND side = 'ask' AND collection_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_token_active_ask
  ON orders (token_contract, token_id)
  WHERE status = 'active' AND side = 'ask';

CREATE INDEX IF NOT EXISTS idx_orders_offerer_collection_active_bid
  ON orders (LOWER(offerer), LOWER(collection_key))
  WHERE status = 'active' AND side = 'bid' AND collection_key IS NOT NULL;

COMMENT ON TABLE orders IS 'Seaport signed orders — ask listings and collection-scoped bids.';
COMMENT ON COLUMN orders.collection_key IS
  'Logical bucket key; denormalized from listing metadata at insert time.';
COMMENT ON COLUMN orders.consideration_amount IS 'USDC amount in micro-units (stringified integer).';
