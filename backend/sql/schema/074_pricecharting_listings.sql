-- Seller listings for a PriceCharting catalog product. Not orders or collection_key.

CREATE TABLE IF NOT EXISTS pricecharting_listings (
  id uuid PRIMARY KEY,
  seller_user_id uuid NOT NULL,
  pricecharting_product_id varchar(32) NOT NULL,
  client_request_id varchar(64) NOT NULL,
  ask_price_cents integer,
  quantity integer,
  sealed_status varchar(80),
  condition_note varchar(500),
  status varchar(16) NOT NULL DEFAULT 'draft',
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pricecharting_listings_seller_request
  ON pricecharting_listings (seller_user_id, client_request_id);

CREATE INDEX IF NOT EXISTS idx_pricecharting_listings_seller
  ON pricecharting_listings (seller_user_id);

CREATE INDEX IF NOT EXISTS idx_pricecharting_listings_status
  ON pricecharting_listings (status);

CREATE TABLE IF NOT EXISTS pricecharting_listing_photos (
  id uuid PRIMARY KEY,
  listing_id uuid NOT NULL,
  object_key varchar(512) NOT NULL,
  public_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pricecharting_listing_photos_listing
  ON pricecharting_listing_photos (listing_id);

CREATE INDEX IF NOT EXISTS idx_pricecharting_products_upc
  ON pricecharting_products (upc);
