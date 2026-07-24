-- P2P listings + payment-escrow orders
-- Entities: backend/src/marketplace/entities/p2p-listing.entity.ts
--           p2p-order.entity.ts

CREATE TABLE IF NOT EXISTS p2p_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_user_id uuid NOT NULL,
  cert_number varchar(32) NOT NULL,
  vault_ref varchar(66) NOT NULL,
  token_contract varchar(42) NOT NULL,
  token_id varchar(64) NOT NULL,
  token_uri text,
  mint_tx_hash varchar(80),
  chain_id int NOT NULL,
  price_usdc varchar(78) NOT NULL,
  seller_wallet varchar(42) NOT NULL,
  authenticity_accepted_at timestamptz NOT NULL,
  status varchar(32) NOT NULL,
  burn_tx_hash varchar(80),
  display_name varchar(512),
  image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_p2p_listings_cert_number ON p2p_listings (cert_number);

CREATE INDEX IF NOT EXISTS idx_p2p_listings_seller_user_id ON p2p_listings (seller_user_id);
CREATE INDEX IF NOT EXISTS idx_p2p_listings_status ON p2p_listings (status);

COMMENT ON TABLE p2p_listings IS
  'P2P sell listings — RWA minted to custody; USDC settlement via TokenablePaymentEscrow.';

CREATE TABLE IF NOT EXISTS p2p_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL UNIQUE,
  buyer_user_id uuid NOT NULL,
  buyer_wallet varchar(42) NOT NULL,
  seller_user_id uuid NOT NULL,
  seller_wallet varchar(42) NOT NULL,
  token_contract varchar(42) NOT NULL,
  token_id varchar(64) NOT NULL,
  price_usdc varchar(78) NOT NULL,
  chain_id int NOT NULL,
  escrow_order_id varchar(66) NOT NULL UNIQUE,
  escrow_address varchar(42),
  deposit_tx_hash varchar(80),
  release_tx_hash varchar(80),
  refund_tx_hash varchar(80),
  auto_release_at timestamptz NOT NULL,
  ship_by_at timestamptz NOT NULL,
  tracking_number varchar(128),
  carrier varchar(32),
  ship_to_name varchar(256),
  ship_to_line1 varchar(512),
  ship_to_line2 varchar(512),
  ship_to_city varchar(128),
  ship_to_region varchar(128),
  ship_to_postal varchar(32),
  ship_to_country varchar(8),
  status varchar(32) NOT NULL,
  burn_tx_hash varchar(80),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_p2p_orders_buyer_user_id ON p2p_orders (buyer_user_id);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_seller_user_id ON p2p_orders (seller_user_id);
CREATE INDEX IF NOT EXISTS idx_p2p_orders_status ON p2p_orders (status);
