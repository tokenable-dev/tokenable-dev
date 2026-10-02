ALTER TABLE bulk_mint_job_items
  ADD COLUMN IF NOT EXISTS slab_display_image_back_url text;

COMMENT ON COLUMN bulk_mint_job_items.slab_display_image_back_url IS
  'Platform S3 slab back URL from prepare (passed to rwa_tokens.display_image_back_url at mint).';
