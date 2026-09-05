-- PSA Items Vaulted / secured mail → mint & deliver audit queue
CREATE TABLE IF NOT EXISTS vault_psa_vaulted_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id varchar(128) NOT NULL,
  subject varchar(512),
  from_address varchar(320),
  certs jsonb NOT NULL DEFAULT '[]'::jsonb,
  matched_item_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  matched_public_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  unmatched_certs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ingest_note varchar(128),
  status varchar(24) NOT NULL DEFAULT 'pending',
  minted_via varchar(16),
  mint_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_summary text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vault_psa_vaulted_reviews_gmail_message_unique UNIQUE (gmail_message_id),
  CONSTRAINT vault_psa_vaulted_reviews_status_check CHECK (
    status IN ('pending', 'minted', 'failed', 'dismissed')
  ),
  CONSTRAINT vault_psa_vaulted_reviews_minted_via_check CHECK (
    minted_via IS NULL OR minted_via IN ('auto', 'admin')
  )
);

CREATE INDEX IF NOT EXISTS idx_vault_psa_vaulted_reviews_status
  ON vault_psa_vaulted_reviews (status);

COMMENT ON TABLE vault_psa_vaulted_reviews IS
  'Gmail Items Vaulted (secured) mail; auto or admin mint-and-deliver to Live.';
