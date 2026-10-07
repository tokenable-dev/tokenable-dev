-- Stamp marketplace_collections with the RWA address they belong to.
-- Existing activity is backfilled from orders / rwa_tokens. Unstamped rows with
-- no orders and no tokens are leftover catalogs (they showed on every admin chain).

ALTER TABLE marketplace_collections
  ADD COLUMN IF NOT EXISTS token_contract varchar(42);

COMMENT ON COLUMN marketplace_collections.token_contract IS
  'RWA address this catalog was created for. Public/admin lists also match orders and tokens on that address.';

CREATE INDEX IF NOT EXISTS idx_marketplace_collections_token_contract
  ON marketplace_collections (lower(token_contract))
  WHERE token_contract IS NOT NULL;

UPDATE marketplace_collections c
SET token_contract = sub.addr
FROM (
  SELECT lower(collection_key) AS k, min(lower(token_contract)) AS addr
  FROM (
    SELECT collection_key, token_contract FROM orders
    WHERE collection_key IS NOT NULL AND token_contract IS NOT NULL
    UNION ALL
    SELECT collection_key, token_contract FROM rwa_tokens
    WHERE collection_key IS NOT NULL AND token_contract IS NOT NULL
  ) x
  GROUP BY 1
) sub
WHERE lower(c.collection_key) = sub.k
  AND c.token_contract IS NULL;
