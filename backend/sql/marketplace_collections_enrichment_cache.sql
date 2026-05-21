-- PSA cert column, compact PSA API snapshot, and server-side market bundle cache.
-- Safe to run on existing DBs (all nullable). Prod: apply when TYPEORM_SYNC=false.

ALTER TABLE marketplace_collections
  ADD COLUMN IF NOT EXISTS psa_cert_number VARCHAR(32),
  ADD COLUMN IF NOT EXISTS psa_public_snapshot_json JSONB,
  ADD COLUMN IF NOT EXISTS psa_public_snapshot_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS market_bundle_cache_json JSONB,
  ADD COLUMN IF NOT EXISTS market_bundle_cached_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_marketplace_collections_psa_cert_number
  ON marketplace_collections (psa_cert_number)
  WHERE psa_cert_number IS NOT NULL;
