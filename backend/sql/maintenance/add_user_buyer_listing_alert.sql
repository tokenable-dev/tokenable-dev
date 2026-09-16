-- BUYER_LISTING_ALERT — one-time notify when a collection first lists for sale on this RWA.

CREATE TABLE IF NOT EXISTS user_buyer_listing_alert (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_key varchar(128) NOT NULL,
  token_contract varchar(42) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  fired_at timestamptz NULL,
  CONSTRAINT user_buyer_listing_alert_user_collection_contract_unique
    UNIQUE (user_id, collection_key, token_contract)
);

CREATE INDEX IF NOT EXISTS idx_user_buyer_listing_alert_collection_contract_active
  ON user_buyer_listing_alert (collection_key, token_contract)
  WHERE fired_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_buyer_listing_alert_user_created
  ON user_buyer_listing_alert (user_id, created_at DESC);

COMMENT ON TABLE user_buyer_listing_alert IS
  'Buyer opt-in: notify once when a collection first lists for sale on this RWA (BUYER_LISTING_ALERT).';
