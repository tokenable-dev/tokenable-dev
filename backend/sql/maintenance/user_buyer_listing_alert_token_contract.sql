-- Per-chain buyer listing alerts: unique (user_id, collection_key, token_contract).
-- Existing DBs: apply manually (TypeORM synchronize will not rewrite the unique safely).

BEGIN;

ALTER TABLE user_buyer_listing_alert
  ADD COLUMN IF NOT EXISTS token_contract varchar(42);

ALTER TABLE user_buyer_listing_alert
  DROP CONSTRAINT IF EXISTS user_buyer_listing_alert_user_collection_unique;

-- Expand legacy (unstamped) subscriptions onto every catalog RWA for that key.
INSERT INTO user_buyer_listing_alert (
  user_id,
  collection_key,
  token_contract,
  created_at,
  fired_at
)
SELECT DISTINCT
  a.user_id,
  a.collection_key,
  lower(c.token_contract),
  a.created_at,
  a.fired_at
FROM user_buyer_listing_alert a
JOIN marketplace_collections c
  ON lower(c.collection_key) = lower(a.collection_key)
 AND c.token_contract IS NOT NULL
WHERE a.token_contract IS NULL;

DELETE FROM user_buyer_listing_alert
WHERE token_contract IS NULL;

ALTER TABLE user_buyer_listing_alert
  ALTER COLUMN token_contract SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_buyer_listing_alert_user_collection_contract_unique'
  ) THEN
    ALTER TABLE user_buyer_listing_alert
      ADD CONSTRAINT user_buyer_listing_alert_user_collection_contract_unique
      UNIQUE (user_id, collection_key, token_contract);
  END IF;
END $$;

DROP INDEX IF EXISTS idx_user_buyer_listing_alert_collection_active;

CREATE INDEX IF NOT EXISTS idx_user_buyer_listing_alert_collection_contract_active
  ON user_buyer_listing_alert (collection_key, token_contract)
  WHERE fired_at IS NULL;

COMMENT ON COLUMN user_buyer_listing_alert.token_contract IS
  'RWA address this alert subscription is scoped to (matches marketplace_collections.token_contract).';

COMMENT ON TABLE user_buyer_listing_alert IS
  'Buyer opt-in: notify once when a collection first lists for sale on this RWA (BUYER_LISTING_ALERT).';

COMMIT;
