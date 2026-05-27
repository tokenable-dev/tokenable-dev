-- rwa_tokens — on-chain mint registry (contract + tokenId)
-- Entity: backend/src/marketplace/entities/rwa-token.entity.ts

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

CREATE INDEX IF NOT EXISTS idx_rwa_tokens_cert_number
  ON rwa_tokens (cert_number)
  WHERE cert_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_rwa_tokens_collection_key
  ON rwa_tokens (collection_key)
  WHERE collection_key IS NOT NULL;

COMMENT ON TABLE rwa_tokens IS
  'Registry of minted RWA tokens; cert and metadata synced from chain/IPFS on listing or boot sync.';
