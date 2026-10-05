import type { QueryClient } from "@tanstack/react-query";
import { clearMarketplaceNotificationsCache } from "@/lib/core/invalidation";
import { clearAllPortfolioBundles } from "@/lib/portfolio/portfolioQueryPersistence";
import { useAppStore } from "@/store";

const SESSION_QUERY_ROOTS: readonly (string | readonly string[])[] = [
  "rwa-tokens",
  "portfolio-assets-page",
  "portfolio-assets-page-bootstrap",
  "portfolio-daily-snapshots",
  "portfolio-activity",
  "portfolio-holdings",
  "portfolio-bids",
  "portfolio-bid-collections",
  "cardhedger-mint-previews",
  "rwa-metadata-batch",
  "rwa-vault-info-batch",
  "orders",
  "user-watchlist",
  "partner-me",
  ["rwa", "redemptions", "mine"],
  "vault-submissions",
  "buyer-listing-alert",
  "marketplace-notifications",
];

/**
 * Drop user-scoped React Query rows and portfolio localStorage paint cache.
 * Marketplace collection list persistence is public — intentionally kept.
 */
export function clearSessionSensitiveClientCache(queryClient: QueryClient): void {
  clearMarketplaceNotificationsCache(queryClient);
  clearAllPortfolioBundles();

  for (const root of SESSION_QUERY_ROOTS) {
    queryClient.removeQueries({
      queryKey: Array.isArray(root) ? [...root] : [root],
    });
  }

  useAppStore.getState()._setWallet(undefined, false);
  useAppStore.getState()._setUsdcBalance(BigInt(0));
}
