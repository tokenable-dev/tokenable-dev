-- vault_cycles — one deposit-to-redemption lifecycle for a vault_asset.
-- A physical asset may have many cycles over time, but at most ONE
-- non-terminal (still-open) cycle at any given moment — enforced below,
-- mirroring the on-chain activeTokenIdByVaultRef invariant in TokenableRWA.
-- Entity: backend/src/vault/entities/vault-cycle.entity.ts

CREATE TABLE IF NOT EXISTS vault_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_asset_id uuid NOT NULL REFERENCES vault_assets(id) ON DELETE RESTRICT,
  -- 1, 2, 3... per vault_asset; human-readable "cycle #2 of card X".
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
    status IN ('pending_deposit', 'deposit_verified', 'minted', 'redemption_requested', 'redeemed', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS idx_vault_cycles_asset_id ON vault_cycles (vault_asset_id);

-- At most one open (non-terminal) cycle per physical asset at any time —
-- the DB-level mirror of the contract's "one active claim per vaultRef" rule.
CREATE UNIQUE INDEX IF NOT EXISTS uq_vault_cycles_one_open_per_asset
  ON vault_cycles (vault_asset_id)
  WHERE status NOT IN ('redeemed', 'cancelled');

COMMENT ON TABLE vault_cycles IS
  'One deposit->redeem lifecycle for a vault_asset. status=minted/redemption_requested is the "active" window during which exactly one rwa_tokens row (NFT) represents the claim.';
COMMENT ON COLUMN vault_cycles.deposit_verified_by IS
  'Admin/ops user who verified the physical deposit, if done manually. NULL when verification was automated (current V1 self-serve mint flow).';
