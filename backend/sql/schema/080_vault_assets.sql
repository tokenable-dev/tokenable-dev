-- vault_assets — permanent identity of a physical asset held (or previously held)
-- in the Tokenable/PSA vault. One row per physical card, independent of how many
-- times it has been deposited/redeemed. This is the top of the lifecycle:
--   vault_assets (physical card) -> vault_cycles (deposit..redeem) -> rwa_tokens (NFT)
-- Entity: backend/src/vault/entities/vault-asset.entity.ts

CREATE TABLE IF NOT EXISTS vault_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Discriminator for future non-PSA asset types; PSA is the only supported value today.
  asset_type varchar(32) NOT NULL DEFAULT 'psa_graded',
  external_cert_number varchar(32) NOT NULL,
  -- keccak256(lower(trim(external_cert_number))) as 0x-prefixed hex — mirrors the
  -- on-chain TokenableRWA.vaultRef anchor. Computed once, immutable thereafter.
  vault_ref varchar(66) NOT NULL,
  display_name varchar(512),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vault_assets_type_cert_unique UNIQUE (asset_type, external_cert_number),
  CONSTRAINT vault_assets_vault_ref_unique UNIQUE (vault_ref)
);

COMMENT ON TABLE vault_assets IS
  'Permanent identity of a physical asset (e.g. PSA-graded card). Survives across multiple vault deposit/redeem cycles and multiple historical NFTs.';
COMMENT ON COLUMN vault_assets.vault_ref IS
  'keccak256 of the physical-asset identifier — must match TokenableRWA.vaultRef() for every token minted against this asset.';
