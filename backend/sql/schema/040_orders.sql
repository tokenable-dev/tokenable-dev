-- orders — Seaport ask/bid rows (listings + fulfilled tape)
-- Entity: backend/src/marketplace/entities/order.entity.ts
-- Uses varchar (not PG enum) — matches TypeORM entities and avoids synchronize enum drift.

CREATE TABLE IF NOT EXISTS orders (
  id serial PRIMARY KEY,
  order_hash varchar(255) NOT NULL,
  offerer varchar(255) NOT NULL,
  side varchar(16) NOT NULL DEFAULT 'ask',
  token_contract varchar(255) NOT NULL,
  token_id varchar(255) NOT NULL,
  collection_key varchar(64),
  consideration_token varchar(255) NOT NULL,
  consideration_amount varchar(255) NOT NULL,
  parameters jsonb NOT NULL,
  signature varchar(255) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'active',
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT orders_order_hash_unique UNIQUE (order_hash),
  CONSTRAINT orders_side_check CHECK (side IN ('ask', 'bid')),
  CONSTRAINT orders_status_check CHECK (
    status IN ('active', 'fulfilled', 'cancelled', 'expired')
  )
);

CREATE INDEX IF NOT EXISTS idx_orders_offerer ON orders (offerer);
CREATE INDEX IF NOT EXISTS idx_orders_token_id ON orders (token_id);

CREATE INDEX IF NOT EXISTS idx_orders_token_contract_id
  ON orders (token_contract, token_id);
CREATE INDEX IF NOT EXISTS idx_orders_collection_key ON orders (collection_key);
CREATE INDEX IF NOT EXISTS idx_orders_end_time ON orders (end_time);

CREATE INDEX IF NOT EXISTS idx_orders_collection_fulfilled_ask
  ON orders (collection_key, updated_at)
  WHERE status = 'fulfilled' AND side = 'ask' AND collection_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_collection_active_ask
  ON orders (collection_key)
  WHERE status = 'active' AND side = 'ask' AND collection_key IS NOT NULL;

COMMENT ON TABLE orders IS 'Seaport signed orders — ask listings and collection-scoped bids.';
COMMENT ON COLUMN orders.collection_key IS
  'Logical bucket key; denormalized from listing metadata at insert time.';
COMMENT ON COLUMN orders.consideration_amount IS 'USDC amount in micro-units (stringified integer).';
