-- Existing DBs: partner company / Self-vault Origin address.

\ir ../schema/066_marketplace_partner_addresses.sql

DROP TRIGGER IF EXISTS trg_marketplace_partner_addresses_updated_at
  ON marketplace_partner_addresses;
CREATE TRIGGER trg_marketplace_partner_addresses_updated_at
  BEFORE UPDATE ON marketplace_partner_addresses
  FOR EACH ROW
  EXECUTE PROCEDURE tokenable_set_updated_at();
