-- Existing DBs: scope portfolio_daily_snapshots by chain (safe to re-run).
--
-- TypeORM synchronize alone is NOT enough: the old UNIQUE (wallet, date) must be
-- dropped or same-wallet / same-day rows on two chains cannot coexist.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f backend/sql/maintenance/add_portfolio_daily_snapshot_chain_id.sql

ALTER TABLE portfolio_daily_snapshots
  ADD COLUMN IF NOT EXISTS chain_id integer;

-- Backfill legacy rows as Sepolia (public default until mainnet launch).
UPDATE portfolio_daily_snapshots
SET chain_id = 11155111
WHERE chain_id IS NULL;

ALTER TABLE portfolio_daily_snapshots
  ALTER COLUMN chain_id SET NOT NULL;

ALTER TABLE portfolio_daily_snapshots
  DROP CONSTRAINT IF EXISTS portfolio_daily_snapshots_wallet_date_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'portfolio_daily_snapshots_wallet_date_chain_unique'
  ) THEN
    ALTER TABLE portfolio_daily_snapshots
      ADD CONSTRAINT portfolio_daily_snapshots_wallet_date_chain_unique
      UNIQUE (wallet_address, snapshot_date_kst, chain_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'portfolio_daily_snapshots_chain_id_positive'
  ) THEN
    ALTER TABLE portfolio_daily_snapshots
      ADD CONSTRAINT portfolio_daily_snapshots_chain_id_positive
      CHECK (chain_id > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'portfolio_daily_snapshots_total_nonneg'
  ) THEN
    ALTER TABLE portfolio_daily_snapshots
      ADD CONSTRAINT portfolio_daily_snapshots_total_nonneg
      CHECK (total_value_usd >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'portfolio_daily_snapshots_card_count_nonneg'
  ) THEN
    ALTER TABLE portfolio_daily_snapshots
      ADD CONSTRAINT portfolio_daily_snapshots_card_count_nonneg
      CHECK (card_count >= 0);
  END IF;
END $$;

-- Read path: WHERE wallet + chain ORDER BY snapshot_at DESC
DROP INDEX IF EXISTS idx_portfolio_daily_snapshots_wallet_at;
CREATE INDEX IF NOT EXISTS idx_portfolio_daily_snapshots_wallet_chain_at
  ON portfolio_daily_snapshots (wallet_address, chain_id, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_daily_snapshots_chain
  ON portfolio_daily_snapshots (chain_id);

-- Drop stale single-column wallet indexes left by older TypeORM synchronize.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT i.indexname
    FROM pg_indexes i
    JOIN pg_class c ON c.relname = i.indexname
    JOIN pg_index x ON x.indexrelid = c.oid
    JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ANY (x.indkey)
    WHERE i.tablename = 'portfolio_daily_snapshots'
      AND i.indexname LIKE 'IDX_%'
      AND a.attname = 'wallet_address'
      AND x.indnatts = 1
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
  END LOOP;
END $$;

COMMENT ON COLUMN portfolio_daily_snapshots.chain_id IS
  'EIP-155 chain id of the RWA contract marked in this row.';
COMMENT ON TABLE portfolio_daily_snapshots IS
  'Daily portfolio total USD per wallet per chain (09:00 Asia/Seoul).';
