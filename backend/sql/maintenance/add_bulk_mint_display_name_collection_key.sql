-- Partner bulk mint: persist list title + marketplace bucket from prepare until commit.
ALTER TABLE bulk_mint_job_items
  ADD COLUMN IF NOT EXISTS display_name varchar(512);

ALTER TABLE bulk_mint_job_items
  ADD COLUMN IF NOT EXISTS collection_key varchar(64);

COMMENT ON COLUMN bulk_mint_job_items.display_name IS
  'Card title from PSA prepare (passed to rwa_tokens.display_name at mint).';

COMMENT ON COLUMN bulk_mint_job_items.collection_key IS
  'Marketplace bucket from graded prepare metadata (passed to rwa_tokens.collection_key at mint).';
