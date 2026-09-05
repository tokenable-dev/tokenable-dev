-- Consignment partners: company display name + wallet with AES-GCM encrypted private key.

CREATE TABLE IF NOT EXISTS marketplace_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name varchar(128) NOT NULL,
  wallet_address varchar(42) NOT NULL,
  encrypted_private_key text,
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
  'Optional AES-256-GCM blob: v1:<iv_b64>:<tag_b64>:<ciphertext_b64>. Required for bulk mint+list. Never return to clients.';

-- Self-vault mint registry → partner (030 created the column without FK).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'rwa_tokens_vault_partner_id_fkey'
  ) THEN
    ALTER TABLE rwa_tokens
      ADD CONSTRAINT rwa_tokens_vault_partner_id_fkey
      FOREIGN KEY (vault_partner_id) REFERENCES marketplace_partners(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rwa_tokens_vault_partner_id
  ON rwa_tokens (vault_partner_id)
  WHERE vault_partner_id IS NOT NULL;
