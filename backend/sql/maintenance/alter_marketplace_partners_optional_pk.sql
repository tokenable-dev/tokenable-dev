-- Self-vault partners may register wallet + display name without an entrusted PK.
-- Bulk mint/list still requires a private key (set later via PATCH).

ALTER TABLE marketplace_partners
  ALTER COLUMN encrypted_private_key DROP NOT NULL;

COMMENT ON COLUMN marketplace_partners.encrypted_private_key IS
  'AES-256-GCM blob (optional). Required for partner bulk mint+list. Never return to clients.';
