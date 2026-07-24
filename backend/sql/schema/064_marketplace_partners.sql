-- Consignment partners: company display name + wallet with AES-GCM encrypted private key.

CREATE TABLE IF NOT EXISTS marketplace_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name varchar(128) NOT NULL,
  wallet_address varchar(42) NOT NULL,
  encrypted_private_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_partners_wallet_unique UNIQUE (wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_partners_active
  ON marketplace_partners (is_active);

COMMENT ON TABLE marketplace_partners IS
  'Enterprise consignment sellers: display name + wallet; private key encrypted with PARTNER_WALLET_ENCRYPTION_KEY.';
COMMENT ON COLUMN marketplace_partners.encrypted_private_key IS
  'AES-256-GCM blob: v1:<iv_b64>:<tag_b64>:<ciphertext_b64>. Never return to clients.';
