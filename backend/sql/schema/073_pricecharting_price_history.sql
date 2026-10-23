-- Daily PriceCharting price observations. Current row stays on pricecharting_products.

CREATE TABLE IF NOT EXISTS pricecharting_price_history (
  product_id varchar(32) NOT NULL,
  observed_on date NOT NULL,
  prices jsonb NOT NULL,
  PRIMARY KEY (product_id, observed_on)
);

CREATE INDEX IF NOT EXISTS idx_pricecharting_price_history_observed_on
  ON pricecharting_price_history (observed_on);

COMMENT ON TABLE pricecharting_price_history IS
  'Price cents observed on a Seoul date, including unchanged days. Latest values remain on pricecharting_products.';
