-- Existing DBs that already have vault_psa_arrival_reviews without ingest_note
ALTER TABLE vault_psa_arrival_reviews
  ADD COLUMN IF NOT EXISTS ingest_note varchar(128);
