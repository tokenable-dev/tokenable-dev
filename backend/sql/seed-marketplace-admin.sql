-- Seed marketplace admin account (id: skyand, password: 071725)
-- Safe to re-run: upserts username + password_hash.
--
-- Docker (EC2):
--   docker exec -i tokenable-postgres env PGPASSWORD=tokenable \
--     psql -U tokenable -d tokenable -v ON_ERROR_STOP=1 \
--     < /home/ubuntu/app/backend/sql/seed-marketplace-admin.sql
--
-- Local:
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f backend/sql/seed-marketplace-admin.sql

INSERT INTO marketplace_admins (username, password_hash)
VALUES (
  'skyand',
  'scrypt:f7e42ee772cb51229c26cb57302b18f3:210f55127106df111392a90547c59281d521fd9a888b57ed5cbb834c66b880f1feaf634be44f22e7289eea7958e7814a562fe21c26f93bda0a5eb620bded8e36'
)
ON CONFLICT (username) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  updated_at = now();
