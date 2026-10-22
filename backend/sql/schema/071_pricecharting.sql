-- PriceCharting / SportsCardsPro catalog (admin CSV upsert).
-- Not collection_market_snapshots. Prices are integer cents.
-- Entities: backend/src/pricecharting/entities/*.ts

CREATE TABLE IF NOT EXISTS pricecharting_products (
  id varchar(32) PRIMARY KEY,
  console_name varchar(256) NOT NULL DEFAULT '',
  product_name varchar(512) NOT NULL DEFAULT '',
  loose_price_cents integer,
  cib_price_cents integer,
  new_price_cents integer,
  graded_price_cents integer,
  box_only_price_cents integer,
  manual_only_price_cents integer,
  bgs_10_price_cents integer,
  condition_9_price_cents integer,
  condition_10_price_cents integer,
  condition_13_price_cents integer,
  condition_14_price_cents integer,
  condition_15_price_cents integer,
  condition_16_price_cents integer,
  condition_17_price_cents integer,
  condition_18_price_cents integer,
  condition_19_price_cents integer,
  condition_20_price_cents integer,
  condition_21_price_cents integer,
  condition_22_price_cents integer,
  gamestop_price_cents integer,
  gamestop_trade_price_cents integer,
  retail_loose_buy_cents integer,
  retail_loose_sell_cents integer,
  retail_cib_buy_cents integer,
  retail_cib_sell_cents integer,
  retail_new_buy_cents integer,
  retail_new_sell_cents integer,
  upc varchar(32),
  sales_volume integer,
  genre varchar(128),
  tcg_id text,
  asin varchar(32),
  epid text,
  release_date date,
  cover_image_url text,
  is_sealed_box boolean NOT NULL DEFAULT false,
  source_file varchar(256) NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricecharting_products_genre
  ON pricecharting_products (genre);

CREATE INDEX IF NOT EXISTS idx_pricecharting_products_console
  ON pricecharting_products (console_name);

CREATE INDEX IF NOT EXISTS idx_pricecharting_products_sealed_box
  ON pricecharting_products (id)
  WHERE is_sealed_box;

COMMENT ON TABLE pricecharting_products IS
  'PriceCharting and SportsCardsPro price-list rows. PK is upstream product id. Re-upload upserts. manual_only_price_cents is PSA 10. cover_image_url is admin-set and is not part of the CSV upsert.';

CREATE TABLE IF NOT EXISTS pricecharting_import_runs (
  id serial PRIMARY KEY,
  filename varchar(256) NOT NULL,
  byte_size integer NOT NULL,
  row_count integer NOT NULL DEFAULT 0,
  skipped_count integer NOT NULL DEFAULT 0,
  genres jsonb NOT NULL DEFAULT '{}'::jsonb,
  status varchar(16) NOT NULL DEFAULT 'success',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE pricecharting_import_runs IS
  'Admin CSV upload audit for pricecharting_products.';
