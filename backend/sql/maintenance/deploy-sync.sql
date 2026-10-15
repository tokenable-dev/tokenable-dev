-- Idempotent schema sync for existing DBs — run on every deploy (apply-deploy-maintenance.sh).
-- Fresh empty DB: use bootstrap-empty-prod-db.sql instead.
-- Source of truth for shape: backend/sql/schema/*.sql + TypeORM entities.

-- ── add_user_settings_prefs_and_addresses.sql ──
-- Existing DBs: Settings prefs on users + shipping address book.
-- Local/dev with TypeORM synchronize may already have these columns/tables.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS marketing_emails_opt_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_notifications_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS email_notif_prefs jsonb NOT NULL DEFAULT '{"trades":true,"bids":true,"price":true,"vault":true}'::jsonb;

COMMENT ON COLUMN users.marketing_emails_opt_in IS 'Settings: product news / drops opt-in (delivery TBD).';
COMMENT ON COLUMN users.email_notifications_enabled IS 'Settings: master switch for category email prefs.';
COMMENT ON COLUMN users.email_notif_prefs IS 'Settings: {trades,bids,price,vault} email category toggles.';

CREATE TABLE IF NOT EXISTS user_shipping_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label varchar(64) NOT NULL DEFAULT 'Home',
  name varchar(128) NOT NULL,
  line1 varchar(256) NOT NULL,
  line2 varchar(256),
  city varchar(128) NOT NULL,
  region varchar(128),
  postal varchar(32) NOT NULL,
  country varchar(8) NOT NULL DEFAULT 'us',
  phone varchar(40) NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_shipping_addresses_country_check
    CHECK (country IN ('us', 'ca', 'intl'))
);

CREATE INDEX IF NOT EXISTS idx_user_shipping_addresses_user_id
  ON user_shipping_addresses (user_id);

CREATE UNIQUE INDEX IF NOT EXISTS user_shipping_addresses_one_default
  ON user_shipping_addresses (user_id)
  WHERE is_default = true;

COMMENT ON TABLE user_shipping_addresses IS
  'Saved ship-to addresses for vault redeem / physical withdrawal (Settings address book).';

CREATE OR REPLACE FUNCTION tokenable_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_shipping_addresses_updated_at ON user_shipping_addresses;
CREATE TRIGGER trg_user_shipping_addresses_updated_at
  BEFORE UPDATE ON user_shipping_addresses
  FOR EACH ROW
  EXECUTE PROCEDURE tokenable_set_updated_at();


-- ── add_marketplace_partners.sql ──
-- Existing DBs: create marketplace_partners (safe to re-run).
-- Docker:
--   docker exec -i tokenable-postgres psql -U tokenable -d tokenable \
--     < backend/sql/maintenance/add_marketplace_partners.sql

CREATE TABLE IF NOT EXISTS marketplace_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name varchar(128) NOT NULL,
  wallet_address varchar(42) NOT NULL,
  encrypted_private_key text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_partners_wallet_unique UNIQUE (wallet_address)
);

CREATE INDEX IF NOT EXISTS idx_marketplace_partners_active
  ON marketplace_partners (is_active);


-- ── alter_marketplace_partners_optional_pk.sql ──
-- Self-vault partners may register wallet + display name without an entrusted PK.
-- Bulk mint/list still requires a private key (set later via PATCH).

ALTER TABLE marketplace_partners
  ALTER COLUMN encrypted_private_key DROP NOT NULL;

COMMENT ON COLUMN marketplace_partners.encrypted_private_key IS
  'AES-256-GCM blob (optional). Required for partner bulk mint+list. Never return to clients.';


-- ── add_marketplace_partner_addresses.sql ──
-- Existing DBs: partner company / Self-vault Origin address.

\ir ../schema/066_marketplace_partner_addresses.sql

DROP TRIGGER IF EXISTS trg_marketplace_partner_addresses_updated_at
  ON marketplace_partner_addresses;
CREATE TRIGGER trg_marketplace_partner_addresses_updated_at
  BEFORE UPDATE ON marketplace_partner_addresses
  FOR EACH ROW
  EXECUTE PROCEDURE tokenable_set_updated_at();


-- ── add_bulk_mint_tables.sql ──
-- Existing DBs: create partner bulk mint+list tables (safe to re-run for empty DBs).
-- Requires marketplace_partners first:
--   docker exec -i tokenable-postgres psql -U tokenable -d tokenable \
--     < backend/sql/maintenance/add_marketplace_partners.sql
-- Then:
--   docker exec -i tokenable-postgres psql -U tokenable -d tokenable \
--     < backend/sql/maintenance/add_bulk_mint_tables.sql
--
-- If you already have the old custody/intended_recipient bulk mint tables, use
-- migrate_bulk_mint_to_partner_list.sql instead.

CREATE TABLE IF NOT EXISTS bulk_mint_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status varchar(32) NOT NULL,
  partner_id uuid NOT NULL REFERENCES marketplace_partners(id),
  chain_id int NOT NULL,
  item_count int NOT NULL DEFAULT 0,
  prepared_count int NOT NULL DEFAULT 0,
  minted_count int NOT NULL DEFAULT 0,
  listed_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bulk_mint_jobs_status_check
    CHECK (status IN (
      'pending',
      'preparing',
      'ready_to_commit',
      'committing',
      'completed',
      'failed'
    ))
);

CREATE TABLE IF NOT EXISTS bulk_mint_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES bulk_mint_jobs(id) ON DELETE CASCADE,
  cert_number varchar(32) NOT NULL,
  list_price_usdc varchar(32) NOT NULL,
  status varchar(32) NOT NULL,
  token_uri text,
  vault_ref varchar(66),
  token_id varchar(32),
  tx_hash varchar(66),
  order_hash varchar(66),
  vault_cycle_id uuid,
  error_message text,
  sort_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bulk_mint_job_items_status_check
    CHECK (status IN (
      'pending',
      'preparing',
      'ready',
      'minting',
      'minted',
      'listed',
      'prepare_failed',
      'mint_failed',
      'list_failed',
      'skipped'
    ))
);

CREATE INDEX IF NOT EXISTS idx_bulk_mint_job_items_job_id
  ON bulk_mint_job_items (job_id);

CREATE INDEX IF NOT EXISTS idx_bulk_mint_job_items_cert
  ON bulk_mint_job_items (cert_number);

CREATE INDEX IF NOT EXISTS idx_bulk_mint_jobs_partner_id
  ON bulk_mint_jobs (partner_id);

CREATE INDEX IF NOT EXISTS idx_bulk_mint_job_items_order_hash
  ON bulk_mint_job_items (order_hash);


-- ── migrate_bulk_mint_to_partner_list.sql ──
-- Migrate bulk mint jobs from custody/intended_recipient → partner mint+list.
-- Prerequisites: marketplace_partners exists (add_marketplace_partners.sql).
--
-- Jobs that still have intended_recipient and no partner_id are DELETED (cannot
-- map without a partner). Items without a price get placeholder '0' then fail
-- list until recreated — prefer empty/dev DBs.
--
-- Docker:
--   docker exec -i tokenable-postgres psql -U tokenable -d tokenable \
--     < backend/sql/maintenance/migrate_bulk_mint_to_partner_list.sql

CREATE TABLE IF NOT EXISTS marketplace_partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name varchar(128) NOT NULL,
  wallet_address varchar(42) NOT NULL,
  encrypted_private_key text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT marketplace_partners_wallet_unique UNIQUE (wallet_address)
);

ALTER TABLE bulk_mint_jobs
  ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES marketplace_partners(id);

ALTER TABLE bulk_mint_jobs
  ADD COLUMN IF NOT EXISTS listed_count int NOT NULL DEFAULT 0;

-- Unmigratable legacy jobs (no partner) — drop so NOT NULL can apply
DELETE FROM bulk_mint_jobs WHERE partner_id IS NULL;

ALTER TABLE bulk_mint_jobs
  ALTER COLUMN partner_id SET NOT NULL;

ALTER TABLE bulk_mint_jobs
  DROP COLUMN IF EXISTS intended_recipient;

ALTER TABLE bulk_mint_job_items
  ADD COLUMN IF NOT EXISTS list_price_usdc varchar(32);

ALTER TABLE bulk_mint_job_items
  ADD COLUMN IF NOT EXISTS order_hash varchar(66);

UPDATE bulk_mint_job_items
  SET list_price_usdc = '0'
  WHERE list_price_usdc IS NULL;

ALTER TABLE bulk_mint_job_items
  ALTER COLUMN list_price_usdc SET NOT NULL;

ALTER TABLE bulk_mint_job_items
  DROP CONSTRAINT IF EXISTS bulk_mint_job_items_status_check;

ALTER TABLE bulk_mint_job_items
  ADD CONSTRAINT bulk_mint_job_items_status_check
  CHECK (status IN (
    'pending',
    'preparing',
    'ready',
    'minting',
    'minted',
    'listed',
    'prepare_failed',
    'mint_failed',
    'list_failed',
    'skipped'
  ));

CREATE INDEX IF NOT EXISTS idx_bulk_mint_jobs_partner_id
  ON bulk_mint_jobs (partner_id);

CREATE INDEX IF NOT EXISTS idx_bulk_mint_job_items_order_hash
  ON bulk_mint_job_items (order_hash);


-- ── add_bulk_mint_display_name_collection_key.sql ──
-- Partner bulk mint: persist list title + marketplace bucket from prepare until commit.
ALTER TABLE bulk_mint_job_items
  ADD COLUMN IF NOT EXISTS display_name varchar(512);

ALTER TABLE bulk_mint_job_items
  ADD COLUMN IF NOT EXISTS collection_key varchar(64);

COMMENT ON COLUMN bulk_mint_job_items.display_name IS
  'Card title from PSA prepare (passed to rwa_tokens.display_name at mint).';

COMMENT ON COLUMN bulk_mint_job_items.collection_key IS
  'Marketplace bucket from graded prepare metadata (passed to rwa_tokens.collection_key at mint).';


-- ── add_bulk_mint_slab_display_image_url.sql ──
-- Partner bulk mint: persist S3 slab URL from prepare until on-chain commit.
ALTER TABLE bulk_mint_job_items
  ADD COLUMN IF NOT EXISTS slab_display_image_url text;

COMMENT ON COLUMN bulk_mint_job_items.slab_display_image_url IS
  'Platform S3 slab URL from prepare (passed to rwa_tokens.display_image_url at mint).';


-- ── add_bulk_mint_slab_display_image_back_url.sql ──
ALTER TABLE bulk_mint_job_items
  ADD COLUMN IF NOT EXISTS slab_display_image_back_url text;

COMMENT ON COLUMN bulk_mint_job_items.slab_display_image_back_url IS
  'Platform S3 slab back URL from prepare (passed to rwa_tokens.display_image_back_url at mint).';


-- ── add_vault_submissions.sql ──
-- Existing DBs: sell-flow submission tracking (pre-mint).
-- Fresh bootstrap already includes these tables via schema/020_vault.sql.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f backend/sql/maintenance/add_vault_submissions.sql

\set ON_ERROR_STOP on

BEGIN;

CREATE TABLE IF NOT EXISTS vault_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id varchar(32) NOT NULL,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status varchar(32) NOT NULL DEFAULT 'draft',
  carrier varchar(32),
  tracking_number varchar(128),
  ship_date date,
  shipped_at timestamptz,
  packing_slip_downloaded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vault_submissions_public_id_unique UNIQUE (public_id),
  CONSTRAINT vault_submissions_status_check CHECK (
    status IN (
      'draft',
      'awaiting_shipment',
      'in_transit',
      'psa_reviewing',
      'completed',
      'cancelled'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_vault_submissions_user_id ON vault_submissions (user_id);
CREATE INDEX IF NOT EXISTS idx_vault_submissions_user_status ON vault_submissions (user_id, status);

CREATE TABLE IF NOT EXISTS vault_submission_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES vault_submissions(id) ON DELETE CASCADE,
  cert_number varchar(32) NOT NULL,
  display_name varchar(512),
  grade varchar(32),
  image_url text,
  status varchar(24) NOT NULL DEFAULT 'draft',
  rejection_reason text,
  vault_cycle_id uuid REFERENCES vault_cycles(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vault_submission_items_submission_cert_unique UNIQUE (submission_id, cert_number),
  CONSTRAINT vault_submission_items_status_check CHECK (
    status IN (
      'draft',
      'confirmed',
      'in_transit',
      'reviewing',
      'approved',
      'rejected',
      'minting',
      'completed',
      'failed'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_vault_submission_items_submission_id
  ON vault_submission_items (submission_id);
CREATE INDEX IF NOT EXISTS idx_vault_submission_items_cert
  ON vault_submission_items (cert_number);
CREATE INDEX IF NOT EXISTS idx_vault_submission_items_cycle
  ON vault_submission_items (vault_cycle_id)
  WHERE vault_cycle_id IS NOT NULL;

DROP TRIGGER IF EXISTS trg_vault_submissions_updated_at ON vault_submissions;
CREATE TRIGGER trg_vault_submissions_updated_at
  BEFORE UPDATE ON vault_submissions
  FOR EACH ROW
  EXECUTE PROCEDURE tokenable_set_updated_at();

DROP TRIGGER IF EXISTS trg_vault_submission_items_updated_at ON vault_submission_items;
CREATE TRIGGER trg_vault_submission_items_updated_at
  BEFORE UPDATE ON vault_submission_items
  FOR EACH ROW
  EXECUTE PROCEDURE tokenable_set_updated_at();

COMMIT;


-- ── add_vault_submission_item_display_fields.sql ──
-- Per-cert SSOT display fields for vault hub / packing slip (sell-flow card identity).
-- Fresh bootstrap: columns are in schema/020_vault.sql.

ALTER TABLE vault_submission_items
  ADD COLUMN IF NOT EXISTS card_number varchar(64),
  ADD COLUMN IF NOT EXISTS card_year varchar(8),
  ADD COLUMN IF NOT EXISTS set_name varchar(256),
  ADD COLUMN IF NOT EXISTS language varchar(16),
  ADD COLUMN IF NOT EXISTS variant varchar(256);

COMMENT ON COLUMN vault_submission_items.card_number IS
  'SSOT card number from PSA analyze (sell-flow add-cards).';
COMMENT ON COLUMN vault_submission_items.card_year IS
  '4-digit year from PSA analyze.';
COMMENT ON COLUMN vault_submission_items.set_name IS
  'Expansion / set name from PSA analyze.';


-- ── add_vault_submissions_token_contract.sql ──
-- Stamp sell-flow packages with the RWA they were created for.
-- Linked cycles are backfilled from rwa_tokens. Unstamped rows (no mint yet,
-- or wiped before this column existed) stay NULL and are hidden from the
-- active contract's sell / vault lists.

ALTER TABLE vault_submissions
  ADD COLUMN IF NOT EXISTS chain_id integer;

ALTER TABLE vault_submissions
  ADD COLUMN IF NOT EXISTS token_contract varchar(42);

COMMENT ON COLUMN vault_submissions.token_contract IS
  'RWA address this package was created for. Lists only return the address configured for the request chain.';

CREATE INDEX IF NOT EXISTS idx_vault_submissions_token_contract
  ON vault_submissions (lower(token_contract))
  WHERE token_contract IS NOT NULL;

UPDATE vault_submissions s
SET token_contract = sub.addr,
    chain_id = COALESCE(s.chain_id, sub.chain_id)
FROM (
  SELECT i.submission_id,
         min(lower(t.token_contract)) AS addr,
         min(c.chain_id) AS chain_id
  FROM vault_submission_items i
  JOIN vault_cycles c ON c.id = i.vault_cycle_id
  JOIN rwa_tokens t ON t.vault_cycle_id = c.id
  WHERE t.token_contract IS NOT NULL
  GROUP BY i.submission_id
) sub
WHERE s.id = sub.submission_id
  AND s.token_contract IS NULL;


-- ── add_vault_cycles_chain_id.sql ──
-- Existing DBs: scope vault_cycles by chain (safe to re-run).
--
-- The on-chain activeTokenIdByVaultRef invariant is per contract (= per
-- chain), so the "one open cycle per asset" DB rule must be per (asset,
-- chain) too — otherwise a cert minted on Sepolia blocks its Polygon mint.
--
-- TypeORM synchronize alone is NOT enough: the old partial unique index
-- uq_vault_cycles_one_open_per_asset must be replaced.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f backend/sql/maintenance/add_vault_cycles_chain_id.sql

ALTER TABLE vault_cycles
  ADD COLUMN IF NOT EXISTS chain_id integer;

-- Backfill from legacy p2p_listings.chain_id when that table still exists.
DO $$
BEGIN
  IF to_regclass('public.p2p_listings') IS NOT NULL THEN
    UPDATE vault_cycles c
    SET chain_id = p.chain_id
    FROM rwa_tokens t
    JOIN p2p_listings p
      ON p.token_contract = t.token_contract AND p.token_id = t.token_id
    WHERE t.vault_cycle_id = c.id
      AND c.chain_id IS NULL;
  END IF;
END $$;

-- Remaining legacy rows: Sepolia (the only chain before Polygon launch).
UPDATE vault_cycles
SET chain_id = 11155111
WHERE chain_id IS NULL;

ALTER TABLE vault_cycles
  ALTER COLUMN chain_id SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'vault_cycles_chain_id_positive'
  ) THEN
    ALTER TABLE vault_cycles
      ADD CONSTRAINT vault_cycles_chain_id_positive CHECK (chain_id > 0);
  END IF;
END $$;

DROP INDEX IF EXISTS uq_vault_cycles_one_open_per_asset;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vault_cycles_one_open_per_asset_chain
  ON vault_cycles (vault_asset_id, chain_id)
  WHERE status NOT IN ('redeemed', 'cancelled');

COMMENT ON COLUMN vault_cycles.chain_id IS
  'EIP-155 chain id the cycle''s NFT is (or will be) minted on.';
COMMENT ON TABLE vault_cycles IS
  'One deposit→redeem lifecycle for a vault_asset on one chain. At most one open cycle per (asset, chain).';


-- ── add_vault_cycles_mint_attempt.sql ──
-- Durable mint intent: survive process death between on-chain mint and recordMintResult.
-- Safe to re-run.

ALTER TABLE vault_cycles
  ADD COLUMN IF NOT EXISTS mint_attempt jsonb;

COMMENT ON COLUMN vault_cycles.mint_attempt IS
  'Mint intent persisted before on-chain mint (tokenURI, settlement_policy, images). Cleared when status becomes minted. Used by boot recovery after crash/redeploy.';

ALTER TABLE vault_cycles
  DROP CONSTRAINT IF EXISTS vault_cycles_status_check;

ALTER TABLE vault_cycles
  ADD CONSTRAINT vault_cycles_status_check CHECK (
    status IN (
      'pending_deposit',
      'deposit_verified',
      'minting',
      'minted',
      'redemption_requested',
      'redeemed',
      'cancelled'
    )
  );

CREATE INDEX IF NOT EXISTS idx_vault_cycles_minting
  ON vault_cycles (updated_at)
  WHERE status = 'minting';


-- ── add_vault_psa_arrival_reviews.sql ──
-- Existing DBs: PSA Items Received admin review queue
CREATE TABLE IF NOT EXISTS vault_psa_arrival_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id varchar(128) NOT NULL,
  subject varchar(512),
  from_address varchar(320),
  certs jsonb NOT NULL DEFAULT '[]'::jsonb,
  matched_public_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  unmatched_certs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ingest_note varchar(128),
  status varchar(24) NOT NULL DEFAULT 'pending',
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vault_psa_arrival_reviews_gmail_message_unique UNIQUE (gmail_message_id),
  CONSTRAINT vault_psa_arrival_reviews_status_check CHECK (
    status IN ('pending', 'confirmed', 'dismissed')
  )
);

CREATE INDEX IF NOT EXISTS idx_vault_psa_arrival_reviews_status
  ON vault_psa_arrival_reviews (status);

ALTER TABLE vault_psa_arrival_reviews
  ADD COLUMN IF NOT EXISTS ingest_note varchar(128);


-- ── add_vault_psa_arrival_reviews_ingest_note.sql ──
-- Existing DBs that already have vault_psa_arrival_reviews without ingest_note
ALTER TABLE vault_psa_arrival_reviews
  ADD COLUMN IF NOT EXISTS ingest_note varchar(128);


-- ── add_vault_psa_arrival_reviews_auto_confirm.sql ──
-- Auto-confirm audit on PSA Items Received arrival reviews
ALTER TABLE vault_psa_arrival_reviews
  ADD COLUMN IF NOT EXISTS confirmed_via varchar(16),
  ADD COLUMN IF NOT EXISTS skipped_public_ids jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE vault_psa_arrival_reviews
  DROP CONSTRAINT IF EXISTS vault_psa_arrival_reviews_confirmed_via_check;

ALTER TABLE vault_psa_arrival_reviews
  ADD CONSTRAINT vault_psa_arrival_reviews_confirmed_via_check CHECK (
    confirmed_via IS NULL OR confirmed_via IN ('auto', 'admin')
  );

COMMENT ON COLUMN vault_psa_arrival_reviews.confirmed_via IS
  'How Ship→PSA was applied: auto (Gmail poll) or admin (manual Confirm).';
COMMENT ON COLUMN vault_psa_arrival_reviews.skipped_public_ids IS
  'Packages that failed adminMarkArrived at confirm time (audit).';


-- ── add_vault_psa_vaulted_reviews.sql ──
-- PSA Items Vaulted / secured mail → mint & deliver audit queue
CREATE TABLE IF NOT EXISTS vault_psa_vaulted_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gmail_message_id varchar(128) NOT NULL,
  subject varchar(512),
  from_address varchar(320),
  certs jsonb NOT NULL DEFAULT '[]'::jsonb,
  matched_item_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  matched_public_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  unmatched_certs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ingest_note varchar(128),
  status varchar(24) NOT NULL DEFAULT 'pending',
  minted_via varchar(16),
  mint_results jsonb NOT NULL DEFAULT '[]'::jsonb,
  error_summary text,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vault_psa_vaulted_reviews_gmail_message_unique UNIQUE (gmail_message_id),
  CONSTRAINT vault_psa_vaulted_reviews_status_check CHECK (
    status IN ('pending', 'minted', 'failed', 'dismissed')
  ),
  CONSTRAINT vault_psa_vaulted_reviews_minted_via_check CHECK (
    minted_via IS NULL OR minted_via IN ('auto', 'admin')
  )
);

CREATE INDEX IF NOT EXISTS idx_vault_psa_vaulted_reviews_status
  ON vault_psa_vaulted_reviews (status);

COMMENT ON TABLE vault_psa_vaulted_reviews IS
  'Gmail Items Vaulted (secured) mail; auto or admin mint-and-deliver to Live.';


-- ── add_rwa_tokens_settlement_policy.sql ──
-- Self-vault hold: Seaport asks send 100% USDC to platform; seller paid later off-protocol.
ALTER TABLE rwa_tokens
  ADD COLUMN IF NOT EXISTS settlement_policy varchar(32) NOT NULL DEFAULT 'standard';

COMMENT ON COLUMN rwa_tokens.settlement_policy IS
  'standard = Seaport seller+fee split; self_vault_hold = 100% platform take, delayed seller payout';


-- ── nullable_rwa_tokens_settlement_policy.sql ──
-- settlement_policy is set only by VaultService.recordMintResult (real mint path).
-- Owner-index Transfer stubs must NOT default to 'standard' (false PSA custody).
-- Safe to re-run.

ALTER TABLE rwa_tokens
  ALTER COLUMN settlement_policy DROP NOT NULL;

ALTER TABLE rwa_tokens
  ALTER COLUMN settlement_policy DROP DEFAULT;

-- Owner-index-only stubs: no cert / cycle → custody unknown until mint registry heals.
UPDATE rwa_tokens
SET settlement_policy = NULL
WHERE cert_number IS NULL
  AND vault_cycle_id IS NULL
  AND settlement_policy IS NOT NULL;

COMMENT ON COLUMN rwa_tokens.settlement_policy IS
  'NULL = not yet recorded from mint (custody unknown). standard = PSA vault Seaport split; self_vault_hold = partner/self vault delayed payout.';


-- ── add_rwa_tokens_display_image_back_url.sql ──
ALTER TABLE rwa_tokens
  ADD COLUMN IF NOT EXISTS display_image_back_url text;

COMMENT ON COLUMN rwa_tokens.display_image_back_url IS
  'Platform S3 slab back URL (mint ingest or admin upload).';


-- ── add_rwa_tokens_vault_partner_id.sql ──
-- Link self-vault mints to marketplace_partners for "{displayName} vault" labels.

ALTER TABLE rwa_tokens
  ADD COLUMN IF NOT EXISTS vault_partner_id uuid
    REFERENCES marketplace_partners(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rwa_tokens_vault_partner_id
  ON rwa_tokens (vault_partner_id)
  WHERE vault_partner_id IS NOT NULL;

COMMENT ON COLUMN rwa_tokens.vault_partner_id IS
  'Self-vault partner who holds the physical card; used for "{name} vault" UI labels.';


-- ── add_rwa_tokens_owner_wallet.sql ──
-- Portfolio owner index: fast wallet → token_ids lookup (replaces full-supply ownerOf scan).

ALTER TABLE rwa_tokens
  ADD COLUMN IF NOT EXISTS owner_wallet varchar(42);

CREATE INDEX IF NOT EXISTS idx_rwa_tokens_contract_owner_live
  ON rwa_tokens (token_contract, owner_wallet)
  WHERE owner_wallet IS NOT NULL AND burned_at IS NULL;

COMMENT ON COLUMN rwa_tokens.owner_wallet IS
  'Current on-chain holder (lowercase). Maintained by Transfer indexer + mint/burn writers.';


-- ── add_rwa_owner_index_cursors.sql ──
-- Tracks Transfer-log backfill progress per RWA contract.

CREATE TABLE IF NOT EXISTS rwa_owner_index_cursors (
  token_contract varchar(42) NOT NULL PRIMARY KEY,
  last_scanned_block bigint NOT NULL DEFAULT 0,
  backfill_complete boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE rwa_owner_index_cursors IS
  'When backfill_complete is true, GET /blockchain/rwa/tokens/:address reads owner_wallet from rwa_tokens.';


-- ── add_vault_redemptions_fee_payment.sql ──
-- PSA Vault redeem fee snapshot + USDC payment proof on vault_redemptions.
-- Apply: psql "$DATABASE_URL" -f backend/sql/maintenance/add_vault_redemptions_fee_payment.sql

ALTER TABLE vault_redemptions
  ADD COLUMN IF NOT EXISTS fee_retrieval_usd numeric(12, 2),
  ADD COLUMN IF NOT EXISTS fee_early_withdrawal_usd numeric(12, 2),
  ADD COLUMN IF NOT EXISTS fee_shipping_usd numeric(12, 2),
  ADD COLUMN IF NOT EXISTS fee_total_usd numeric(12, 2),
  ADD COLUMN IF NOT EXISTS payment_tx_hash varchar(80),
  ADD COLUMN IF NOT EXISTS payment_batch_id uuid,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS vaulted_at timestamptz,
  ADD COLUMN IF NOT EXISTS early_withdrawal boolean;

COMMENT ON COLUMN vault_redemptions.fee_retrieval_usd IS
  'PSA retrieval fee charged for this card (snapshot at request time).';
COMMENT ON COLUMN vault_redemptions.fee_early_withdrawal_usd IS
  'PSA early-withdrawal surcharge if vaulted < N days (snapshot).';
COMMENT ON COLUMN vault_redemptions.fee_shipping_usd IS
  'Shipping fee share — full shipment shipping on the first card of a payment batch, 0 on siblings.';
COMMENT ON COLUMN vault_redemptions.fee_total_usd IS
  'retrieval + early + shipping share for this row.';
COMMENT ON COLUMN vault_redemptions.payment_tx_hash IS
  'USDC ERC-20 transfer tx to PLATFORM_FEE_RECIPIENT that paid this batch.';
COMMENT ON COLUMN vault_redemptions.payment_batch_id IS
  'Shared id for multi-card shipment paid in one USDC transfer.';
COMMENT ON COLUMN vault_redemptions.vaulted_at IS
  'Copied from vault_cycles.deposited_at used for early-withdrawal check.';
COMMENT ON COLUMN vault_redemptions.early_withdrawal IS
  'True when early-withdrawal fee applied at request time.';

CREATE INDEX IF NOT EXISTS idx_vault_redemptions_payment_tx
  ON vault_redemptions (payment_tx_hash)
  WHERE payment_tx_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vault_redemptions_payment_batch
  ON vault_redemptions (payment_batch_id)
  WHERE payment_batch_id IS NOT NULL;


-- ── add_vault_redemptions_custody_refund.sql ──
-- Redeem custody intake + exact payment recording + refund / tracking / memo
-- Apply: psql $DATABASE_URL -f backend/sql/maintenance/add_vault_redemptions_custody_refund.sql

ALTER TABLE vault_redemptions
  ADD COLUMN IF NOT EXISTS chain_id integer,

  -- Exact USDC micros that arrived in PLATFORM_FEE_RECIPIENT for this payment_batch
  -- (same value on every row of the batch). Canonical refund amount — never recompute.
  ADD COLUMN IF NOT EXISTS payment_received_usdc_micros numeric(24, 0),

  ADD COLUMN IF NOT EXISTS custody_tx_hash varchar(80),
  ADD COLUMN IF NOT EXISTS custody_at timestamptz,
  ADD COLUMN IF NOT EXISTS custody_return_tx_hash varchar(80),
  ADD COLUMN IF NOT EXISTS custody_returned_at timestamptz,

  ADD COLUMN IF NOT EXISTS refund_status varchar(24) NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS refund_tx_hash varchar(80),
  ADD COLUMN IF NOT EXISTS refunded_usdc_micros numeric(24, 0),
  ADD COLUMN IF NOT EXISTS refunded_at timestamptz,

  ADD COLUMN IF NOT EXISTS tracking_number varchar(128),
  ADD COLUMN IF NOT EXISTS tracking_carrier varchar(64),
  ADD COLUMN IF NOT EXISTS tracking_set_at timestamptz,

  ADD COLUMN IF NOT EXISTS admin_memo text;

COMMENT ON COLUMN vault_redemptions.payment_received_usdc_micros IS
  'Batch-total USDC micros actually received (copied onto every sibling row). Never SUM across a batch; use once or read vault_redeem_payment_claims.';
COMMENT ON COLUMN vault_redemptions.custody_tx_hash IS
  'User-signed ERC-721 transfer into RWA_CUSTODY_WALLET_ADDRESS.';
COMMENT ON COLUMN vault_redemptions.refund_status IS
  'none | usdc_refunded | nft_returned | fully_refunded';
COMMENT ON COLUMN vault_redemptions.tracking_number IS
  'When set, refunds are blocked.';

-- Status values now include: in_custody, refunded (varchar already)
CREATE INDEX IF NOT EXISTS idx_vault_redemptions_payment_batch
  ON vault_redemptions (payment_batch_id)
  WHERE payment_batch_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vault_redemptions_status
  ON vault_redemptions (status);


-- ── add_vault_redemptions_ship_to.sql ──
-- Ship-to address captured at redeem request (Portfolio Redeem Phase A).
ALTER TABLE vault_redemptions
  ADD COLUMN IF NOT EXISTS ship_to_name varchar(128),
  ADD COLUMN IF NOT EXISTS ship_to_line1 varchar(256),
  ADD COLUMN IF NOT EXISTS ship_to_line2 varchar(256),
  ADD COLUMN IF NOT EXISTS ship_to_city varchar(128),
  ADD COLUMN IF NOT EXISTS ship_to_region varchar(128),
  ADD COLUMN IF NOT EXISTS ship_to_postal varchar(32),
  ADD COLUMN IF NOT EXISTS ship_to_country varchar(8),
  ADD COLUMN IF NOT EXISTS ship_to_phone varchar(40);

COMMENT ON COLUMN vault_redemptions.ship_to_country IS
  'ISO-ish country key from redeem form: us | ca | intl';


-- ── add_vault_redemptions_carrier_delivered.sql ──
-- FedEx Track → carrier delivery timestamp + how receipt was confirmed.
ALTER TABLE vault_redemptions
  ADD COLUMN IF NOT EXISTS carrier_delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS receipt_confirmed_via varchar(16);

COMMENT ON COLUMN vault_redemptions.carrier_delivered_at IS
  'When carrier Track API reported Delivered (ACTUAL_DELIVERY / DL). Starts auto-receipt grace.';
COMMENT ON COLUMN vault_redemptions.receipt_confirmed_via IS
  'user = confirm-received tap; auto = grace cron after carrier_delivered_at.';

CREATE INDEX IF NOT EXISTS idx_vault_redemptions_carrier_delivered_pending
  ON vault_redemptions (carrier_delivered_at)
  WHERE tracking_number IS NOT NULL
    AND carrier_delivered_at IS NULL
    AND status IN ('in_custody', 'burned', 'vault_release_pending');


-- ── add_vault_redeem_payment_claims.sql ──
-- Unique redeem USDC payment claims (one payment_tx_hash → one payment_batch_id).
-- Needed because multi-card batches denormalize the same payment_tx_hash onto every
-- vault_redemptions row, so UNIQUE on that column alone would break multi-card batches.
--
-- Apply: psql $DATABASE_URL -f backend/sql/maintenance/add_vault_redeem_payment_claims.sql

CREATE TABLE IF NOT EXISTS vault_redeem_payment_claims (
  payment_tx_hash varchar(80) PRIMARY KEY,
  payment_batch_id uuid NOT NULL,
  payment_received_usdc_micros numeric(24, 0),
  chain_id integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_vault_redeem_payment_claims_batch
  ON vault_redeem_payment_claims (payment_batch_id);

COMMENT ON TABLE vault_redeem_payment_claims IS
  'Source of truth: each redeem USDC payment_tx_hash funds exactly one payment_batch_id.';

-- Backfill from existing paid redemptions (one row per payment_tx_hash).
INSERT INTO vault_redeem_payment_claims (
  payment_tx_hash,
  payment_batch_id,
  payment_received_usdc_micros,
  chain_id
)
SELECT DISTINCT ON (lower(r.payment_tx_hash))
  lower(r.payment_tx_hash),
  r.payment_batch_id,
  r.payment_received_usdc_micros,
  r.chain_id
FROM vault_redemptions r
WHERE r.payment_tx_hash IS NOT NULL
  AND r.payment_batch_id IS NOT NULL
ORDER BY lower(r.payment_tx_hash), r.requested_at ASC
ON CONFLICT (payment_tx_hash) DO NOTHING;


-- ── harden_vault_redemptions_integrity.sql ──
-- Harden vault_redemptions integrity for redeem pay / custody / refund.
-- Safe to re-run. Apply after add_vault_redemptions_custody_refund.sql +
-- add_vault_redeem_payment_claims.sql.
--
-- psql … -f backend/sql/maintenance/harden_vault_redemptions_integrity.sql

-- Ensure every paid redemption hash has a claim row (FK prerequisite).
INSERT INTO vault_redeem_payment_claims (
  payment_tx_hash,
  payment_batch_id,
  payment_received_usdc_micros,
  chain_id
)
SELECT DISTINCT ON (lower(r.payment_tx_hash))
  lower(r.payment_tx_hash),
  r.payment_batch_id,
  r.payment_received_usdc_micros,
  r.chain_id
FROM vault_redemptions r
WHERE r.payment_tx_hash IS NOT NULL
  AND r.payment_batch_id IS NOT NULL
ORDER BY lower(r.payment_tx_hash), r.requested_at ASC
ON CONFLICT (payment_tx_hash) DO NOTHING;

-- Normalize hashes already written in mixed case.
UPDATE vault_redemptions
SET payment_tx_hash = lower(payment_tx_hash)
WHERE payment_tx_hash IS NOT NULL
  AND payment_tx_hash <> lower(payment_tx_hash);

-- Status CHECK must include in_custody + refunded (older DBs may lack them).
ALTER TABLE vault_redemptions
  DROP CONSTRAINT IF EXISTS vault_redemptions_status_check;

ALTER TABLE vault_redemptions
  ADD CONSTRAINT vault_redemptions_status_check CHECK (
    status IN (
      'pending',
      'ownership_verified',
      'in_custody',
      'burned',
      'vault_release_pending',
      'completed',
      'failed',
      'cancelled',
      'refunded'
    )
  );

ALTER TABLE vault_redemptions
  DROP CONSTRAINT IF EXISTS vault_redemptions_refund_status_check;

ALTER TABLE vault_redemptions
  ADD CONSTRAINT vault_redemptions_refund_status_check CHECK (
    refund_status IN (
      'none',
      'usdc_refunded',
      'nft_returned',
      'fully_refunded'
    )
  );

-- Paid redemption rows may reference the claims ledger (NULL payment_tx_hash stays unpaid).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_vault_redemptions_payment_claim'
  ) THEN
    ALTER TABLE vault_redemptions
      ADD CONSTRAINT fk_vault_redemptions_payment_claim
      FOREIGN KEY (payment_tx_hash)
      REFERENCES vault_redeem_payment_claims (payment_tx_hash)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vault_redemptions_status
  ON vault_redemptions (status);

COMMENT ON COLUMN vault_redemptions.payment_received_usdc_micros IS
  'Batch-total USDC micros actually received (copied onto every sibling row). Never SUM across a batch; use this value once or read vault_redeem_payment_claims.';

COMMENT ON COLUMN vault_redemptions.refunded_usdc_micros IS
  'Batch-total USDC micros refunded (copied onto every sibling row). Same grain as payment_received_usdc_micros — never SUM across a batch.';

COMMENT ON COLUMN vault_redemptions.ship_to_country IS
  'ISO-3166 alpha-2 destination stored at redeem time (not the fee bucket us|ca|intl).';

COMMENT ON TABLE vault_redeem_payment_claims IS
  'Ledger uniqueness: one USDC payment_tx_hash funds one payment_batch_id. Redemption rows denormalize these fields for ops joins.';


-- ── add_self_vault_settlements.sql ──
-- Existing DBs: self-vault delayed payout ledger
\ir ../schema/046_self_vault_settlements.sql


-- ── add_collection_review_status.sql ──
-- Existing DBs: add collection review gate (safe to re-run).
ALTER TABLE marketplace_collections
  ADD COLUMN IF NOT EXISTS review_status varchar(32) NOT NULL DEFAULT 'active';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'marketplace_collections_review_status_check'
  ) THEN
    ALTER TABLE marketplace_collections
      ADD CONSTRAINT marketplace_collections_review_status_check
      CHECK (review_status IN ('pending_review', 'active', 'rejected'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_marketplace_collections_review_status
  ON marketplace_collections (review_status);

COMMENT ON COLUMN marketplace_collections.review_status IS
  'pending_review | active | rejected. New inserts are pending_review; Markets lists active only.';


-- ── add_marketplace_collections_token_contract.sql ──
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


-- ── marketplace_collections_per_chain_pk.sql ──
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


-- ── add_marketplace_notifications_chain_id.sql ──
-- Existing DBs: scope marketplace_notifications by chain (safe to re-run).
--
-- Inbox must not mix Sepolia bids into a Polygon session (and vice versa).
-- Legacy rows predate multi-chain inbox → backfill as Sepolia (11155111).
-- New rows get chain_id from the bid's RWA contract at insert time.
--
--   docker exec -i tokenable-postgres psql -U tokenable -d tokenable -v ON_ERROR_STOP=1 \
--     < backend/sql/maintenance/add_marketplace_notifications_chain_id.sql

ALTER TABLE marketplace_notifications
  ADD COLUMN IF NOT EXISTS chain_id integer;

UPDATE marketplace_notifications
SET chain_id = 11155111
WHERE chain_id IS NULL;

ALTER TABLE marketplace_notifications
  ALTER COLUMN chain_id SET NOT NULL;

ALTER TABLE marketplace_notifications
  ALTER COLUMN chain_id SET DEFAULT 11155111;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'marketplace_notifications_chain_id_positive'
  ) THEN
    ALTER TABLE marketplace_notifications
      ADD CONSTRAINT marketplace_notifications_chain_id_positive
      CHECK (chain_id > 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_marketplace_notifications_recipient_chain_created
  ON marketplace_notifications (recipient_wallet, chain_id, created_at DESC);

COMMENT ON COLUMN marketplace_notifications.chain_id IS
  'Chain of the bid/ask RWA contract — list/mark-read filtered by x-tokenable-chain-id.';


-- ── ensure_marketplace_chain_indexes.sql ──
-- Existing DBs: performance indexes for chain-scoped marketplace reads (safe to re-run).
-- Mirrors partial indexes from schema/040_marketplace.sql.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f backend/sql/maintenance/ensure_marketplace_chain_indexes.sql

CREATE INDEX IF NOT EXISTS idx_orders_token_contract_id
  ON orders (token_contract, token_id);

CREATE INDEX IF NOT EXISTS idx_orders_collection_fulfilled_ask
  ON orders (collection_key, updated_at)
  WHERE status = 'fulfilled' AND side = 'ask' AND collection_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_collection_active_ask
  ON orders (collection_key)
  WHERE status = 'active' AND side = 'ask' AND collection_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_token_active_ask
  ON orders (token_contract, token_id)
  WHERE status = 'active' AND side = 'ask';

-- Hot path: collection detail / stats filter collection_key + RWA token_contract together.
CREATE INDEX IF NOT EXISTS idx_orders_collection_contract_active_ask
  ON orders (collection_key, token_contract)
  WHERE status = 'active' AND side = 'ask' AND collection_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_orders_collection_contract_fulfilled_ask
  ON orders (collection_key, token_contract, updated_at)
  WHERE status = 'fulfilled' AND side = 'ask' AND collection_key IS NOT NULL;




-- ── add_portfolio_daily_snapshot_chain_id.sql ──
-- Existing DBs: scope portfolio_daily_snapshots by chain (safe to re-run).
--
-- TypeORM synchronize alone is NOT enough: the old UNIQUE (wallet, date) must be
-- dropped or same-wallet / same-day rows on two chains cannot coexist.
--
--   psql "$DATABASE_URL" -v ON_ERROR_STOP=1 \
--     -f backend/sql/maintenance/add_portfolio_daily_snapshot_chain_id.sql

ALTER TABLE portfolio_daily_snapshots
  ADD COLUMN IF NOT EXISTS chain_id integer;

-- Backfill legacy rows as Sepolia (public default until mainnet launch).
UPDATE portfolio_daily_snapshots
SET chain_id = 11155111
WHERE chain_id IS NULL;

ALTER TABLE portfolio_daily_snapshots
  ALTER COLUMN chain_id SET NOT NULL;

ALTER TABLE portfolio_daily_snapshots
  DROP CONSTRAINT IF EXISTS portfolio_daily_snapshots_wallet_date_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'portfolio_daily_snapshots_wallet_date_chain_unique'
  ) THEN
    ALTER TABLE portfolio_daily_snapshots
      ADD CONSTRAINT portfolio_daily_snapshots_wallet_date_chain_unique
      UNIQUE (wallet_address, snapshot_date_kst, chain_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'portfolio_daily_snapshots_chain_id_positive'
  ) THEN
    ALTER TABLE portfolio_daily_snapshots
      ADD CONSTRAINT portfolio_daily_snapshots_chain_id_positive
      CHECK (chain_id > 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'portfolio_daily_snapshots_total_nonneg'
  ) THEN
    ALTER TABLE portfolio_daily_snapshots
      ADD CONSTRAINT portfolio_daily_snapshots_total_nonneg
      CHECK (total_value_usd >= 0);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'portfolio_daily_snapshots_card_count_nonneg'
  ) THEN
    ALTER TABLE portfolio_daily_snapshots
      ADD CONSTRAINT portfolio_daily_snapshots_card_count_nonneg
      CHECK (card_count >= 0);
  END IF;
END $$;

-- Read path: WHERE wallet + chain ORDER BY snapshot_at DESC
DROP INDEX IF EXISTS idx_portfolio_daily_snapshots_wallet_at;
CREATE INDEX IF NOT EXISTS idx_portfolio_daily_snapshots_wallet_chain_at
  ON portfolio_daily_snapshots (wallet_address, chain_id, snapshot_at DESC);

CREATE INDEX IF NOT EXISTS idx_portfolio_daily_snapshots_chain
  ON portfolio_daily_snapshots (chain_id);

-- Drop stale single-column wallet indexes left by older TypeORM synchronize.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT i.indexname
    FROM pg_indexes i
    JOIN pg_class c ON c.relname = i.indexname
    JOIN pg_index x ON x.indexrelid = c.oid
    JOIN pg_attribute a ON a.attrelid = x.indrelid AND a.attnum = ANY (x.indkey)
    WHERE i.tablename = 'portfolio_daily_snapshots'
      AND i.indexname LIKE 'IDX_%'
      AND a.attname = 'wallet_address'
      AND x.indnatts = 1
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I', r.indexname);
  END LOOP;
END $$;

COMMENT ON COLUMN portfolio_daily_snapshots.chain_id IS
  'EIP-155 chain id of the RWA contract marked in this row.';
COMMENT ON TABLE portfolio_daily_snapshots IS
  'Daily portfolio total USD per wallet per chain (09:00 Asia/Seoul).';


-- ── add_portfolio_daily_snapshots_token_contract.sql ──
-- Scope portfolio charts to the RWA address that was marked.
-- Existing rows stay unstamped (NULL) so they are not treated as the new
-- contract. Reads ignore NULL and any other address. New captures write
-- the configured RWA. Unique must include token_contract or today's slot
-- cannot coexist with the previous contract's row.

ALTER TABLE portfolio_daily_snapshots
  ADD COLUMN IF NOT EXISTS token_contract varchar(42);

COMMENT ON COLUMN portfolio_daily_snapshots.token_contract IS
  'RWA address marked in this row. Reads ignore rows for a different or unstamped contract.';

ALTER TABLE portfolio_daily_snapshots
  DROP CONSTRAINT IF EXISTS portfolio_daily_snapshots_wallet_date_chain_unique;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'portfolio_daily_snapshots_wallet_date_chain_contract_unique'
  ) THEN
    ALTER TABLE portfolio_daily_snapshots
      ADD CONSTRAINT portfolio_daily_snapshots_wallet_date_chain_contract_unique
      UNIQUE (wallet_address, snapshot_date_kst, chain_id, token_contract);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_portfolio_daily_snapshots_token_contract
  ON portfolio_daily_snapshots (lower(token_contract))
  WHERE token_contract IS NOT NULL;


-- ── add_user_buyer_listing_alert.sql ──
-- BUYER_LISTING_ALERT — one-time notify when a collection first lists for sale on this RWA.

CREATE TABLE IF NOT EXISTS user_buyer_listing_alert (
  id serial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_key varchar(128) NOT NULL,
  token_contract varchar(42) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  fired_at timestamptz NULL,
  CONSTRAINT user_buyer_listing_alert_user_collection_contract_unique
    UNIQUE (user_id, collection_key, token_contract)
);

CREATE INDEX IF NOT EXISTS idx_user_buyer_listing_alert_collection_contract_active
  ON user_buyer_listing_alert (collection_key, token_contract)
  WHERE fired_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_buyer_listing_alert_user_created
  ON user_buyer_listing_alert (user_id, created_at DESC);

COMMENT ON TABLE user_buyer_listing_alert IS
  'Buyer opt-in: notify once when a collection first lists for sale on this RWA (BUYER_LISTING_ALERT).';


-- ── user_buyer_listing_alert_token_contract.sql ──
-- Per-chain buyer listing alerts: unique (user_id, collection_key, token_contract).
-- Existing DBs: apply manually (TypeORM synchronize will not rewrite the unique safely).

BEGIN;

ALTER TABLE user_buyer_listing_alert
  ADD COLUMN IF NOT EXISTS token_contract varchar(42);

ALTER TABLE user_buyer_listing_alert
  DROP CONSTRAINT IF EXISTS user_buyer_listing_alert_user_collection_unique;

-- Expand legacy (unstamped) subscriptions onto every catalog RWA for that key.
INSERT INTO user_buyer_listing_alert (
  user_id,
  collection_key,
  token_contract,
  created_at,
  fired_at
)
SELECT DISTINCT
  a.user_id,
  a.collection_key,
  lower(c.token_contract),
  a.created_at,
  a.fired_at
FROM user_buyer_listing_alert a
JOIN marketplace_collections c
  ON lower(c.collection_key) = lower(a.collection_key)
 AND c.token_contract IS NOT NULL
WHERE a.token_contract IS NULL;

DELETE FROM user_buyer_listing_alert
WHERE token_contract IS NULL;

ALTER TABLE user_buyer_listing_alert
  ALTER COLUMN token_contract SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_buyer_listing_alert_user_collection_contract_unique'
  ) THEN
    ALTER TABLE user_buyer_listing_alert
      ADD CONSTRAINT user_buyer_listing_alert_user_collection_contract_unique
      UNIQUE (user_id, collection_key, token_contract);
  END IF;
END $$;

DROP INDEX IF EXISTS idx_user_buyer_listing_alert_collection_active;

CREATE INDEX IF NOT EXISTS idx_user_buyer_listing_alert_collection_contract_active
  ON user_buyer_listing_alert (collection_key, token_contract)
  WHERE fired_at IS NULL;

COMMENT ON COLUMN user_buyer_listing_alert.token_contract IS
  'RWA address this alert subscription is scoped to (matches marketplace_collections.token_contract).';

COMMENT ON TABLE user_buyer_listing_alert IS
  'Buyer opt-in: notify once when a collection first lists for sale on this RWA (BUYER_LISTING_ALERT).';

COMMIT;


-- ── add_kbw_mystery_card_burns.sql ──
-- Web2 KBW Mystery Card burn ledger (hide from Portfolio; not on-chain burn).
-- Scoped by email: one participation / burn per contact email across wallets.
-- Idempotent: recreates the table when still wallet-scoped or missing email.

DO $$
BEGIN
  IF to_regclass('public.kbw_mystery_card_burns') IS NOT NULL
     AND NOT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'kbw_mystery_card_burns'
         AND column_name = 'email'
     ) THEN
    DROP TABLE kbw_mystery_card_burns;
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'kbw_mystery_card_burns'
      AND column_name = 'wallet_address'
  ) THEN
    DROP TABLE kbw_mystery_card_burns;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS kbw_mystery_card_burns (
  id serial PRIMARY KEY,
  email varchar(320) NOT NULL,
  burned_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT kbw_mystery_card_burns_email_unique UNIQUE (email)
);

COMMENT ON TABLE kbw_mystery_card_burns IS
  'Web2 KBW Mystery Card burn ledger — one row per email; all wallets sharing that email hide the card after burn.';


-- ── add_partner_vault_mint_jobs.sql ──
-- Partner self-vault bulk mint (sell flow) — server-side job queue.
-- Canonical copy: schema/067_partner_vault_mint.sql (bootstrap). Safe to re-run (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS partner_vault_mint_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  chain_id int NOT NULL,
  recipient_address varchar(42) NOT NULL,
  partner_id uuid NULL REFERENCES marketplace_partners(id) ON DELETE SET NULL,
  status varchar(32) NOT NULL DEFAULT 'pending',
  item_count int NOT NULL DEFAULT 0,
  processed_count int NOT NULL DEFAULT 0,
  succeeded_count int NOT NULL DEFAULT 0,
  failed_count int NOT NULL DEFAULT 0,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_vault_mint_jobs_user_id
  ON partner_vault_mint_jobs (user_id);

CREATE TABLE IF NOT EXISTS partner_vault_mint_job_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES partner_vault_mint_jobs(id) ON DELETE CASCADE,
  sort_index int NOT NULL DEFAULT 0,
  cert_number varchar(32) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'pending',
  display_name varchar(512) NULL,
  token_id varchar(32) NULL,
  tx_hash varchar(66) NULL,
  error_message text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_vault_mint_job_items_job_id
  ON partner_vault_mint_job_items (job_id);


-- ── add_users_welcome_email_sent_at.sql ──
-- Track welcome email delivery (idempotent send on first Privy registration).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS welcome_email_sent_at timestamptz;

COMMENT ON COLUMN users.welcome_email_sent_at IS
  'When the one-time welcome email was sent (NULL = not sent yet).';


-- ── drop_legacy_unused_tables.sql ──
-- Drop leftover tables with no TypeORM entity and no live write path.
-- Safe to re-run. Does not touch portfolio_holdings (hiddenAt is the current hide flag).
-- Does NOT drop kbw_mystery_card_burns (event ledger — still in use).

DROP TABLE IF EXISTS public.p2p_orders;
DROP TABLE IF EXISTS public.p2p_listings;

DROP TABLE IF EXISTS public.psa_cert_snapshots;
DROP TABLE IF EXISTS public.portfolio_hidden_holdings;
DROP TABLE IF EXISTS public.hidden_assets;

DROP TABLE IF EXISTS public.verification_tokens;
DROP TYPE IF EXISTS public.verification_token_type;

DROP TABLE IF EXISTS public.card_top100_daily_snapshots;


-- ── drop_users_email_unique.sql ──
-- Allow the same contact email on multiple wallet / social accounts.
-- Fresh installs already drop this in schema/010_users_and_auth.sql.
-- Idempotent: drops ANY unique constraint or unique index on users.email.

ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_unique;
DROP INDEX IF EXISTS users_email_unique;
DROP INDEX IF EXISTS "UQ_97672ac88f789774dd47f7c8be3";

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conname AS name
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'users'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) ILIKE '%(email)%'
  LOOP
    EXECUTE format('ALTER TABLE users DROP CONSTRAINT IF EXISTS %I', r.name);
  END LOOP;

  FOR r IN
    SELECT i.relname AS name
    FROM pg_index x
    JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_class t ON t.oid = x.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (x.indkey)
    WHERE n.nspname = 'public'
      AND t.relname = 'users'
      AND x.indisunique
      AND NOT x.indisprimary
      AND a.attname = 'email'
      AND array_length(x.indkey, 1) = 1
  LOOP
    EXECUTE format('DROP INDEX IF EXISTS %I', r.name);
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users (lower(email));

COMMENT ON COLUMN users.email IS
  'Contact inbox (or @privy.wallet placeholder for MetaMask-only until set). Not globally unique.';


-- ── drop_partner_admin_bulk_mint_tables.sql ──
-- Admin partner bulk mint+list removed — job tables were ops-only; minted NFTs
-- and Seaport orders live in rwa_tokens / orders and are unchanged.
DROP TABLE IF EXISTS public.bulk_mint_job_items;
DROP TABLE IF EXISTS public.bulk_mint_jobs;


