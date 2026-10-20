-- Daily PriceCharting / SportsCardsPro CSV URLs. Token is not stored.

CREATE TABLE IF NOT EXISTS pricecharting_catalog_sources (
  id serial PRIMARY KEY,
  label varchar(128) NOT NULL,
  url text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  last_status varchar(16),
  last_error text,
  last_row_count integer,
  last_run_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pricecharting_catalog_sources_url
  ON pricecharting_catalog_sources (url);

COMMENT ON TABLE pricecharting_catalog_sources IS
  'Admin-registered CSV download URLs. Fetched only when an admin runs sync into pricecharting_products.';
