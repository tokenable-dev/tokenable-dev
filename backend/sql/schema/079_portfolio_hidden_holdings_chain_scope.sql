-- token_id alone is ambiguous once more than one RWA contract/chain exists
-- (each chain's UUPS proxy restarts tokenId at 0). Scope the hide-list by contract.
--
-- Any environment with existing rows must backfill or truncate before this
-- migration runs — see backend/sql/maintenance/077_reset_amoy_marketplace_data.sql.

ALTER TABLE portfolio_hidden_holdings
  ADD COLUMN IF NOT EXISTS token_contract varchar(42);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM portfolio_hidden_holdings WHERE token_contract IS NULL
  ) THEN
    RAISE EXCEPTION
      'portfolio_hidden_holdings has rows with no token_contract — backfill or truncate before applying 079';
  END IF;
END $$;

ALTER TABLE portfolio_hidden_holdings
  ALTER COLUMN token_contract SET NOT NULL;

ALTER TABLE portfolio_hidden_holdings
  DROP CONSTRAINT IF EXISTS portfolio_hidden_holdings_wallet_token_unique;

ALTER TABLE portfolio_hidden_holdings
  ADD CONSTRAINT portfolio_hidden_holdings_wallet_contract_token_unique
  UNIQUE (wallet_address, token_contract, token_id);

COMMENT ON COLUMN portfolio_hidden_holdings.token_contract IS
  'RWA contract address (per-chain UUPS proxy) — disambiguates token_id across chains.';
