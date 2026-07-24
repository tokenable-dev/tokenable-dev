-- Automatic updated_at maintenance for tables that use TypeORM @UpdateDateColumn.

CREATE OR REPLACE FUNCTION tokenable_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE PROCEDURE tokenable_set_updated_at();

DROP TRIGGER IF EXISTS trg_user_wallets_updated_at ON user_wallets;
CREATE TRIGGER trg_user_wallets_updated_at
  BEFORE UPDATE ON user_wallets
  FOR EACH ROW
  EXECUTE PROCEDURE tokenable_set_updated_at();

DROP TRIGGER IF EXISTS trg_user_auth_providers_updated_at ON user_auth_providers;
CREATE TRIGGER trg_user_auth_providers_updated_at
  BEFORE UPDATE ON user_auth_providers
  FOR EACH ROW
  EXECUTE PROCEDURE tokenable_set_updated_at();

DROP TRIGGER IF EXISTS trg_marketplace_admins_updated_at ON marketplace_admins;
CREATE TRIGGER trg_marketplace_admins_updated_at
  BEFORE UPDATE ON marketplace_admins
  FOR EACH ROW
  EXECUTE PROCEDURE tokenable_set_updated_at();

DROP TRIGGER IF EXISTS trg_collection_market_snapshots_updated_at ON collection_market_snapshots;
CREATE TRIGGER trg_collection_market_snapshots_updated_at
  BEFORE UPDATE ON collection_market_snapshots
  FOR EACH ROW
  EXECUTE PROCEDURE tokenable_set_updated_at();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW
  EXECUTE PROCEDURE tokenable_set_updated_at();

DROP TRIGGER IF EXISTS trg_rwa_tokens_updated_at ON rwa_tokens;
CREATE TRIGGER trg_rwa_tokens_updated_at
  BEFORE UPDATE ON rwa_tokens
  FOR EACH ROW
  EXECUTE PROCEDURE tokenable_set_updated_at();

DROP TRIGGER IF EXISTS trg_portfolio_holdings_updated_at ON portfolio_holdings;
CREATE TRIGGER trg_portfolio_holdings_updated_at
  BEFORE UPDATE ON portfolio_holdings
  FOR EACH ROW
  EXECUTE PROCEDURE tokenable_set_updated_at();

DROP TRIGGER IF EXISTS trg_vault_assets_updated_at ON vault_assets;
CREATE TRIGGER trg_vault_assets_updated_at
  BEFORE UPDATE ON vault_assets
  FOR EACH ROW
  EXECUTE PROCEDURE tokenable_set_updated_at();

DROP TRIGGER IF EXISTS trg_vault_cycles_updated_at ON vault_cycles;
CREATE TRIGGER trg_vault_cycles_updated_at
  BEFORE UPDATE ON vault_cycles
  FOR EACH ROW
  EXECUTE PROCEDURE tokenable_set_updated_at();

DROP TRIGGER IF EXISTS trg_vault_redemptions_updated_at ON vault_redemptions;
CREATE TRIGGER trg_vault_redemptions_updated_at
  BEFORE UPDATE ON vault_redemptions
  FOR EACH ROW
  EXECUTE PROCEDURE tokenable_set_updated_at();

DROP TRIGGER IF EXISTS trg_p2p_listings_updated_at ON p2p_listings;
CREATE TRIGGER trg_p2p_listings_updated_at
  BEFORE UPDATE ON p2p_listings
  FOR EACH ROW
  EXECUTE PROCEDURE tokenable_set_updated_at();

DROP TRIGGER IF EXISTS trg_p2p_orders_updated_at ON p2p_orders;
CREATE TRIGGER trg_p2p_orders_updated_at
  BEFORE UPDATE ON p2p_orders
  FOR EACH ROW
  EXECUTE PROCEDURE tokenable_set_updated_at();

DROP TRIGGER IF EXISTS trg_cardhedger_price_delta_checkpoints_updated_at ON cardhedger_price_delta_checkpoints;
CREATE TRIGGER trg_cardhedger_price_delta_checkpoints_updated_at
  BEFORE UPDATE ON cardhedger_price_delta_checkpoints
  FOR EACH ROW
  EXECUTE PROCEDURE tokenable_set_updated_at();
