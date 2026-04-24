-- Dev-only: synthetic **fulfilled ask** rows so collection charts / platformUsd have ~2 months of points.
-- Source: `CollectionMarketService.platformTradesForApi` — uses fulfilled asks, `updated_at`, `consideration_amount`.
--
-- Before run: set addresses below to match `backend/.env` (Sepolia).
-- Re-runnable: deletes previous rows seeded with `parameters._seedChart = true` in the same transaction body.
--
-- Docker (repo root):
--   docker exec -i tokenable-postgres psql -U tokenable -d tokenable < backend/sql/seed-dev-platform-chart-fills.sql
-- Local psql:
--   psql "$DATABASE_URL" -f backend/sql/seed-dev-platform-chart-fills.sql

DO $$
DECLARE
  -- ▼ Edit if your .env differs
  rwa_contract text := '0x54f867520fece066F769ff441735B57169755Fc4';
  usdc_contract text := '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238';
  seller text := '0x0000000000000000000000000000000000000001';

  ck text;
  tid text;
  i int;
  ts timestamptz;
  days_back numeric;
  amt_micros bigint;
  base_micros numeric;
  h text;
  n int := 36;
BEGIN
  SELECT collection_key INTO ck FROM marketplace_collections ORDER BY created_at ASC LIMIT 1;
  IF ck IS NULL THEN
    RAISE EXCEPTION 'marketplace_collections is empty — create at least one collection (e.g. list an RWA) first.';
  END IF;

  SELECT o.token_id INTO tid
  FROM orders o
  WHERE o.collection_key IS NOT NULL
    AND lower(o.collection_key) = lower(ck)
    AND o.token_id IS NOT NULL
    AND o.token_id <> '0'
  LIMIT 1;
  IF tid IS NULL THEN
    tid := '1';
  END IF;

  DELETE FROM orders
  WHERE parameters->>'_seedChart' = 'true';

  FOR i IN 1..n LOOP
    -- Spread from ~60d ago → now (slightly uneven spacing feels natural)
    days_back := 60.0 * (1.0 - (i - 1)::numeric / GREATEST(n - 1, 1));
    ts := now() - (days_back * interval '1 day') + (random() - 0.5) * interval '6 hours';

    -- ~12 USDC → ~24 USDC gentle trend + small wiggle (still plausible card sales)
    base_micros := 12000000 + (i::numeric / n::numeric) * 12000000;
    amt_micros := floor(base_micros + 400000 * sin(i * 0.7) + (random() - 0.5) * 900000)::bigint;
    IF amt_micros < 5_000_000 THEN
      amt_micros := 5_000_000;
    END IF;

    h := '0x' || md5(random()::text || clock_timestamp()::text || i::text)
      || md5(i::text || random()::text || ck);

    INSERT INTO orders (
      order_hash,
      offerer,
      side,
      token_contract,
      token_id,
      collection_key,
      consideration_token,
      consideration_amount,
      parameters,
      signature,
      status,
      start_time,
      end_time,
      created_at,
      updated_at
    ) VALUES (
      h,
      seller,
      'ask',
      rwa_contract,
      tid,
      ck,
      usdc_contract,
      amt_micros::text,
      jsonb_build_object(
        '_tapeFillSide', 'buy',
        '_seedChart', 'true',
        'offer', '[]'::jsonb,
        'consideration', '[]'::jsonb
      ),
      '0x' || repeat('0', 128),
      'fulfilled',
      ts - interval '2 days',
      ts + interval '365 days',
      ts,
      ts
    );
  END LOOP;

  RAISE NOTICE 'Seeded % chart rows for collection_key=% token_id=%', n, ck, tid;
END $$;
