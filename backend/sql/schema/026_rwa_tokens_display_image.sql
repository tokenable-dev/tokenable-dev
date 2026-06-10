-- Admin override for per-token display image (listed RWA cards).
ALTER TABLE rwa_tokens
  ADD COLUMN IF NOT EXISTS display_image_url text;

COMMENT ON COLUMN rwa_tokens.display_image_url IS
  'Admin override HTTPS/ipfs image URL; takes precedence over on-chain metadata when resolving imageUrl.';
