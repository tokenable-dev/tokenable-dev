-- JustTCG 카드 아트 기반 컬렉션 대표 이미지 (cert/슬랩 사진과 분리)
-- psql -f 008_marketplace_collections_cover_image.sql

ALTER TABLE marketplace_collections
  ADD COLUMN IF NOT EXISTS cover_image_url TEXT NULL;
