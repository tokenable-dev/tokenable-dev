-- Link rwa_tokens (on-chain mint registry / marketplace read-model) to the
-- vault lifecycle tables, and record burn state so a redeemed token no
-- longer blocks a future re-vault + re-mint of the same physical asset.
--
-- IMPORTANT correction to migration 078: a physical asset legitimately gets
-- a brand-new token after redemption (see docs/architecture — asset lifecycle).
-- The old all-time-unique (token_contract, cert_number) index is WRONG under
-- that model and is replaced here with a burn-aware partial unique index that
-- only rejects a duplicate cert while a token for it is still ACTIVE.

ALTER TABLE rwa_tokens
  ADD COLUMN IF NOT EXISTS vault_cycle_id uuid REFERENCES vault_cycles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS vault_ref varchar(66),
  ADD COLUMN IF NOT EXISTS burned_at timestamptz,
  ADD COLUMN IF NOT EXISTS burn_tx_hash varchar(80);

CREATE UNIQUE INDEX IF NOT EXISTS uq_rwa_tokens_vault_cycle_id
  ON rwa_tokens (vault_cycle_id)
  WHERE vault_cycle_id IS NOT NULL;

DROP INDEX IF EXISTS uq_rwa_tokens_contract_cert_number;

-- Replaces 078: only ACTIVE (non-burned) tokens must be unique per cert.
-- Duplicate certs are expected once the earlier token has been burned/redeemed.
CREATE UNIQUE INDEX IF NOT EXISTS uq_rwa_tokens_contract_cert_active
  ON rwa_tokens (token_contract, cert_number)
  WHERE cert_number IS NOT NULL AND burned_at IS NULL;

COMMENT ON COLUMN rwa_tokens.vault_cycle_id IS
  'Links this mint to its vault_cycles row (deposit lifecycle). NULL for tokens minted before the vault lifecycle model existed.';
COMMENT ON COLUMN rwa_tokens.vault_ref IS
  'On-chain vaultRef this token was minted with (mirrors vault_assets.vault_ref for the owning cycle).';
COMMENT ON COLUMN rwa_tokens.burned_at IS
  'Set once the on-chain adminBurn (redemption) has been confirmed. NULL while the NFT is live.';
