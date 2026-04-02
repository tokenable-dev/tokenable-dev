-- 빈 Postgres(관계 0개)에 TypeORM 엔티티와 동일한 최소 스키마를 만듭니다.
-- EC2: docker exec -i tokenable-postgres psql -U tokenable -d tokenable -f - < 이파일
-- 또는: cat bootstrap-empty-prod-db.sql | docker exec -i tokenable-postgres psql -U tokenable -d tokenable

-- ── enums (TypeORM enumName 과 동일) ─────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE orders_side_enum AS ENUM ('ask', 'bid');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE orders_status_enum AS ENUM ('active', 'fulfilled', 'cancelled', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ── users ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL UNIQUE,
  google_id varchar(64) UNIQUE,
  name varchar(200),
  picture_url text,
  email_verified boolean NOT NULL DEFAULT false,
  platform_email_verified_at timestamptz,
  email_verification_token_hash varchar(64),
  email_verification_expires_at timestamptz,
  verification_email_last_sent_at timestamptz,
  wallet_address varchar(42) UNIQUE,
  wallet_linked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ── marketplace_collections ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS marketplace_collections (
  collection_key varchar(255) PRIMARY KEY,
  display_label varchar NOT NULL,
  query_used text,
  components jsonb NOT NULL,
  cover_image_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── orders ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS orders (
  id serial PRIMARY KEY,
  order_hash varchar(255) NOT NULL UNIQUE,
  offerer varchar(255) NOT NULL,
  side orders_side_enum NOT NULL DEFAULT 'ask',
  token_contract varchar(255) NOT NULL,
  token_id varchar(255) NOT NULL,
  collection_key varchar(64),
  consideration_token varchar(255) NOT NULL,
  consideration_amount varchar(255) NOT NULL,
  parameters jsonb NOT NULL,
  signature varchar(255) NOT NULL,
  status orders_status_enum NOT NULL DEFAULT 'active',
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orders_offerer ON orders (offerer);
CREATE INDEX IF NOT EXISTS idx_orders_token_id ON orders (token_id);
CREATE INDEX IF NOT EXISTS idx_orders_collection_key ON orders (collection_key);
CREATE INDEX IF NOT EXISTS idx_orders_end_time ON orders (end_time);
