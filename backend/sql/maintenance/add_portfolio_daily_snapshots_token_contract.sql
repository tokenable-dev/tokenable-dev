-- Scope portfolio charts to the RWA address that was marked.
-- Existing rows stay unstamped (NULL) so they are not treated as the new
-- contract. Reads ignore NULL and any other address. New captures write
-- the configured RWA. Unique must include token_contract or today's slot
-- cannot coexist with the previous contract's row.

ALTER TABLE portfolio_daily_snapshots
  ADD COLUMN IF NOT EXISTS token_contract varchar(42);

COMMENT ON COLUMN portfolio_daily_snapshots.token_contract IS
  'RWA address marked in this row. Reads ignore rows for a different or unstamped contract.';

ALTER TABLE portfolio_daily_snapshots
  DROP CONSTRAINT IF EXISTS portfolio_daily_snapshots_wallet_date_chain_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'portfolio_daily_snapshots_wallet_date_chain_contract_unique'
  ) THEN
    ALTER TABLE portfolio_daily_snapshots
      ADD CONSTRAINT portfolio_daily_snapshots_wallet_date_chain_contract_unique
      UNIQUE (wallet_address, snapshot_date_kst, chain_id, token_contract);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_portfolio_daily_snapshots_token_contract
  ON portfolio_daily_snapshots (lower(token_contract))
  WHERE token_contract IS NOT NULL;
