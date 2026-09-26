-- settlement_policy is set only by VaultService.recordMintResult (real mint path).
-- Owner-index Transfer stubs must NOT default to 'standard' (false PSA custody).
-- Safe to re-run.

ALTER TABLE rwa_tokens
  ALTER COLUMN settlement_policy DROP NOT NULL;

ALTER TABLE rwa_tokens
  ALTER COLUMN settlement_policy DROP DEFAULT;

-- Owner-index-only stubs: no cert / cycle → custody unknown until mint registry heals.
UPDATE rwa_tokens
SET settlement_policy = NULL
WHERE cert_number IS NULL
  AND vault_cycle_id IS NULL
  AND settlement_policy IS NOT NULL;

COMMENT ON COLUMN rwa_tokens.settlement_policy IS
  'NULL = not yet recorded from mint (custody unknown). standard = PSA vault Seaport split; self_vault_hold = partner/self vault delayed payout.';
