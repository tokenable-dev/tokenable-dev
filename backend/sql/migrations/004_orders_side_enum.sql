-- 기존 DB: orders 에 ask/bid 구분 (마켓 그리드=매도만, 상세=매수 호가)
-- 실행: psql -f 004_orders_side_enum.sql

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'orders_side_enum') THEN
    CREATE TYPE orders_side_enum AS ENUM ('ask', 'bid');
  END IF;
END
$$;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS side orders_side_enum NOT NULL DEFAULT 'ask';

CREATE INDEX IF NOT EXISTS idx_orders_token_side_status
  ON orders (token_id, side, status);
