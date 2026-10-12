"use client";

import { useMarketplaceAdminAnalytics } from "@/hooks/marketplace-admin/useMarketplaceAdminAnalytics";
import { AdminSectionTitle, AdminStatTile } from "../AdminAnalyticsWidgets";
import { ADMIN_ARTICLE, ADMIN_STAT_CARD } from "../adminUi";
import { MarketplaceAdminPageHeader } from "../MarketplaceAdminPageHeader";

const COST_BASIS_ROWS = [
  { source: "vault_delivery", label: "Vault delivery" },
  { source: "marketplace_buy", label: "Marketplace buy" },
  { source: "manual", label: "Manual edit" },
] as const;

export function MarketplaceAdminPortfolioPage() {
  const { data, isLoading, isError, error } = useMarketplaceAdminAnalytics(30);
  const p = data?.overview.portfolio;

  return (
    <>
      <MarketplaceAdminPageHeader title="Portfolio ops" />

      {isError ? (
        <div className={`${ADMIN_ARTICLE} mb-5 text-sm text-red-600`}>
          {(error as Error).message}
        </div>
      ) : null}

      <div className={`${ADMIN_ARTICLE} mb-6`}>
        <AdminSectionTitle title="Daily snapshots (09:00 KST)" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <AdminStatTile
            label="Tracked wallets"
            value={isLoading ? "…" : (p?.trackedWallets ?? 0)}
          />
          <AdminStatTile
            label="Snapshot rows"
            value={isLoading ? "…" : (p?.snapshotRows ?? 0)}
          />
          <AdminStatTile
            label="Latest snapshot (KST)"
            value={isLoading ? "…" : (p?.latestSnapshotDate ?? "—")}
          />
        </div>
      </div>

      <div className={`${ADMIN_ARTICLE} mb-6`}>
        <AdminSectionTitle title="Cost basis" />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <AdminStatTile
            label="Holding rows"
            value={isLoading ? "…" : (p?.holdingsRows ?? 0)}
          />
          <AdminStatTile
            label="With cost basis"
            value={isLoading ? "…" : (p?.holdingsWithCostBasis ?? 0)}
          />
          <AdminStatTile
            label="Hidden assets"
            value={isLoading ? "…" : (p?.holdingsHidden ?? 0)}
          />
          <AdminStatTile
            label="Manual edits"
            value={isLoading ? "…" : (p?.costBasisBySource?.manual ?? 0)}
          />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {COST_BASIS_ROWS.map((row) => (
            <div key={row.source} className={ADMIN_STAT_CARD}>
              <p className="text-sm font-semibold text-zinc-900">{row.label}</p>
              <p className="mt-2 font-mono text-lg font-semibold text-zinc-800">
                {isLoading
                  ? "…"
                  : (p?.costBasisBySource?.[row.source] ?? 0)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
