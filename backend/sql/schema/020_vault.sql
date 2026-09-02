-- Vault lifecycle: physical asset → deposit cycle → redemption
-- Entities: backend/src/vault/entities/*.ts

CREATE TABLE IF NOT EXISTS vault_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_type varchar(32) NOT NULL DEFAULT 'psa_graded',
  external_cert_number varchar(32) NOT NULL,
  vault_ref varchar(66) NOT NULL,
  display_name varchar(512),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vault_assets_type_cert_unique UNIQUE (asset_type, external_cert_number),
  CONSTRAINT vault_assets_vault_ref_unique UNIQUE (vault_ref)
);

COMMENT ON TABLE vault_assets IS
  'Permanent identity of a physical asset (e.g. PSA-graded card). Survives across multiple vault deposit/redeem cycles.';
COMMENT ON COLUMN vault_assets.vault_ref IS
  'keccak256 of the physical-asset identifier — must match TokenableRWA.vaultRef() for every token minted against this asset.';

CREATE TABLE IF NOT EXISTS vault_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_asset_id uuid NOT NULL REFERENCES vault_assets(id) ON DELETE RESTRICT,
  chain_id integer NOT NULL,
  cycle_number integer NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'pending_deposit',
  deposited_at timestamptz,
  deposit_verified_by uuid REFERENCES users(id) ON DELETE SET NULL,
  deposited_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vault_cycles_asset_number_unique UNIQUE (vault_asset_id, cycle_number),
  CONSTRAINT vault_cycles_chain_id_positive CHECK (chain_id > 0),
  CONSTRAINT vault_cycles_status_check CHECK (
    status IN (
      'pending_deposit', 'deposit_verified', 'minted',
      'redemption_requested', 'redeemed', 'cancelled'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_vault_cycles_asset_id ON vault_cycles (vault_asset_id);

-- One open cycle per (asset, chain) — the on-chain activeTokenIdByVaultRef
-- invariant is per contract, i.e. per chain. A live Sepolia NFT must not
-- block a Polygon mint for the same cert.
CREATE UNIQUE INDEX IF NOT EXISTS uq_vault_cycles_one_open_per_asset_chain
  ON vault_cycles (vault_asset_id, chain_id)
  WHERE status NOT IN ('redeemed', 'cancelled');

COMMENT ON TABLE vault_cycles IS
  'One deposit→redeem lifecycle for a vault_asset on one chain. At most one open cycle per (asset, chain).';
COMMENT ON COLUMN vault_cycles.chain_id IS
  'EIP-155 chain id the cycle''s NFT is (or will be) minted on.';
COMMENT ON COLUMN vault_cycles.deposit_verified_by IS
  'Admin who verified the physical deposit. NULL when verification was automated (self-serve mint).';

CREATE TABLE IF NOT EXISTS vault_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vault_cycle_id uuid NOT NULL REFERENCES vault_cycles(id) ON DELETE RESTRICT,
  requested_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  owner_wallet_address varchar(42) NOT NULL,
  status varchar(24) NOT NULL DEFAULT 'pending',
  ownership_verified_at timestamptz,
  burn_tx_hash varchar(80),
  burned_at timestamptz,
  vault_released_at timestamptz,
  failure_reason text,
  ship_to_name varchar(128),
  ship_to_line1 varchar(256),
  ship_to_line2 varchar(256),
  ship_to_city varchar(128),
  ship_to_region varchar(128),
  ship_to_postal varchar(32),
  ship_to_country varchar(8),
  ship_to_phone varchar(40),
  fee_retrieval_usd numeric(12, 2),
  fee_early_withdrawal_usd numeric(12, 2),
  fee_shipping_usd numeric(12, 2),
  fee_total_usd numeric(12, 2),
  payment_tx_hash varchar(80),
  payment_batch_id uuid,
  paid_at timestamptz,
  payment_received_usdc_micros numeric(24, 0),
  chain_id integer,
  custody_tx_hash varchar(80),
  custody_at timestamptz,
  custody_return_tx_hash varchar(80),
  custody_returned_at timestamptz,
  refund_status varchar(24) NOT NULL DEFAULT 'none',
  refund_tx_hash varchar(80),
  refunded_usdc_micros numeric(24, 0),
  refunded_at timestamptz,
  tracking_number varchar(128),
  tracking_carrier varchar(64),
  tracking_set_at timestamptz,
  admin_memo text,
  vaulted_at timestamptz,
  early_withdrawal boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vault_redemptions_status_check CHECK (
    status IN (
      'pending', 'ownership_verified', 'in_custody', 'burned',
      'vault_release_pending', 'completed', 'failed', 'cancelled', 'refunded'
    )
  ),
  CONSTRAINT vault_redemptions_refund_status_check CHECK (
    refund_status IN (
      'none', 'usdc_refunded', 'nft_returned', 'fully_refunded'
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_vault_redemptions_cycle_id ON vault_redemptions (vault_cycle_id);

CREATE INDEX IF NOT EXISTS idx_vault_redemptions_status
  ON vault_redemptions (status);

CREATE INDEX IF NOT EXISTS idx_vault_redemptions_payment_tx
  ON vault_redemptions (payment_tx_hash)
  WHERE payment_tx_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vault_redemptions_payment_batch
  ON vault_redemptions (payment_batch_id)
  WHERE payment_batch_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_vault_redemptions_one_open_per_cycle
  ON vault_redemptions (vault_cycle_id)
  WHERE status NOT IN ('completed', 'failed', 'cancelled', 'refunded');

COMMENT ON TABLE vault_redemptions IS
  'Redemption state machine: pay → user custody transfer → burn → physical release (or refund before tracking).';

COMMENT ON COLUMN vault_redemptions.payment_received_usdc_micros IS
  'Batch-total USDC micros actually received (copied onto every sibling row). Never SUM across a batch; use once or read vault_redeem_payment_claims.';
COMMENT ON COLUMN vault_redemptions.refunded_usdc_micros IS
  'Batch-total USDC micros refunded (copied onto every sibling row). Never SUM across a batch.';
COMMENT ON COLUMN vault_redemptions.custody_tx_hash IS
  'User-signed ERC-721 transfer into RWA_CUSTODY_WALLET_ADDRESS.';
COMMENT ON COLUMN vault_redemptions.refund_status IS
  'none | usdc_refunded | nft_returned | fully_refunded';
COMMENT ON COLUMN vault_redemptions.tracking_number IS
  'When set, refunds are blocked.';
COMMENT ON COLUMN vault_redemptions.ship_to_country IS
  'ISO-3166 alpha-2 destination stored at redeem time (not the fee bucket us|ca|intl).';

-- One payment_tx_hash → one batch (multi-card redemptions denormalize the same hash).
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
  'Ledger uniqueness: one USDC payment_tx_hash funds one payment_batch_id. Redemption rows denormalize these fields for ops joins.';

-- Paid redemption rows may reference the claims ledger (NULL payment_tx_hash = unpaid / legacy).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_vault_redemptions_payment_claim'
  ) THEN
    ALTER TABLE vault_redemptions
      ADD CONSTRAINT fk_vault_redemptions_payment_claim
      FOREIGN KEY (payment_tx_hash)
      REFERENCES vault_redeem_payment_claims (payment_tx_hash)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Sell-flow submissions (pre-mint package tracking: draft → ship → PSA → live)
-- ---------------------------------------------------------------------------

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

COMMENT ON TABLE vault_submissions IS
  'User sell-flow package: multi-card submission from draft through PSA transit (pre vault_cycles mint).';
COMMENT ON COLUMN vault_submissions.public_id IS
  'Human-facing id e.g. SUB-20260728-12345 — shown in UI breadcrumbs.';

CREATE TABLE IF NOT EXISTS vault_submission_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES vault_submissions(id) ON DELETE CASCADE,
  cert_number varchar(32) NOT NULL,
  display_name varchar(512),
  card_number varchar(64),
  card_year varchar(8),
  set_name varchar(256),
  language varchar(16),
  variant varchar(256),
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

COMMENT ON TABLE vault_submission_items IS
  'Per-card rows inside a vault_submission. Links to vault_cycles after mint reserve.';
COMMENT ON COLUMN vault_submission_items.vault_cycle_id IS
  'Set when reserveCycleForDeposit succeeds for this cert — bridges sell-flow → vault lifecycle.';

-- PSA Items Received mail → admin review queue (not auto Ship→PSA)
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
  confirmed_via varchar(16),
  skipped_public_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vault_psa_arrival_reviews_gmail_message_unique UNIQUE (gmail_message_id),
  CONSTRAINT vault_psa_arrival_reviews_status_check CHECK (
    status IN ('pending', 'confirmed', 'dismissed')
  ),
  CONSTRAINT vault_psa_arrival_reviews_confirmed_via_check CHECK (
    confirmed_via IS NULL OR confirmed_via IN ('auto', 'admin')
  )
);

CREATE INDEX IF NOT EXISTS idx_vault_psa_arrival_reviews_status
  ON vault_psa_arrival_reviews (status);

COMMENT ON TABLE vault_psa_arrival_reviews IS
  'Gmail Items Received mail; matched packages auto-confirm to psa_reviewing (or admin Confirm).';

-- PSA Items Vaulted / secured mail → mint & deliver (PSA → Live)
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
