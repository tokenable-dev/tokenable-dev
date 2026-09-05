export type SchemaEdgeKind = 'fk' | 'logical';

export type SchemaLogicalEdge = {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  label: string;
};

/**
 * Marketplace core has almost no DB FKs — these are the app-enforced joins
 * used by the admin schema map (plus live information_schema FKs).
 */
export const DATA_INVENTORY_LOGICAL_EDGES: SchemaLogicalEdge[] = [
  {
    fromTable: 'user_wallets',
    fromColumn: 'user_id',
    toTable: 'users',
    toColumn: 'id',
    label: 'user_id',
  },
  {
    fromTable: 'user_auth_providers',
    fromColumn: 'user_id',
    toTable: 'users',
    toColumn: 'id',
    label: 'user_id',
  },
  {
    fromTable: 'user_shipping_addresses',
    fromColumn: 'user_id',
    toTable: 'users',
    toColumn: 'id',
    label: 'user_id',
  },
  {
    fromTable: 'user_kyc_events',
    fromColumn: 'user_id',
    toTable: 'users',
    toColumn: 'id',
    label: 'user_id',
  },
  {
    fromTable: 'user_watchlist',
    fromColumn: 'user_id',
    toTable: 'users',
    toColumn: 'id',
    label: 'user_id',
  },
  {
    fromTable: 'user_buyer_listing_alert',
    fromColumn: 'user_id',
    toTable: 'users',
    toColumn: 'id',
    label: 'user_id',
  },
  {
    fromTable: 'user_watchlist',
    fromColumn: 'collection_key',
    toTable: 'marketplace_collections',
    toColumn: 'collection_key',
    label: 'collection_key',
  },
  {
    fromTable: 'vault_cycles',
    fromColumn: 'vault_asset_id',
    toTable: 'vault_assets',
    toColumn: 'id',
    label: 'vault_asset_id',
  },
  {
    fromTable: 'vault_redemptions',
    fromColumn: 'vault_cycle_id',
    toTable: 'vault_cycles',
    toColumn: 'id',
    label: 'vault_cycle_id',
  },
  {
    fromTable: 'vault_redemptions',
    fromColumn: 'payment_tx_hash',
    toTable: 'vault_redeem_payment_claims',
    toColumn: 'payment_tx_hash',
    label: 'payment_tx_hash',
  },
  {
    fromTable: 'vault_submission_items',
    fromColumn: 'submission_id',
    toTable: 'vault_submissions',
    toColumn: 'id',
    label: 'submission_id',
  },
  {
    fromTable: 'vault_submission_items',
    fromColumn: 'vault_cycle_id',
    toTable: 'vault_cycles',
    toColumn: 'id',
    label: 'vault_cycle_id',
  },
  {
    fromTable: 'rwa_tokens',
    fromColumn: 'vault_cycle_id',
    toTable: 'vault_cycles',
    toColumn: 'id',
    label: 'vault_cycle_id',
  },
  {
    fromTable: 'rwa_tokens',
    fromColumn: 'collection_key',
    toTable: 'marketplace_collections',
    toColumn: 'collection_key',
    label: 'collection_key',
  },
  {
    fromTable: 'rwa_tokens',
    fromColumn: 'vault_partner_id',
    toTable: 'marketplace_partners',
    toColumn: 'id',
    label: 'vault_partner_id',
  },
  {
    fromTable: 'collection_market_snapshots',
    fromColumn: 'collection_key',
    toTable: 'marketplace_collections',
    toColumn: 'collection_key',
    label: 'collection_key',
  },
  {
    fromTable: 'orders',
    fromColumn: 'collection_key',
    toTable: 'marketplace_collections',
    toColumn: 'collection_key',
    label: 'collection_key',
  },
  {
    fromTable: 'p2p_orders',
    fromColumn: 'listing_id',
    toTable: 'p2p_listings',
    toColumn: 'id',
    label: 'listing_id',
  },
  {
    fromTable: 'bulk_mint_job_items',
    fromColumn: 'job_id',
    toTable: 'bulk_mint_jobs',
    toColumn: 'id',
    label: 'job_id',
  },
  {
    fromTable: 'bulk_mint_jobs',
    fromColumn: 'partner_id',
    toTable: 'marketplace_partners',
    toColumn: 'id',
    label: 'partner_id',
  },
  {
    fromTable: 'marketplace_partner_addresses',
    fromColumn: 'partner_id',
    toTable: 'marketplace_partners',
    toColumn: 'id',
    label: 'partner_id',
  },
  {
    fromTable: 'self_vault_settlements',
    fromColumn: 'order_hash',
    toTable: 'orders',
    toColumn: 'order_hash',
    label: 'order_hash',
  },
  {
    fromTable: 'portfolio_holdings',
    fromColumn: 'token_id',
    toTable: 'rwa_tokens',
    toColumn: 'token_id',
    label: 'token_id (logical)',
  },
];
