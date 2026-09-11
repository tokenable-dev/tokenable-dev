-- Portfolio analytics + user watchlist
-- Entities: backend/src/marketplace/entities/portfolio-*.entity.ts, user-watchlist.entity.ts

CREATE TABLE IF NOT EXISTS portfolio_daily_snapshots (
  id serial PRIMARY KEY,
  wallet_address varchar(42) NOT NULL,
  snapshot_date_kst date NOT NULL,
  chain_id integer NOT NULL,
  snapshot_at timestamptz NOT NULL,
  total_value_usd double precision NOT NULL,
  card_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_daily_snapshots_wallet_date_chain_unique
    UNIQUE (wallet_address, snapshot_date_kst, chain_id),
  CONSTRAINT portfolio_daily_snapshots_chain_id_positive CHECK (chain_id > 0),
  CONSTRAINT portfolio_daily_snapshots_total_nonneg CHECK (total_value_usd >= 0),
  CONSTRAINT portfolio_daily_snapshots_card_count_nonneg CHECK (card_count >= 0)
);

-- Read path: WHERE wallet + chain ORDER BY snapshot_at DESC
CREATE INDEX IF NOT EXISTS idx_portfolio_daily_snapshots_wallet_chain_at
  ON portfolio_daily_snapshots (wallet_address, chain_id, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_daily_snapshots_chain
  ON portfolio_daily_snapshots (chain_id);

COMMENT ON TABLE portfolio_daily_snapshots IS
  'Daily portfolio total USD per wallet per chain (09:00 Asia/Seoul).';
COMMENT ON COLUMN portfolio_daily_snapshots.chain_id IS
  'EIP-155 chain id of the RWA contract marked in this row.';

CREATE TABLE IF NOT EXISTS portfolio_holdings (
  id serial PRIMARY KEY,
  wallet_address varchar(42) NOT NULL,
  token_contract varchar(42) NOT NULL,
  token_id integer NOT NULL,
  hidden_at timestamptz,
  cost_basis_usd double precision,
  cost_basis_source varchar(32),
  acquired_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_holdings_wallet_contract_token_unique
    UNIQUE (wallet_address, token_contract, token_id),
  CONSTRAINT portfolio_holdings_token_id_nonneg CHECK (token_id >= 0),
  CONSTRAINT portfolio_holdings_cost_basis_nonneg CHECK (
    cost_basis_usd IS NULL OR cost_basis_usd >= 0
  ),
  CONSTRAINT portfolio_holdings_cost_basis_source_valid CHECK (
    cost_basis_source IS NULL
    OR cost_basis_source IN ('manual', 'vault_delivery', 'marketplace_buy')
  )
);

CREATE INDEX IF NOT EXISTS idx_portfolio_holdings_wallet
  ON portfolio_holdings (wallet_address);

COMMENT ON TABLE portfolio_holdings IS
  'Per-wallet portfolio prefs: UI hide + cost basis (manual or auto-seeded).';
COMMENT ON COLUMN portfolio_holdings.token_contract IS
  'RWA contract address (per-chain UUPS proxy) — disambiguates token_id across chains.';
COMMENT ON COLUMN portfolio_holdings.hidden_at IS
  'When set, token is omitted from portfolio totals and default holdings list.';
COMMENT ON COLUMN portfolio_holdings.cost_basis_source IS
  'manual = user edit (never overwritten by auto seed); vault_delivery | marketplace_buy = system.';

CREATE TABLE IF NOT EXISTS user_watchlist (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_key varchar(128) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_watchlist_user_collection_unique UNIQUE (user_id, collection_key)
);

CREATE INDEX IF NOT EXISTS idx_user_watchlist_user_created
  ON user_watchlist (user_id, created_at DESC);

COMMENT ON TABLE user_watchlist IS
  'Authenticated user saved marketplace collections (watchlist).';

CREATE TABLE IF NOT EXISTS user_buyer_listing_alert (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_key varchar(128) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  fired_at timestamptz NULL,
  CONSTRAINT user_buyer_listing_alert_user_collection_unique UNIQUE (user_id, collection_key)
);

CREATE INDEX IF NOT EXISTS idx_user_buyer_listing_alert_collection_active
  ON user_buyer_listing_alert (collection_key)
  WHERE fired_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_buyer_listing_alert_user_created
  ON user_buyer_listing_alert (user_id, created_at DESC);

COMMENT ON TABLE user_buyer_listing_alert IS
  'Buyer opt-in: notify once when a collection first lists for sale (BUYER_LISTING_ALERT).';
