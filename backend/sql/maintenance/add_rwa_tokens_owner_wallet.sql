-- Portfolio owner index: fast wallet → token_ids lookup (replaces full-supply ownerOf scan).

ALTER TABLE rwa_tokens
  ADD COLUMN IF NOT EXISTS owner_wallet varchar(42);

CREATE INDEX IF NOT EXISTS idx_rwa_tokens_contract_owner_live
  ON rwa_tokens (token_contract, owner_wallet)
  WHERE owner_wallet IS NOT NULL AND burned_at IS NULL;

COMMENT ON COLUMN rwa_tokens.owner_wallet IS
  'Current on-chain holder (lowercase). Maintained by Transfer indexer + mint/burn writers.';
