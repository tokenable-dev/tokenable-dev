-- Ship-to address captured at redeem request (Portfolio Redeem Phase A).
ALTER TABLE vault_redemptions
  ADD COLUMN IF NOT EXISTS ship_to_name varchar(128),
  ADD COLUMN IF NOT EXISTS ship_to_line1 varchar(256),
  ADD COLUMN IF NOT EXISTS ship_to_line2 varchar(256),
  ADD COLUMN IF NOT EXISTS ship_to_city varchar(128),
  ADD COLUMN IF NOT EXISTS ship_to_region varchar(128),
  ADD COLUMN IF NOT EXISTS ship_to_postal varchar(32),
  ADD COLUMN IF NOT EXISTS ship_to_country varchar(8),
  ADD COLUMN IF NOT EXISTS ship_to_phone varchar(40);

COMMENT ON COLUMN vault_redemptions.ship_to_country IS
  'ISO-ish country key from redeem form: us | ca | intl';
