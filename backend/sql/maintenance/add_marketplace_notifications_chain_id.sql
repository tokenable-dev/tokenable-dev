-- Existing DBs: scope marketplace_notifications by chain (safe to re-run).
--
-- Inbox must not mix Sepolia bids into a Polygon session (and vice versa).
-- Legacy rows predate multi-chain inbox → backfill as Sepolia (11155111).
-- New rows get chain_id from the bid's RWA contract at insert time.
--
--   docker exec -i tokenable-postgres psql -U tokenable -d tokenable -v ON_ERROR_STOP=1 \
--     < backend/sql/maintenance/add_marketplace_notifications_chain_id.sql

ALTER TABLE marketplace_notifications
  ADD COLUMN IF NOT EXISTS chain_id integer;

UPDATE marketplace_notifications
SET chain_id = 11155111
WHERE chain_id IS NULL;

ALTER TABLE marketplace_notifications
  ALTER COLUMN chain_id SET NOT NULL;

ALTER TABLE marketplace_notifications
  ALTER COLUMN chain_id SET DEFAULT 11155111;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'marketplace_notifications_chain_id_positive'
  ) THEN
    ALTER TABLE marketplace_notifications
      ADD CONSTRAINT marketplace_notifications_chain_id_positive
      CHECK (chain_id > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_marketplace_notifications_recipient_chain_created
  ON marketplace_notifications (recipient_wallet, chain_id, created_at DESC);

COMMENT ON COLUMN marketplace_notifications.chain_id IS
  'Chain of the bid/ask RWA contract — list/mark-read filtered by x-tokenable-chain-id.';
