-- Same on-chain wallet may be linked to multiple platform accounts (shared key / custody).
-- Per-user uniqueness only: one row per (user_id, wallet_address).

ALTER TABLE user_wallets DROP CONSTRAINT IF EXISTS user_wallets_address_unique;

ALTER TABLE user_wallets
  ADD CONSTRAINT user_wallets_user_address_unique UNIQUE (user_id, wallet_address);

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_wallet_address_unique;

COMMENT ON COLUMN users.wallet_address IS 'Primary linked wallet (denormalized). Same address may appear on multiple users.';
