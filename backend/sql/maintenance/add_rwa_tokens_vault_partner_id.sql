-- Link self-vault mints to marketplace_partners for "{displayName} vault" labels.

ALTER TABLE rwa_tokens
  ADD COLUMN IF NOT EXISTS vault_partner_id uuid
    REFERENCES marketplace_partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rwa_tokens_vault_partner_id
  ON rwa_tokens (vault_partner_id)
  WHERE vault_partner_id IS NOT NULL;

COMMENT ON COLUMN rwa_tokens.vault_partner_id IS
  'Self-vault partner who holds the physical card; used for "{name} vault" UI labels.';
