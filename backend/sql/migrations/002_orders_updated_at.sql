-- 기존 DB: 주문 이력 최신순(판매·취소 시각) 정렬용
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE orders SET updated_at = created_at;
