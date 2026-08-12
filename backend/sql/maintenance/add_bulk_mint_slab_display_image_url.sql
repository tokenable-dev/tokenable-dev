-- Partner bulk mint: persist S3 slab URL from prepare until on-chain commit.
ALTER TABLE bulk_mint_job_items
  ADD COLUMN IF NOT EXISTS slab_display_image_url text;

COMMENT ON COLUMN bulk_mint_job_items.slab_display_image_url IS
  'Platform S3 slab URL from prepare (passed to rwa_tokens.display_image_url at mint).';
