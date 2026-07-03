-- vault_redemptions — granular state machine for the multi-step redemption
-- pipeline (verify ownership -> execute burn -> release physical asset).
-- Kept separate from vault_cycles.status (which only needs coarse-grained
-- state) so operational failures/retries are auditable without polluting
-- the cycle's own lifecycle status.
-- Entity: backend/src/vault/entities/vault-redemption.entity.ts

CREATE TABLE IF NOT EXISTS vault_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_cycle_id uuid NOT NULL REFERENCES vault_cycles(id) ON DELETE RESTRICT,
  requested_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  -- Snapshot of the wallet that held the NFT when redemption was requested/executed.
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
    status IN ('pending', 'ownership_verified', 'burned', 'vault_release_pending', 'completed', 'failed', 'cancelled')
  )
);

CREATE INDEX IF NOT EXISTS idx_vault_redemptions_cycle_id ON vault_redemptions (vault_cycle_id);

-- At most one in-flight (non-terminal) redemption request per cycle.
CREATE UNIQUE INDEX IF NOT EXISTS uq_vault_redemptions_one_open_per_cycle
  ON vault_redemptions (vault_cycle_id)
  WHERE status NOT IN ('completed', 'failed', 'cancelled');

COMMENT ON TABLE vault_redemptions IS
  'Audit trail + state machine for a single redemption attempt: ownership verification -> on-chain burn -> physical vault release.';
