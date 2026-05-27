-- Idempotent migration for DBs created before schema refactor (safe on fresh bootstrap).
-- Drops denormalized Cardhedger/PSA columns from marketplace_collections;
-- adds bucket facets + new tables if an older tree was applied manually.

CREATE TABLE IF NOT EXISTS psa_cert_snapshots (
  cert_number varchar(32) PRIMARY KEY,
  snapshot_json jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rwa_tokens (
  token_contract varchar(42) NOT NULL,
  token_id varchar(64) NOT NULL,
  cert_number varchar(32),
  token_uri text,
  metadata_cid varchar(128),
  display_name varchar(512),
  collection_key varchar(64),
  metadata_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (token_contract, token_id)
);

-- Migrate PSA cache rows off collections (one-time; skip if legacy columns already dropped)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'marketplace_collections'
      AND column_name = 'psa_public_snapshot_json'
  ) THEN
    INSERT INTO psa_cert_snapshots (cert_number, snapshot_json, fetched_at)
    SELECT
      trim(psa_cert_number),
      psa_public_snapshot_json,
      COALESCE(psa_public_snapshot_at, now())
    FROM marketplace_collections
    WHERE psa_cert_number IS NOT NULL
      AND trim(psa_cert_number) <> ''
      AND psa_public_snapshot_json IS NOT NULL
    ON CONFLICT (cert_number) DO UPDATE
      SET snapshot_json = EXCLUDED.snapshot_json,
          fetched_at = GREATEST(psa_cert_snapshots.fetched_at, EXCLUDED.fetched_at)
    WHERE psa_cert_snapshots.fetched_at < EXCLUDED.fetched_at;
  END IF;
END $$;

ALTER TABLE marketplace_collections
  ADD COLUMN IF NOT EXISTS market_parallel_key varchar(96) NOT NULL DEFAULT 'base';

ALTER TABLE marketplace_collections
  ADD COLUMN IF NOT EXISTS bucket_key_version smallint NOT NULL DEFAULT 2;

UPDATE marketplace_collections
SET market_parallel_key = lower(
  COALESCE(
    nullif(trim(components->>'marketParallelKey'), ''),
    'base'
  )
)
WHERE market_parallel_key = 'base'
  AND components->>'marketParallelKey' IS NOT NULL
  AND trim(components->>'marketParallelKey') <> '';

ALTER TABLE collection_market_snapshots
  ADD COLUMN IF NOT EXISTS spot_price_basis varchar(32);

UPDATE collection_market_snapshots s
SET spot_price_basis = s.preview_json->'card'->>'spotPriceBasis'
WHERE spot_price_basis IS NULL
  AND s.preview_json->'card'->>'spotPriceBasis' IS NOT NULL;

ALTER TABLE marketplace_collections
  DROP COLUMN IF EXISTS cardhedger_resolved_card_id,
  DROP COLUMN IF EXISTS cardhedger_headline_usd,
  DROP COLUMN IF EXISTS cardhedger_spot_basis,
  DROP COLUMN IF EXISTS cardhedger_pricing_synced_at,
  DROP COLUMN IF EXISTS psa_public_snapshot_json,
  DROP COLUMN IF EXISTS psa_public_snapshot_at;

CREATE INDEX IF NOT EXISTS idx_marketplace_collections_market_parallel_key
  ON marketplace_collections (market_parallel_key);

CREATE INDEX IF NOT EXISTS idx_rwa_tokens_cert_number
  ON rwa_tokens (cert_number)
  WHERE cert_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rwa_tokens_collection_key
  ON rwa_tokens (collection_key)
  WHERE collection_key IS NOT NULL;
