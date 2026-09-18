-- Existing DBs: PSA Items Received admin review queue
CREATE TABLE IF NOT EXISTS vault_psa_arrival_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id varchar(128) NOT NULL,
  subject varchar(512),
  from_address varchar(320),
  certs jsonb NOT NULL DEFAULT '[]'::jsonb,
  matched_public_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  unmatched_certs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ingest_note varchar(128),
  status varchar(24) NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vault_psa_arrival_reviews_gmail_message_unique UNIQUE (gmail_message_id),
  CONSTRAINT vault_psa_arrival_reviews_status_check CHECK (
    status IN ('pending', 'confirmed', 'dismissed')
  )
);

CREATE INDEX IF NOT EXISTS idx_vault_psa_arrival_reviews_status
  ON vault_psa_arrival_reviews (status);

ALTER TABLE vault_psa_arrival_reviews
  ADD COLUMN IF NOT EXISTS ingest_note varchar(128);
