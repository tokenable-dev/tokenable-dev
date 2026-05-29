-- portfolio_daily_snapshots — daily 09:00 KST wallet mark-to-market totals
-- Entity: backend/src/marketplace/entities/portfolio-daily-snapshot.entity.ts

CREATE TABLE IF NOT EXISTS portfolio_daily_snapshots (
  id serial PRIMARY KEY,
  wallet_address varchar(42) NOT NULL,
  snapshot_date_kst date NOT NULL,
  snapshot_at timestamptz NOT NULL,
  total_value_usd double precision NOT NULL,
  card_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_daily_snapshots_wallet_date_unique
    UNIQUE (wallet_address, snapshot_date_kst),
  CONSTRAINT portfolio_daily_snapshots_total_nonneg CHECK (total_value_usd >= 0),
  CONSTRAINT portfolio_daily_snapshots_card_count_nonneg CHECK (card_count >= 0)
);

CREATE INDEX IF NOT EXISTS idx_portfolio_daily_snapshots_wallet_at
  ON portfolio_daily_snapshots (wallet_address, snapshot_at DESC);

COMMENT ON TABLE portfolio_daily_snapshots IS
  'Daily portfolio total USD per wallet (on-chain holders + tracked zero-card wallets; 09:00 Asia/Seoul).';
