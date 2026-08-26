export type DataInventoryDomainId =
  | 'catalog'
  | 'markets'
  | 'portfolio'
  | 'trading'
  | 'people'
  | 'vault';

export type DataStoreCatalogEntry = {
  id: string;
  table: string;
  domain: DataInventoryDomainId;
  label: string;
  description: string;
  howAccumulated: string;
  adminPagePath: string | null;
};

export const DATA_INVENTORY_DOMAINS: {
  id: DataInventoryDomainId;
  label: string;
  summary: string;
}[] = [
  {
    id: 'catalog',
    label: 'Catalog and mint',
    summary:
      'Collections, RWA tokens, partner bulk mint — one row per vaulted card or mint job.',
  },
  {
    id: 'markets',
    label: 'Markets and Cardhedger',
    summary:
      'Materialized prices, Top 100 ranks, nightly delta imports — refreshed by workers, never overwritten in place for history tables.',
  },
  {
    id: 'portfolio',
    label: 'Portfolio and watchlist',
    summary:
      'Daily wallet totals (09:00 KST cron), per-holding cost basis, saved collections.',
  },
  {
    id: 'trading',
    label: 'Trading',
    summary: 'Seaport off-chain orders and P2P escrow settlement records.',
  },
  {
    id: 'people',
    label: 'People and audit',
    summary: 'Privy accounts, linked wallets, append-only KYC transitions.',
  },
  {
    id: 'vault',
    label: 'Vault lifecycle',
    summary:
      'Physical asset registry and deposit → mint → redeem cycles tied to PSA cert numbers.',
  },
];

/** Static catalog — row counts and timestamps are filled at runtime. */
export const DATA_STORE_CATALOG: DataStoreCatalogEntry[] = [
  {
    id: 'marketplace_collections',
    table: 'marketplace_collections',
    domain: 'catalog',
    label: 'Marketplace collections',
    description:
      'One bucket per PSA cert (collection_key). Holds display label, cover, components JSON (PSA mirror, Cardhedger IDs), review status.',
    howAccumulated:
      'Created on RWA mint / bulk mint prepare. Updated by admin review, cover upload, and market snapshot workers.',
    adminPagePath: '/marketplace/admin/collections',
  },
  {
    id: 'rwa_tokens',
    table: 'rwa_tokens',
    domain: 'catalog',
    label: 'RWA token registry',
    description:
      'On-chain tokenId ↔ PSA cert mapping for the active chain. Includes burn timestamp when admin-burned.',
    howAccumulated:
      'One row per successful mint. Token IDs monotonically increase and are never reused.',
    adminPagePath: '/marketplace/admin/cards',
  },
  {
    id: 'bulk_mint_jobs',
    table: 'bulk_mint_jobs',
    domain: 'catalog',
    label: 'Partner bulk mint jobs',
    description:
      'Batch mint sessions — partner wallet, prepare/commit status, item counts.',
    howAccumulated:
      'Created when admin uploads cert+price CSV on Partner bulk mint. Items progress through prepare → commit.',
    adminPagePath: '/marketplace/admin/bulk-mint',
  },
  {
    id: 'bulk_mint_job_items',
    table: 'bulk_mint_job_items',
    domain: 'catalog',
    label: 'Bulk mint line items',
    description: 'Per-cert rows inside a bulk mint job — price, prepare errors, mint tx hash.',
    howAccumulated: 'Inserted with the parent job; updated as each cert is prepared and minted.',
    adminPagePath: '/marketplace/admin/bulk-mint',
  },
  {
    id: 'marketplace_partners',
    table: 'marketplace_partners',
    domain: 'catalog',
    label: 'Consignment partners',
    description: 'Company display name + entrusted hot wallet for partner mint and list flows.',
    howAccumulated: 'Admin CRUD on Partners page.',
    adminPagePath: '/marketplace/admin/partners',
  },
  {
    id: 'collection_market_snapshots',
    table: 'collection_market_snapshots',
    domain: 'markets',
    label: 'Collection market snapshots',
    description:
      'Materialized Cardhedger pricing per collection_key — floor, sparkline, preview JSON, freshness state.',
    howAccumulated:
      'Upserted by snapshot workers after Cardhedger delta import or on-demand collection view. Rows refresh in place; history is not kept per collection.',
    adminPagePath: '/marketplace/admin/collections',
  },
  {
    id: 'card_top100_daily_snapshots',
    table: 'card_top100_daily_snapshots',
    domain: 'markets',
    label: 'Top 100 daily snapshots',
    description:
      'Cardhedger Top 100 rank lists — one row per KST date × category × grade. cards_json holds up to 100 cards.',
    howAccumulated:
      'Daily cron (KST). New row each day; prior days are preserved for history API.',
    adminPagePath: '/marketplace/admin/markets?tab=top100',
  },
  {
    id: 'cardhedger_price_delta_import_runs',
    table: 'cardhedger_price_delta_import_runs',
    domain: 'markets',
    label: 'Price delta import runs',
    description:
      'Audit log for each Cardhedger price-updates delta poll — matched collections, checkpoint range, errors.',
    howAccumulated:
      'Nightly cron + manual “Run price sync” on Price sync page. Append-only.',
    adminPagePath: '/marketplace/admin/price-webhooks',
  },
  {
    id: 'cardhedger_price_delta_checkpoints',
    table: 'cardhedger_price_delta_checkpoints',
    domain: 'markets',
    label: 'Price delta checkpoint',
    description:
      'Singleton row (id=1) storing last Cardhedger delta `since` ISO timestamp.',
    howAccumulated: 'Updated after each successful delta import run.',
    adminPagePath: '/marketplace/admin/price-webhooks',
  },
  {
    id: 'cardhedger_price_subscriptions',
    table: 'cardhedger_price_subscriptions',
    domain: 'markets',
    label: 'Cardhedger price subscriptions',
    description:
      'Registered Cardhedger card IDs for webhook price push (when subscribe feature is enabled).',
    howAccumulated: 'Synced from collection catalog via admin price-subscription endpoints.',
    adminPagePath: '/marketplace/admin/price-webhooks',
  },
  {
    id: 'cardhedger_daily_price_export_runs',
    table: 'cardhedger_daily_price_export_runs',
    domain: 'markets',
    label: 'Daily price export runs',
    description: 'Audit for optional nightly CSV export from Cardhedger (Enterprise tier).',
    howAccumulated: 'Cron when CARDHEDGER_DAILY_EXPORT_CSV_ENABLED — append-only run log.',
    adminPagePath: '/marketplace/admin/price-webhooks',
  },
  {
    id: 'portfolio_daily_snapshots',
    table: 'portfolio_daily_snapshots',
    domain: 'portfolio',
    label: 'Portfolio daily snapshots',
    description:
      'Wallet mark-to-market totals per KST date — drives Portfolio hero value and 24h P/L chart.',
    howAccumulated:
      'Daily 09:00 KST cron scans on-chain holders. Read path may backfill today if cron row missing.',
    adminPagePath: '/marketplace/admin/portfolio',
  },
  {
    id: 'portfolio_holdings',
    table: 'portfolio_holdings',
    domain: 'portfolio',
    label: 'Portfolio holdings prefs',
    description:
      'Per wallet × tokenId — cost basis USD, source (manual / vault_delivery / marketplace_buy), hidden flag.',
    howAccumulated:
      'Seeded on vault delivery or order fulfill; user manual edits persist. One row per held token.',
    adminPagePath: '/marketplace/admin/portfolio',
  },
  {
    id: 'user_watchlist',
    table: 'user_watchlist',
    domain: 'portfolio',
    label: 'User watchlist',
    description: 'Saved collection keys per authenticated user.',
    howAccumulated: 'User toggles watchlist on collection pages.',
    adminPagePath: '/marketplace/admin/users',
  },
  {
    id: 'orders',
    table: 'orders',
    domain: 'trading',
    label: 'Seaport orders',
    description:
      'Off-chain ask/bid orders — active, fulfilled, cancelled, expired. Trade tape for GMV analytics.',
    howAccumulated:
      'Created on list/bid; status updated on fulfill, cancel, expiry.',
    adminPagePath: '/marketplace/admin',
  },
  {
    id: 'p2p_orders',
    table: 'p2p_orders',
    domain: 'trading',
    label: 'P2P escrow orders',
    description: 'Escrow settlement records for P2P listings — buyer, arbiter refund path.',
    howAccumulated: 'Created when buyer purchases a P2P listing; status transitions on settle/refund.',
    adminPagePath: '/marketplace/admin/p2p',
  },
  {
    id: 'p2p_listings',
    table: 'p2p_listings',
    domain: 'trading',
    label: 'P2P listings',
    description: 'Seller-listed PSA certs for P2P escrow flow (distinct from Seaport asks).',
    howAccumulated: 'Seller creates listing; closed when sold or cancelled.',
    adminPagePath: '/marketplace/admin/p2p',
  },
  {
    id: 'users',
    table: 'users',
    domain: 'people',
    label: 'User accounts',
    description: 'Privy-linked accounts — email, KYC status, profile fields.',
    howAccumulated: 'Created on first Privy session sync.',
    adminPagePath: '/marketplace/admin/users',
  },
  {
    id: 'user_wallets',
    table: 'user_wallets',
    domain: 'people',
    label: 'Linked wallets',
    description: 'Wallet addresses synced from Privy per user.',
    howAccumulated: 'Upserted on every Privy auth session sync.',
    adminPagePath: '/marketplace/admin/users',
  },
  {
    id: 'user_kyc_events',
    table: 'user_kyc_events',
    domain: 'people',
    label: 'KYC audit events',
    description:
      'Append-only KYC status transitions (Sumsub webhook + admin override).',
    howAccumulated: 'Never updated in place — one row per status change.',
    adminPagePath: '/marketplace/admin/users',
  },
  {
    id: 'vault_submissions',
    table: 'vault_submissions',
    domain: 'vault',
    label: 'Vault submissions (sell flow)',
    description:
      'Pre-mint package tracking — draft → ship → PSA review → completed. public_id SUB-…, carrier/tracking.',
    howAccumulated:
      'Created/updated by sell UI via /api/vault/submissions; ops via admin vault-submissions.',
    adminPagePath: '/marketplace/admin/vault/submissions',
  },
  {
    id: 'vault_submission_items',
    table: 'vault_submission_items',
    domain: 'vault',
    label: 'Vault submission cards',
    description:
      'Per-cert rows inside a submission — grade/image, per-card status, optional vault_cycle_id after mint reserve.',
    howAccumulated: 'Synced with draft cards; status advanced by PSA ops and mint bridge.',
    adminPagePath: '/marketplace/admin/vault/submissions',
  },
  {
    id: 'vault_assets',
    table: 'vault_assets',
    domain: 'vault',
    label: 'Vault assets',
    description:
      'Physical card registry — external cert number, vaultRef hash, current lifecycle pointer.',
    howAccumulated: 'Registered when a cert enters the vault pipeline.',
    adminPagePath: '/marketplace/admin/vault',
  },
  {
    id: 'vault_cycles',
    table: 'vault_cycles',
    domain: 'vault',
    label: 'Vault cycles',
    description:
      'Deposit → verify → mint → redeem lifecycle per vault asset. At most one active cycle per asset.',
    howAccumulated: 'New cycle on deposit; terminal on redeem or cancel.',
    adminPagePath: '/marketplace/admin/vault',
  },
  {
    id: 'vault_redemptions',
    table: 'vault_redemptions',
    domain: 'vault',
    label: 'Vault redemptions',
    description: 'Burn + ship-back records when user redeems physical card.',
    howAccumulated: 'Created when redemption is requested and fulfilled.',
    adminPagePath: '/marketplace/admin/vault',
  },
];
