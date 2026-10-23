-- External sold listings for sealed-box trades tape (admin CSV). Not PriceCharting API.

CREATE TABLE IF NOT EXISTS pricecharting_trade_history (
  id bigserial PRIMARY KEY,
  product_id varchar(32) NOT NULL,
  traded_on date NOT NULL,
  price_cents integer NOT NULL,
  marketplace varchar(64) NOT NULL DEFAULT 'eBay',
  sale_type varchar(64) NOT NULL DEFAULT 'Buy It Now',
  sale_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pricecharting_trade_history_price_cents_check
    CHECK (price_cents > 0)
);

CREATE INDEX IF NOT EXISTS idx_pricecharting_trade_history_product_traded
  ON pricecharting_trade_history (product_id, traded_on DESC);

COMMENT ON TABLE pricecharting_trade_history IS
  'Admin-uploaded external comps for sealed boxes. Shown on collection trades tape; not live PriceCharting sales.';