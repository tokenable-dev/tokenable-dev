-- Multiple linked wallets per platform account
-- Entity: backend/src/user/entities/user-wallet.entity.ts

CREATE TABLE IF NOT EXISTS user_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wallet_address varchar(42) NOT NULL,
  is_primary boolean NOT NULL DEFAULT false,
  linked_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_wallets_address_unique UNIQUE (wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_user_wallets_user_id ON user_wallets (user_id);

COMMENT ON TABLE user_wallets IS 'Wallets linked to a platform user (signature-verified).';

-- Migrate legacy users.wallet_address rows
INSERT INTO user_wallets (user_id, wallet_address, is_primary, linked_at)
SELECT id, wallet_address, true, COALESCE(wallet_linked_at, now())
FROM users
WHERE wallet_address IS NOT NULL AND trim(wallet_address) <> ''
ON CONFLICT (wallet_address) DO NOTHING;
