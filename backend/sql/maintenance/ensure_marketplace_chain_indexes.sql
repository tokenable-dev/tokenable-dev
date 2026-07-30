-- Existing DBs: performance indexes for chain-scoped marketplace reads (safe to re-run).
-- Mirrors partial indexes from schema/040_marketplace.sql + P2P status/chain list filter.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f backend/sql/maintenance/ensure_marketplace_chain_indexes.sql

CREATE INDEX IF NOT EXISTS idx_orders_token_contract_id
  ON orders (token_contract, token_id);

CREATE INDEX IF NOT EXISTS idx_orders_collection_fulfilled_ask
  ON orders (collection_key, updated_at)
  WHERE status = 'fulfilled' AND side = 'ask' AND collection_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_collection_active_ask
  ON orders (collection_key)
  WHERE status = 'active' AND side = 'ask' AND collection_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_token_active_ask
  ON orders (token_contract, token_id)
  WHERE status = 'active' AND side = 'ask';

-- Hot path: collection detail / stats filter collection_key + RWA token_contract together.
CREATE INDEX IF NOT EXISTS idx_orders_collection_contract_active_ask
  ON orders (collection_key, token_contract)
  WHERE status = 'active' AND side = 'ask' AND collection_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_collection_contract_fulfilled_ask
  ON orders (collection_key, token_contract, updated_at)
  WHERE status = 'fulfilled' AND side = 'ask' AND collection_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_p2p_listings_status_chain
  ON p2p_listings (status, chain_id);

CREATE INDEX IF NOT EXISTS idx_p2p_orders_status_chain
  ON p2p_orders (status, chain_id);
