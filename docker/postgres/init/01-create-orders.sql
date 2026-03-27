-- Keep in sync with: backend/sql/migrations/003_create_orders_table.sql
-- Runs only on first PostgreSQL volume init (docker-entrypoint-initdb.d).
-- Ask/bid `side` column: see `02-orders-side.sql` (004 migration).

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'orders_status_enum') THEN
    CREATE TYPE orders_status_enum AS ENUM (
      'active',
      'fulfilled',
      'cancelled',
      'expired'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS orders (
  id SERIAL PRIMARY KEY,
  order_hash VARCHAR NOT NULL UNIQUE,
  offerer VARCHAR NOT NULL,
  token_contract VARCHAR NOT NULL,
  token_id VARCHAR NOT NULL,
  consideration_token VARCHAR NOT NULL,
  consideration_amount VARCHAR NOT NULL,
  parameters JSONB NOT NULL,
  signature TEXT NOT NULL,
  status orders_status_enum NOT NULL DEFAULT 'active',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_offerer ON orders (offerer);
CREATE INDEX IF NOT EXISTS idx_orders_token_id ON orders (token_id);
CREATE INDEX IF NOT EXISTS idx_orders_end_time ON orders (end_time);
