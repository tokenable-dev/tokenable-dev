-- marketplace_collections — graded-metadata bucket catalog rows
-- Entity: backend/src/marketplace/entities/marketplace-collection.entity.ts

CREATE TABLE IF NOT EXISTS marketplace_collections (
  collection_key varchar(64) PRIMARY KEY,
  display_label varchar NOT NULL,
  query_used text,
  components jsonb NOT NULL,
  cover_image_url text,
  cardhedger_resolved_card_id varchar(64),
  cardhedger_headline_usd double precision,
  cardhedger_spot_basis varchar(32),
  cardhedger_pricing_synced_at timestamptz,
  psa_cert_number varchar(32),
  psa_public_snapshot_json jsonb,
  psa_public_snapshot_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_collections_psa_cert_number
  ON marketplace_collections (psa_cert_number)
  WHERE psa_cert_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_marketplace_collections_created_at
  ON marketplace_collections (created_at DESC);

COMMENT ON TABLE marketplace_collections IS
  'Logical collection bucket (computeMarketBucketKey). Created on first ask listing.';
COMMENT ON COLUMN marketplace_collections.components IS
  'Bucket fields + enrichments (cardhedgerCardId, psaCertNumber, listingDisplayTitle, …).';
COMMENT ON COLUMN marketplace_collections.cardhedger_resolved_card_id IS
  'Audit mirror of last snapshot refresh; canonical pricing lives in collection_market_snapshots.';
