ALTER TABLE rwa_tokens
  ADD COLUMN IF NOT EXISTS display_image_back_url text;

COMMENT ON COLUMN rwa_tokens.display_image_back_url IS
  'Platform S3 slab back URL (mint ingest or admin upload).';
