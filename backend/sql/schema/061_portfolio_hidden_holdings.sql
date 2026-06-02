-- portfolio_hidden_holdings — per-wallet UI hide (NFT stays on-chain; excluded from portfolio value)
-- Entity: backend/src/marketplace/entities/portfolio-hidden-holding.entity.ts

CREATE TABLE IF NOT EXISTS portfolio_hidden_holdings (
  id serial PRIMARY KEY,
  wallet_address varchar(42) NOT NULL,
  token_id integer NOT NULL,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_hidden_holdings_wallet_token_unique
    UNIQUE (wallet_address, token_id),
  CONSTRAINT portfolio_hidden_holdings_token_id_nonneg CHECK (token_id >= 0)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_hidden_holdings_wallet
  ON portfolio_hidden_holdings (wallet_address);

COMMENT ON TABLE portfolio_hidden_holdings IS
  'Wallet-scoped portfolio UI hide list; tokens remain owned on-chain but are omitted from portfolio totals and default holdings view.';
