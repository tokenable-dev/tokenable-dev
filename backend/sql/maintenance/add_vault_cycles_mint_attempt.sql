-- Durable mint intent: survive process death between on-chain mint and recordMintResult.
-- Safe to re-run.

ALTER TABLE vault_cycles
  ADD COLUMN IF NOT EXISTS mint_attempt jsonb;

COMMENT ON COLUMN vault_cycles.mint_attempt IS
  'Mint intent persisted before on-chain mint (tokenURI, settlement_policy, images). Cleared when status becomes minted. Used by boot recovery after crash/redeploy.';

ALTER TABLE vault_cycles
  DROP CONSTRAINT IF EXISTS vault_cycles_status_check;

ALTER TABLE vault_cycles
  ADD CONSTRAINT vault_cycles_status_check CHECK (
    status IN (
      'pending_deposit',
      'deposit_verified',
      'minting',
      'minted',
      'redemption_requested',
      'redeemed',
      'cancelled'
    )
  );

CREATE INDEX IF NOT EXISTS idx_vault_cycles_minting
  ON vault_cycles (updated_at)
  WHERE status = 'minting';
