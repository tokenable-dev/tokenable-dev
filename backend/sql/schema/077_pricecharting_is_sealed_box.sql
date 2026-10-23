-- Partner box search flag. Same rules as catalogProductIsBox / SEALED_BOX_SQL
-- in pricecharting-catalog-search.ts. CSV upsert refreshes this column.

ALTER TABLE pricecharting_products
  ADD COLUMN IF NOT EXISTS is_sealed_box boolean NOT NULL DEFAULT false;

-- Keep in sync with BOX_NAME / CARD_NOISE / SEALED_BOX_SQL in
-- backend/src/pricecharting/pricecharting-catalog-search.ts
UPDATE pricecharting_products
SET is_sealed_box = (
  (
    genre = 'Sealed Product'
    AND (
      product_name ~* '\m(box|booster bundle|half booster bundle|booster display|bundle display|build & battle stadium|build and battle stadium|build & battle display|collector chest|collectors chest|ultra-premium collection|ultra premium collection|premium collection|booster case)\M'
      OR console_name ~* '\m(box|booster bundle|half booster bundle|booster display|bundle display|build & battle stadium|build and battle stadium|build & battle display|collector chest|collectors chest|ultra-premium collection|ultra premium collection|premium collection|booster case)\M'
    )
  )
  OR (
    genre IS DISTINCT FROM 'Sealed Product'
    AND genre IS DISTINCT FROM 'Board & Card'
    AND (genre ILIKE '%card%' OR genre IS NULL OR genre = '')
    AND product_name ~* '\m(box|booster bundle|half booster bundle|booster display|bundle display|build & battle stadium|build and battle stadium|build & battle display|collector chest|collectors chest|ultra-premium collection|ultra premium collection|premium collection|booster case)\M'
    AND product_name !~* 'box topper|buy-a-box|buy a box|illustration box|storage box set|code in box|long box|cardboard box|big box|treasure box|puzzle box|ancient gear box|fairy box|mirror box|boom box|attack-in-the-box|tool box|toolbox|box of friends|box of |mystic box|music box|secret box|box promo|grand box|promotion pack'
    AND product_name !~ '#[0-9]'
    AND product_name !~ '[A-Za-z0-9]{2,8}-[A-Za-z]{0,4}[0-9]{2,4}'
  )
);

-- Covering index: partner search filters ~2k sealed rows without heap fetches.
DROP INDEX IF EXISTS idx_pricecharting_products_sealed_box;
CREATE INDEX idx_pricecharting_products_sealed_box
  ON pricecharting_products (id)
  INCLUDE (
    product_name,
    console_name,
    genre,
    release_date,
    upc,
    loose_price_cents,
    cover_image_url
  )
  WHERE is_sealed_box;

COMMENT ON COLUMN pricecharting_products.is_sealed_box IS
  'Partner sealed-box mint search. Set on CSV upsert from catalogProductIsBox; not a PriceCharting CSV column. Must be backfilled (this file) after ADD COLUMN — default false alone leaves search empty.';
