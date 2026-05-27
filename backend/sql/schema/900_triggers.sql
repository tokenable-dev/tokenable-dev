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
