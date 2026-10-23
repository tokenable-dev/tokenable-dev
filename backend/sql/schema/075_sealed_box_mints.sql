-- Partner sealed-box mint. One physical box = one row = one NFT.
-- Not a vault cycle, not a cert, not a marketplace collection.

CREATE TABLE IF NOT EXISTS sealed_box_mints (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL,
  partner_id uuid NOT NULL,
  chain_id int NOT NULL,
  pricecharting_product_id varchar(32) NOT NULL,
  product_name varchar(512) NOT NULL,
  console_name varchar(256) NOT NULL DEFAULT '',
  upc varchar(64),
  client_request_id varchar(64) NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'pending',
  photo_object_key varchar(512),
  display_image_url text,
  token_uri text,
  vault_ref varchar(66),
  token_contract varchar(42),
  token_id varchar(64),
  mint_tx_hash varchar(80),
  recipient_address varchar(42) NOT NULL,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sealed_box_mints_user_request
  ON sealed_box_mints (user_id, client_request_id);

CREATE INDEX IF NOT EXISTS idx_sealed_box_mints_user
  ON sealed_box_mints (user_id);

COMMENT ON TABLE sealed_box_mints IS
  'Partner sealed-box mint intent. vault_ref is keccak256(sealed-box:id), not the PSA cert formula. collection_key stays null on rwa_tokens.';
