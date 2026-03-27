-- Pool bid: EIP-712 commitment + orders ↔ bucket link
-- psql -f 006_collection_bucket_eip712_orders.sql

ALTER TABLE bucket_bids
  ADD COLUMN IF NOT EXISTS signature TEXT NULL,
  ADD COLUMN IF NOT EXISTS nonce VARCHAR(80) NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_bucket_bids_buyer_nonce
  ON bucket_bids (lower(buyer_offerer), nonce)
  WHERE nonce IS NOT NULL AND nonce <> '';

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS bucket_bid_id INT NULL REFERENCES bucket_bids(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_bucket_bid_id ON orders (bucket_bid_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_one_active_bid_per_pool
  ON orders (bucket_bid_id)
  WHERE bucket_bid_id IS NOT NULL
    AND status::text = 'active'
    AND side::text = 'bid';
