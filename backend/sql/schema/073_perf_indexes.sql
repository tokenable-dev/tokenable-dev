-- Performance indexes identified in the 2026-06-29 audit.
-- All use IF NOT EXISTS so re-running is safe.

-- 1. users.wallet_address — partial index for portfolio cron
--    (unique constraint was dropped in 066; no index remains)
CREATE INDEX IF NOT EXISTS idx_users_wallet_address
  ON users (wallet_address)
  WHERE wallet_address IS NOT NULL;

-- 2. user_wallets.wallet_address — reverse lookup (admin search, shared-wallet model)
CREATE INDEX IF NOT EXISTS idx_user_wallets_wallet_address
  ON user_wallets (wallet_address);

-- 3. collection_market_snapshots — LOWER(cardhedger_card_id) for delta-import lookups
--    Used as: WHERE LOWER(cardhedger_card_id) = LOWER($1)
CREATE INDEX IF NOT EXISTS idx_cms_cardhedger_card_id_lower
  ON collection_market_snapshots (LOWER(cardhedger_card_id))
  WHERE cardhedger_card_id IS NOT NULL;

-- 4. marketplace_collections — expression index on JSONB cardhedgerCardId field
--    Used by identity cache, subscription sync, delta catalog fallback
CREATE INDEX IF NOT EXISTS idx_mc_components_cardhedger_card_id
  ON marketplace_collections (LOWER(components->>'cardhedgerCardId'))
  WHERE components->>'cardhedgerCardId' IS NOT NULL;

-- 5. orders — partial composite for active-ask duplicate-listing check in createOrder
--    Narrows (token_contract, token_id) scan to live rows only; avoids scanning history
CREATE INDEX IF NOT EXISTS idx_orders_token_active_ask
  ON orders (token_contract, token_id)
  WHERE status = 'active' AND side = 'ask';

-- 6. orders — partial index for active-bid count per offerer+collection (assertActiveCollectionBidLimit)
CREATE INDEX IF NOT EXISTS idx_orders_offerer_collection_active_bid
  ON orders (LOWER(offerer), LOWER(collection_key))
  WHERE status = 'active' AND side = 'bid' AND collection_key IS NOT NULL;
