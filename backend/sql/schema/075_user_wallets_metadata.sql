-- Enriched wallet linkage metadata (embedded vs external, chain, Privy sync source)
-- Entity: backend/src/user/entities/user-wallet.entity.ts

ALTER TABLE user_wallets
  ADD COLUMN IF NOT EXISTS chain_type varchar(16) NOT NULL DEFAULT 'ethereum',
  ADD COLUMN IF NOT EXISTS wallet_kind varchar(16) NOT NULL DEFAULT 'external',
  ADD COLUMN IF NOT EXISTS wallet_client varchar(32) NULL,
  ADD COLUMN IF NOT EXISTS connector_type varchar(32) NULL,
  ADD COLUMN IF NOT EXISTS source varchar(32) NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS privy_wallet_id varchar(128) NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE user_wallets
  DROP CONSTRAINT IF EXISTS user_wallets_wallet_kind_check;

ALTER TABLE user_wallets
  ADD CONSTRAINT user_wallets_wallet_kind_check
  CHECK (wallet_kind IN ('embedded', 'external'));

ALTER TABLE user_wallets
  DROP CONSTRAINT IF EXISTS user_wallets_source_check;

ALTER TABLE user_wallets
  ADD CONSTRAINT user_wallets_source_check
  CHECK (source IN ('privy_sync', 'admin', 'legacy'));

UPDATE user_wallets
SET source = 'legacy', updated_at = now()
WHERE source IS NULL OR source = '';

COMMENT ON COLUMN user_wallets.wallet_kind IS 'embedded = Privy embedded wallet; external = MetaMask, etc.';
COMMENT ON COLUMN user_wallets.source IS 'How the wallet was linked: privy_sync, admin override, or legacy migration.';
