/**
 * Analytics Event Definitions
 *
 * Every GA4 custom event name used in Tokenable is declared here.
 * Add new events to `EventName` before calling `trackEvent()`.
 *
 * Usage:
 *   import { trackEvent } from "@/lib/analytics/googleAnalytics";
 *
 *   trackEvent("buy_now_clicked", { card_id: "abc", price: 100 });
 *   trackEvent("bid_placed",      { card_id: "abc", bid_price: 95 });
 */

// ---------------------------------------------------------------------------
// Event Name Union
// ---------------------------------------------------------------------------

export type EventName =
  // ── Page & Navigation ──────────────────────────────────────────────────
  | "page_viewed"               // page landed on (supplement to auto page_view)
  | "tab_clicked"               // tab switch inside a page (e.g. Markets tabs)

  // ── Search & Filter ────────────────────────────────────────────────────
  | "search_performed"          // search query submitted
  | "filter_applied"            // filter option selected
  | "sort_changed"              // sort order changed

  // ── Collection / Card Discovery ────────────────────────────────────────
  | "collection_viewed"         // collection detail page opened
  | "card_viewed"               // individual RWA token detail opened
  | "card_clicked"              // card clicked in grid (navigates to collection/token detail)
  | "asset_detail_viewed"       // RWA token detail page fully loaded and visible
  | "watchlist_added"           // card added to watchlist
  | "watchlist_removed"         // card removed from watchlist

  // ── Buy / Purchase ─────────────────────────────────────────────────────
  | "buy_now_clicked"           // Buy Now CTA clicked
  | "buy_now_confirmed"         // buy checkout confirm button clicked
  | "purchase_completed"        // on-chain buy tx confirmed

  // ── Bid ────────────────────────────────────────────────────────────────
  | "bid_panel_opened"          // bid form opened
  | "bid_clicked"               // Bid button clicked (bid modal open intent)
  | "bid_placed"                // bid order signed & submitted
  | "bid_submitted"             // bid order on-chain confirmed
  | "bid_changed"               // existing bid updated
  | "bid_cancelled"             // bid order cancelled

  // ── Sell / List ────────────────────────────────────────────────────────
  | "sell_panel_opened"         // sell/list form opened
  | "list_clicked"              // List / Set price button clicked (open listing flow)
  | "set_price_clicked"         // Portfolio Set price CTA
  | "edit_price_clicked"        // Portfolio Edit price CTA
  | "listing_created"           // sell listing signed & submitted (legacy name)
  | "listing_submitted"         // listing successfully created & live in orderbook
  | "listing_cancelled"         // listing cancelled
  | "sell_now_clicked"          // Sell Now (instant sell) CTA clicked
  | "sell_now_completed"        // on-chain instant sell tx confirmed

  // ── Portfolio ──────────────────────────────────────────────────────────
  | "portfolio_viewed"          // portfolio page loaded with asset data
  | "portfolio_asset_clicked"   // individual asset card clicked
  | "portfolio_bid_cancelled"   // bid cancelled from portfolio

  // ── Vault ──────────────────────────────────────────────────────────────
  | "vault_submit_started"      // vault submission flow started
  | "vault_submit_completed"    // vault submission form submitted
  | "vault_shipping_confirmed"  // shipping step confirmed
  | "vault_detail_viewed"       // vault item detail page opened

  // ── Auth ───────────────────────────────────────────────────────────────
  | "sign_in_started"           // sign-in modal opened
  | "sign_in_completed"         // user successfully authenticated
  | "sign_up_completed"         // new account created
  | "sign_out"                  // user signed out

  // ── KYC ────────────────────────────────────────────────────────────────
  | "kyc_started"               // /kyc page loaded, verification begins
  | "kyc_submitted"             // user submitted identity documents
  | "kyc_approved"              // webhook applied approved status (FE session refresh)
  | "kyc_gate_hit"              // KYC required modal shown

  // ── Wallet ─────────────────────────────────────────────────────────────
  | "wallet_connect_started"    // connect wallet flow opened
  | "wallet_connected"          // wallet linked successfully
  | "wallet_menu_opened"        // header wallet menu opened
  | "fiat_onramp_started"       // Add Funds / fiat on-ramp flow initiated

  // ── Error ──────────────────────────────────────────────────────────────
  | "tx_error"                  // on-chain transaction failed
  | "api_error";                // API call returned an error shown to user

// ---------------------------------------------------------------------------
// Properties
// ---------------------------------------------------------------------------

/**
 * Flexible property bag for event parameters.
 * Use explicit keys below for common fields; the index signature allows extras
 * so callers never need to cast.
 *
 * Keep values serialisable (string | number | boolean | null).
 */
export type AnalyticsProperties = {
  // Common dimensions
  card_id?: string | number;
  collection_id?: string;
  collection_name?: string;
  category?: string;

  // Pricing
  price?: number;
  bid_price?: number;
  bid_amount?: number;
  current_price?: number;
  fee?: number;
  net_amount?: number;
  currency?: string;

  // Search / Filter
  query?: string;
  filter_key?: string;
  filter_value?: string;
  sort_key?: string;

  // Pagination / position
  position?: number;
  page?: number;

  // Transaction
  tx_hash?: string;
  order_hash?: string;
  chain_id?: number;

  // Portfolio
  total_assets?: number;
  total_value?: number;
  asking_price?: number;
  listed_price?: number;
  highest_bid?: number;
  card_name?: string;
  grade?: string;

  // Auth / KYC
  provider?: string;
  kyc_status?: string;

  // Error
  error_code?: string;
  error_message?: string;

  // Tab / UI
  tab?: string;
  page_path?: string;

  // Catch-all for any extra keys
  [key: string]: unknown;
};
