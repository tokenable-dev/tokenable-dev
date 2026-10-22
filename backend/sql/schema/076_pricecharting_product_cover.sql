-- Admin representative image for a PriceCharting catalog product.
-- CSV upsert does not write this column, so a re-import leaves it in place.
-- Later used as the sealed-box collection image.

ALTER TABLE pricecharting_products
  ADD COLUMN IF NOT EXISTS cover_image_url text;

COMMENT ON COLUMN pricecharting_products.cover_image_url IS
  'Admin-set representative image. Not part of the PriceCharting CSV upsert.';
