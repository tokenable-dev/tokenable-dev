-- On-chain RWA mint registry (requires vault_cycles for vault_cycle_id FK)
-- Entity: backend/src/marketplace/entities/rwa-token.entity.ts

CREATE TABLE IF NOT EXISTS rwa_tokens (
  token_contract varchar(42) NOT NULL,
  token_id varchar(64) NOT NULL,
  cert_number varchar(32),
  token_uri text,
  metadata_cid varchar(128),
  display_name varchar(512),
  display_image_url text,
  collection_key varchar(64),
  metadata_synced_at timestamptz,
  vault_cycle_id uuid REFERENCES vault_cycles(id) ON DELETE SET NULL,
  vault_ref varchar(66),
  burned_at timestamptz,
  burn_tx_hash varchar(80),
  settlement_policy varchar(32) NOT NULL DEFAULT 'standard',
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

CREATE UNIQUE INDEX IF NOT EXISTS uq_rwa_tokens_vault_cycle_id
  ON rwa_tokens (vault_cycle_id)
  WHERE vault_cycle_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_rwa_tokens_contract_cert_active
  ON rwa_tokens (token_contract, cert_number)
  WHERE cert_number IS NOT NULL AND burned_at IS NULL;

COMMENT ON TABLE rwa_tokens IS
  'Registry of minted RWA tokens; cert and metadata synced from chain/IPFS on listing or boot sync.';
COMMENT ON COLUMN rwa_tokens.display_image_url IS
  'Admin override image URL; takes precedence over on-chain metadata when resolving imageUrl.';
COMMENT ON COLUMN rwa_tokens.vault_cycle_id IS
  'Links this mint to its vault_cycles row. NULL for pre-vault-lifecycle tokens.';
COMMENT ON COLUMN rwa_tokens.vault_ref IS
  'On-chain vaultRef this token was minted with (mirrors vault_assets.vault_ref).';
COMMENT ON COLUMN rwa_tokens.burned_at IS
  'Set once on-chain adminBurn (redemption) is confirmed. NULL while the NFT is live.';
COMMENT ON COLUMN rwa_tokens.settlement_policy IS
  'standard = Seaport seller+fee split; self_vault_hold = 100% platform take, delayed seller payout';
