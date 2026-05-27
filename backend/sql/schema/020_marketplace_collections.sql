-- marketplace_collections — graded-metadata bucket catalog rows
-- Entity: backend/src/marketplace/entities/marketplace-collection.entity.ts

CREATE TABLE IF NOT EXISTS marketplace_collections (
  collection_key varchar(64) PRIMARY KEY,
  display_label varchar NOT NULL,
  query_used text,
  components jsonb NOT NULL,
  cover_image_url text,
  psa_cert_number varchar(32),
  market_parallel_key varchar(96) NOT NULL DEFAULT 'base',
  bucket_key_version smallint NOT NULL DEFAULT 2,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_collections_bucket_key_version_check
    CHECK (bucket_key_version >= 1)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_collections_psa_cert_number
  ON marketplace_collections (psa_cert_number)
  WHERE psa_cert_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_marketplace_collections_market_parallel_key
  ON marketplace_collections (market_parallel_key);

CREATE INDEX IF NOT EXISTS idx_marketplace_collections_created_at
  ON marketplace_collections (created_at DESC);

COMMENT ON TABLE marketplace_collections IS
  'Logical collection bucket (computeMarketBucketKey). Created on first ask listing.';
COMMENT ON COLUMN marketplace_collections.components IS
  'Bucket fields + mint enrichments (cardhedgerCardId, listingDisplayTitle, PSA mirrors, …).';
COMMENT ON COLUMN marketplace_collections.psa_cert_number IS
  'Canonical PSA cert for active listings in this bucket; PSA API cache in psa_cert_snapshots.';
COMMENT ON COLUMN marketplace_collections.market_parallel_key IS
  'Indexed parallel facet (base or PSA Variety slug). Pricing in collection_market_snapshots.';
