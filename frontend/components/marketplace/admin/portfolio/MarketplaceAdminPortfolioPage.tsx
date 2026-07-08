"use client";

import Link from "next/link";
import { useMarketplaceAdminAnalytics } from "@/hooks/marketplace-admin/useMarketplaceAdminAnalytics";
import { AdminSectionTitle, AdminStatTile } from "../AdminAnalyticsWidgets";
import {
  ADMIN_ARTICLE,
  ADMIN_LINK,
  ADMIN_STAT_CARD,
  ADMIN_TEXT_SECONDARY,
} from "../adminUi";
import { MarketplaceAdminPageHeader } from "../MarketplaceAdminPageHeader";

const COST_BASIS_ROWS = [
  {
    source: "vault_delivery",
    label: "Vault delivery",
    detail: "Seeded when admin delivers custody NFT — mark USD at deliver time.",
  },
  {
    source: "marketplace_buy",
    label: "Marketplace buy",
    detail: "Seeded on order fulfill for the buyer wallet.",
  },
  {
    source: "manual",
    label: "Manual edit",
    detail: "User Edit in Portfolio — never overwritten by auto seed.",
  },
] as const;

export function MarketplaceAdminPortfolioPage() {
  const { data, isLoading, isError, error } = useMarketplaceAdminAnalytics(30);
  const p = data?.overview.portfolio;

  return (
    <>
      <MarketplaceAdminPageHeader
        title="Portfolio ops"
        subtitle="Daily snapshots, cost basis seeding, and home portfolio value rules."
      />

      {isError ? (
        <div className={`${ADMIN_ARTICLE} mb-5 text-sm text-red-600`}>
          {(error as Error).message}
        </div>
      ) : null}

      <div className={`${ADMIN_ARTICLE} mb-6`}>
        <AdminSectionTitle
          title="Daily snapshots (09:00 KST)"
          subtitle="Portfolio value + 24h change on the hero/chart"
        />
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
        <p className={`mt-4 text-sm leading-relaxed ${ADMIN_TEXT_SECONDARY}`}>
          Cron captures all holders daily. First portfolio view triggers baseline
          backfill. Hero <strong>Portfolio value</strong> and <strong>24h P/L</strong> use
          snapshots only — not live mark sums.
        </p>
      </div>

      <div className={`${ADMIN_ARTICLE} mb-6`}>
        <AdminSectionTitle
          title="Cost basis (`portfolio_holdings`)"
          subtitle="Per-row P/L in My Assets"
        />
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
              <p className={`mt-1 text-xs leading-relaxed ${ADMIN_TEXT_SECONDARY}`}>
                {row.detail}
              </p>
              <p className="mt-2 font-mono text-lg font-semibold text-zinc-800">
                {isLoading
                  ? "…"
                  : (p?.costBasisBySource?.[row.source] ?? 0)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className={`${ADMIN_ARTICLE} ${ADMIN_TEXT_SECONDARY} text-sm`}>
        <AdminSectionTitle title="Operator checklist" />
        <ul className="mt-3 list-disc space-y-2 pl-5">
          <li>
            Deliver custody NFTs from{" "}
            <Link href="/marketplace/admin/custody-nfts" className={ADMIN_LINK}>
              Custody NFTs
            </Link>{" "}
            — seeds <code className="font-mono text-xs">vault_delivery</code> cost basis.
          </li>
          <li>
            Marketplace buys seed on order fulfill (
            <code className="font-mono text-xs">marketplace_buy</code>).
          </li>
          <li>
            Preview home rankings under{" "}
            <Link href="/marketplace/admin/markets?tab=home" className={ADMIN_LINK}>
              Markets preview → Home landing
            </Link>.
          </li>
          <li>
            My Assets P/L = cost basis vs live mark; Portfolio value = daily snapshot
            (see user Portfolio page).
          </li>
        </ul>
      </div>
    </>
  );
}
