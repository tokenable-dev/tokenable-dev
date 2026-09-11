-- Existing DBs: Settings prefs on users + shipping address book.
-- Local/dev with TypeORM synchronize may already have these columns/tables.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS marketing_emails_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_notif_prefs jsonb NOT NULL DEFAULT '{"trades":true,"bids":true,"price":true,"vault":true}'::jsonb;

COMMENT ON COLUMN users.marketing_emails_opt_in IS 'Settings: product news / drops opt-in (delivery TBD).';
COMMENT ON COLUMN users.email_notifications_enabled IS 'Settings: master switch for category email prefs.';
COMMENT ON COLUMN users.email_notif_prefs IS 'Settings: {trades,bids,price,vault} email category toggles.';

CREATE TABLE IF NOT EXISTS user_shipping_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label varchar(64) NOT NULL DEFAULT 'Home',
  name varchar(128) NOT NULL,
  line1 varchar(256) NOT NULL,
  line2 varchar(256),
  city varchar(128) NOT NULL,
  region varchar(128),
  postal varchar(32) NOT NULL,
  country varchar(8) NOT NULL DEFAULT 'us',
  phone varchar(40) NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_shipping_addresses_country_check
    CHECK (country IN ('us', 'ca', 'intl'))
);

CREATE INDEX IF NOT EXISTS idx_user_shipping_addresses_user_id
  ON user_shipping_addresses (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS user_shipping_addresses_one_default
  ON user_shipping_addresses (user_id)
  WHERE is_default = true;

COMMENT ON TABLE user_shipping_addresses IS
  'Saved ship-to addresses for vault redeem / physical withdrawal (Settings address book).';

CREATE OR REPLACE FUNCTION tokenable_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_shipping_addresses_updated_at ON user_shipping_addresses;
CREATE TRIGGER trg_user_shipping_addresses_updated_at
  BEFORE UPDATE ON user_shipping_addresses
  FOR EACH ROW
  EXECUTE PROCEDURE tokenable_set_updated_at();
