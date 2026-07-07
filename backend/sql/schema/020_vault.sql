-- Vault lifecycle: physical asset → deposit cycle → redemption
-- Entities: backend/src/vault/entities/*.ts

CREATE TABLE IF NOT EXISTS vault_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type varchar(32) NOT NULL DEFAULT 'psa_graded',
  external_cert_number varchar(32) NOT NULL,
  vault_ref varchar(66) NOT NULL,
  display_name varchar(512),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vault_assets_type_cert_unique UNIQUE (asset_type, external_cert_number),
  CONSTRAINT vault_assets_vault_ref_unique UNIQUE (vault_ref)
);

COMMENT ON TABLE vault_assets IS
  'Permanent identity of a physical asset (e.g. PSA-graded card). Survives across multiple vault deposit/redeem cycles.';
COMMENT ON COLUMN vault_assets.vault_ref IS
  'keccak256 of the physical-asset identifier — must match TokenableRWA.vaultRef() for every token minted against this asset.';

CREATE TABLE IF NOT EXISTS vault_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_asset_id uuid NOT NULL REFERENCES vault_assets(id) ON DELETE RESTRICT,
  cycle_number integer NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'pending_deposit',
  deposited_at timestamptz,
  deposit_verified_by uuid REFERENCES users(id) ON DELETE SET NULL,
  deposited_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vault_cycles_asset_number_unique UNIQUE (vault_asset_id, cycle_number),
  CONSTRAINT vault_cycles_status_check CHECK (
    status IN (
      'pending_deposit', 'deposit_verified', 'minted',
      'redemption_requested', 'redeemed', 'cancelled'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_vault_cycles_asset_id ON vault_cycles (vault_asset_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_vault_cycles_one_open_per_asset
  ON vault_cycles (vault_asset_id)
  WHERE status NOT IN ('redeemed', 'cancelled');

COMMENT ON TABLE vault_cycles IS
  'One deposit→redeem lifecycle for a vault_asset. At most one open cycle per asset.';
COMMENT ON COLUMN vault_cycles.deposit_verified_by IS
  'Admin who verified the physical deposit. NULL when verification was automated (self-serve mint).';

CREATE TABLE IF NOT EXISTS vault_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_cycle_id uuid NOT NULL REFERENCES vault_cycles(id) ON DELETE RESTRICT,
  requested_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  owner_wallet_address varchar(42) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'pending',
  ownership_verified_at timestamptz,
  burn_tx_hash varchar(80),
  burned_at timestamptz,
  vault_released_at timestamptz,
  failure_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vault_redemptions_status_check CHECK (
    status IN (
      'pending', 'ownership_verified', 'burned', 'vault_release_pending',
      'completed', 'failed', 'cancelled'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_vault_redemptions_cycle_id ON vault_redemptions (vault_cycle_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_vault_redemptions_one_open_per_cycle
  ON vault_redemptions (vault_cycle_id)
  WHERE status NOT IN ('completed', 'failed', 'cancelled');

COMMENT ON TABLE vault_redemptions IS
  'Redemption state machine: ownership verification → on-chain burn → physical vault release.';
