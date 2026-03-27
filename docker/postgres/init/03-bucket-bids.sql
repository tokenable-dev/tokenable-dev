-- Keep in sync with: backend/sql/migrations/005_create_bucket_bids.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bucket_bid_status_enum') THEN
    CREATE TYPE bucket_bid_status_enum AS ENUM (
      'active',
      'fulfilled',
      'cancelled',
      'expired'
    );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS bucket_bids (
  id SERIAL PRIMARY KEY,
  bucket_key VARCHAR(64) NOT NULL,
  token_contract VARCHAR(42) NOT NULL,
  buyer_offerer VARCHAR(42) NOT NULL,
  consideration_amount VARCHAR NOT NULL,
  components JSONB NOT NULL,
  status bucket_bid_status_enum NOT NULL DEFAULT 'active',
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  fulfilled_token_id VARCHAR NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bucket_bids_key_status
  ON bucket_bids (bucket_key, status);

CREATE INDEX IF NOT EXISTS idx_bucket_bids_buyer
  ON bucket_bids (buyer_offerer);

CREATE INDEX IF NOT EXISTS idx_bucket_bids_end_time
  ON bucket_bids (end_time);
