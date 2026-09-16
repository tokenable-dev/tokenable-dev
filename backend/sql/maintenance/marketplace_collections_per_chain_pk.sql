-- Per-chain catalog rows: PK (collection_key, token_contract).
-- Same graded bucket identity (collection_key) may exist once per RWA address
-- with independent review_status / cover. Snapshots stay keyed by collection_key only.
--
-- Existing DBs: apply manually (TypeORM synchronize will not rewrite the PK safely).

BEGIN;

ALTER TABLE marketplace_collections
  ADD COLUMN IF NOT EXISTS token_contract varchar(42);

-- Drop single-column PK first so we can clone the same collection_key per RWA.
ALTER TABLE marketplace_collections
  DROP CONSTRAINT IF EXISTS marketplace_collections_pkey;

-- Some DBs name the PK from TypeORM differently.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT tc.constraint_name INTO cname
  FROM information_schema.table_constraints tc
  WHERE tc.table_name = 'marketplace_collections'
    AND tc.constraint_type = 'PRIMARY KEY'
  LIMIT 1;
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE marketplace_collections DROP CONSTRAINT %I', cname);
  END IF;
END $$;

CREATE TEMP TABLE _mc_activity ON COMMIT DROP AS
SELECT lower(collection_key) AS k, lower(token_contract) AS addr
FROM (
  SELECT collection_key, token_contract FROM orders
  WHERE collection_key IS NOT NULL AND token_contract IS NOT NULL
  UNION
  SELECT collection_key, token_contract FROM rwa_tokens
  WHERE collection_key IS NOT NULL AND token_contract IS NOT NULL
) x
GROUP BY 1, 2;

-- Stamp null rows that have exactly one activity contract.
UPDATE marketplace_collections c
SET token_contract = a.addr
FROM (
  SELECT k, min(addr) AS addr
  FROM _mc_activity
  GROUP BY k
  HAVING count(*) = 1
) a
WHERE lower(c.collection_key) = a.k
  AND c.token_contract IS NULL;

-- Clone catalog for every activity contract missing a stamped row.
INSERT INTO marketplace_collections (
  collection_key,
  display_label,
  query_used,
  components,
  cover_image_url,
  psa_cert_number,
  market_parallel_key,
  bucket_key_version,
  review_status,
  token_contract,
  created_at
)
SELECT
  src.collection_key,
  src.display_label,
  src.query_used,
  src.components,
  src.cover_image_url,
  src.psa_cert_number,
  src.market_parallel_key,
  src.bucket_key_version,
  'pending_review',
  a.addr,
  now()
FROM _mc_activity a
JOIN LATERAL (
  SELECT c.*
  FROM marketplace_collections c
  WHERE lower(c.collection_key) = a.k
  ORDER BY
    CASE WHEN c.token_contract IS NOT NULL THEN 0 ELSE 1 END,
    c.created_at DESC
  LIMIT 1
) src ON true
WHERE NOT EXISTS (
  SELECT 1
  FROM marketplace_collections e
  WHERE lower(e.collection_key) = a.k
    AND e.token_contract IS NOT NULL
    AND lower(e.token_contract) = a.addr
);

-- Drop unstamped leftovers with no inventory.
DELETE FROM marketplace_collections c
WHERE c.token_contract IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM _mc_activity a WHERE a.k = lower(c.collection_key)
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM marketplace_collections WHERE token_contract IS NULL
  ) THEN
    RAISE EXCEPTION
      'marketplace_collections still has null token_contract rows; stamp or delete them before composite PK';
  END IF;
END $$;

UPDATE marketplace_collections
SET token_contract = lower(token_contract)
WHERE token_contract <> lower(token_contract);

ALTER TABLE marketplace_collections
  ALTER COLUMN token_contract SET NOT NULL;

ALTER TABLE marketplace_collections
  ADD CONSTRAINT marketplace_collections_pkey
  PRIMARY KEY (collection_key, token_contract);

CREATE INDEX IF NOT EXISTS idx_marketplace_collections_token_contract
  ON marketplace_collections (token_contract);

CREATE INDEX IF NOT EXISTS idx_marketplace_collections_token_created
  ON marketplace_collections (token_contract, created_at DESC);

COMMENT ON COLUMN marketplace_collections.token_contract IS
  'RWA address this catalog row belongs to. PK with collection_key — one review/cover lifecycle per chain.';

COMMENT ON TABLE marketplace_collections IS
  'Logical graded bucket (collection_key) per RWA (token_contract). Markets lists active rows for the request chain only.';

COMMIT;
