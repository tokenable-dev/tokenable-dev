-- Dev: marketplace trading tables — PG native ENUM + TypeORM synchronize causes
-- `*_enum = *_enum_old` failures. Run once if Nest still fails after pulling varchar entities.
-- Default user/db: tokenable / tokenable (see repo docker-compose.yml).
BEGIN;

ALTER TABLE IF EXISTS asks ALTER COLUMN status DROP DEFAULT;
ALTER TABLE IF EXISTS asks ALTER COLUMN status TYPE varchar(32) USING status::text;
ALTER TABLE IF EXISTS asks ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE IF EXISTS bids ALTER COLUMN status DROP DEFAULT;
ALTER TABLE IF EXISTS bids ALTER COLUMN status TYPE varchar(32) USING status::text;
ALTER TABLE IF EXISTS bids ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE IF EXISTS orders ALTER COLUMN side DROP DEFAULT;
ALTER TABLE IF EXISTS orders ALTER COLUMN side TYPE varchar(16) USING side::text;
ALTER TABLE IF EXISTS orders ALTER COLUMN side SET DEFAULT 'ask';

ALTER TABLE IF EXISTS orders ALTER COLUMN status DROP DEFAULT;
ALTER TABLE IF EXISTS orders ALTER COLUMN status TYPE varchar(32) USING status::text;
ALTER TABLE IF EXISTS orders ALTER COLUMN status SET DEFAULT 'active';

ALTER TABLE IF EXISTS match_intents ALTER COLUMN match_state DROP DEFAULT;
ALTER TABLE IF EXISTS match_intents ALTER COLUMN match_state TYPE varchar(32) USING match_state::text;
ALTER TABLE IF EXISTS match_intents ALTER COLUMN match_state SET DEFAULT 'matched';

ALTER TABLE IF EXISTS trade_executions ALTER COLUMN execution_state DROP DEFAULT;
ALTER TABLE IF EXISTS trade_executions ALTER COLUMN execution_state TYPE varchar(32) USING execution_state::text;
ALTER TABLE IF EXISTS trade_executions ALTER COLUMN execution_state SET DEFAULT 'pending';

DROP TYPE IF EXISTS asks_status_enum_old CASCADE;
DROP TYPE IF EXISTS asks_status_enum CASCADE;
DROP TYPE IF EXISTS bids_status_enum_old CASCADE;
DROP TYPE IF EXISTS bids_status_enum CASCADE;
DROP TYPE IF EXISTS orders_side_enum_old CASCADE;
DROP TYPE IF EXISTS orders_side_enum CASCADE;
DROP TYPE IF EXISTS orders_status_enum_old CASCADE;
DROP TYPE IF EXISTS orders_status_enum CASCADE;
DROP TYPE IF EXISTS match_intents_match_state_enum_old CASCADE;
DROP TYPE IF EXISTS match_intents_match_state_enum CASCADE;
DROP TYPE IF EXISTS trade_executions_execution_state_enum_old CASCADE;
DROP TYPE IF EXISTS trade_executions_execution_state_enum CASCADE;

COMMIT;
