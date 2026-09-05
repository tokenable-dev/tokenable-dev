-- Partner company / Self-vault Origin address (FedEx Rate shipper).
-- One row per partner (UNIQUE partner_id).

CREATE TABLE IF NOT EXISTS marketplace_partner_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL,
  company_name varchar(128) NOT NULL,
  contact_name varchar(128) NOT NULL,
  phone varchar(40) NOT NULL,
  country varchar(2) NOT NULL,
  city varchar(128) NOT NULL,
  region varchar(128),
  postal varchar(32) NOT NULL,
  line1 varchar(256) NOT NULL,
  line2 varchar(256),
  residential boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_partner_addresses_partner_unique UNIQUE (partner_id),
  CONSTRAINT marketplace_partner_addresses_partner_fkey
    FOREIGN KEY (partner_id) REFERENCES marketplace_partners(id) ON DELETE CASCADE,
  CONSTRAINT marketplace_partner_addresses_country_iso
    CHECK (country ~ '^[A-Z]{2}$')
);

CREATE INDEX IF NOT EXISTS idx_marketplace_partner_addresses_country
  ON marketplace_partner_addresses (country);

COMMENT ON TABLE marketplace_partner_addresses IS
  'Partner Self-vault Origin address for FedEx Rate API (shipper). One row per partner.';
COMMENT ON COLUMN marketplace_partner_addresses.country IS
  'ISO 3166-1 alpha-2 (US/CA/…). Not us/ca/intl buckets.';
COMMENT ON COLUMN marketplace_partner_addresses.residential IS
  'FedEx residential flag; false for commercial vault origins.';
