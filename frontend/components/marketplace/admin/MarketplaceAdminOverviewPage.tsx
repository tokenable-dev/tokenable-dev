"use client";

import { useState } from "react";
import Link from "next/link";
import type { AdminAnalyticsPeriod } from "@/lib/core";
import { useMarketplaceAdminAnalytics } from "@/hooks/marketplace-admin/useMarketplaceAdminAnalytics";
import { useCardhedgerPriceInfraAdmin } from "@/hooks/marketplace-admin/useCardhedgerPriceInfraAdmin";
import { formatUsdcPricePrimary } from "@/lib/market/usdcKrwDisplay";
import { ADMIN_ARTICLE, ADMIN_LINK_SM, ADMIN_TABLE, ADMIN_TABLE_HEAD, ADMIN_TABLE_TD, ADMIN_TABLE_TH, ADMIN_TABLE_WRAP, ADMIN_TEXT_EMPTY, ADMIN_TEXT_META, ADMIN_TEXT_SECONDARY } from "./adminUi";
import {
  AdminAnalyticsMiniChart,
  AdminCollectionLink,
  AdminFunnelBar,
  AdminSectionTitle,
  AdminStatTile,
} from "./AdminAnalyticsWidgets";
import { AdminGa4ExternalLink } from "./AdminGa4ExternalLink";
import { AdminPeriodSelector } from "./AdminPeriodSelector";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

export function MarketplaceAdminOverviewPage() {
  const [days, setDays] = useState<AdminAnalyticsPeriod>(30);
  const analyticsQuery = useMarketplaceAdminAnalytics(days);
  const { statusQuery } = useCardhedgerPriceInfraAdmin();

  const data = analyticsQuery.data;
  const o = data?.overview;
  const infra = statusQuery.data;

  return (
    <>
      <MarketplaceAdminPageHeader
        title="Overview"
        subtitle="Operational health — platform KPIs, marketplace activity, and traffic via Google Analytics."
      />

      <AdminPeriodSelector
        days={days}
        onDaysChange={setDays}
        onRefresh={() => void analyticsQuery.refetch()}
        isRefreshing={analyticsQuery.isFetching}
        updatedAt={data?.generatedAt}
      />

      {analyticsQuery.isError ? (
        <div className={`${ADMIN_ARTICLE} mb-5 text-sm text-red-600 sm:mb-6`}>
          {(analyticsQuery.error as Error).message}
        </div>
      ) : null}

      {analyticsQuery.isLoading && !data ? (
        <div className={`${ADMIN_ARTICLE} text-sm text-zinc-700`}>
          Loading platform overview…
        </div>
      ) : null}

      {o && data ? (
        <>
          <div className={`${ADMIN_ARTICLE} mb-6`}>
            <AdminSectionTitle
              title="North star"
              subtitle="Marketplace health at a glance"
            />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
              <AdminStatTile
                label="Total sales"
                value={o.orders.fulfilledSales}
                hint={`${o.orders.salesInPeriod} in period`}
              />
              <AdminStatTile
                label="GMV (all time)"
                value={formatUsdcPricePrimary(o.trades.gmvUsdcTotal)}
                hint={`${formatUsdcPricePrimary(o.trades.gmvUsdcInPeriod)} in period`}
              />
              <AdminStatTile
                label="Active listings"
                value={o.orders.activeAsks}
                hint={`${o.orders.newAsksInPeriod} new asks`}
              />
              <AdminStatTile
                label="Mints"
                value={o.mints.total}
                hint={`${o.mints.inPeriod} in period`}
              />
              <AdminStatTile
                label="Collections"
                value={o.collections.total}
                hint={`${o.collections.withActiveListing} with listings`}
              />
              <AdminStatTile
                label="Registered users"
                value={o.users.total}
                hint={`${o.users.newInPeriod} new in period`}
              />
            </div>
          </div>

          <AdminGa4ExternalLink variant="compact" />

          <div className={`${ADMIN_ARTICLE} mb-6`}>
            <AdminSectionTitle
              title="Conversion funnel"
              subtitle="Signup → wallet → mint → list → sale"
            />
            <div className="grid gap-5 md:grid-cols-3">
              <AdminFunnelBar
                label="Signup → wallet"
                pct={o.funnel.signupToWalletPct}
                detail={`${o.users.withWallet} / ${o.users.total} users`}
              />
              <AdminFunnelBar
                label="Mint → first listing"
                pct={o.funnel.mintToListPct}
                detail={`${o.mints.withListingEver} / ${o.mints.total} minted tokens`}
              />
              <AdminFunnelBar
                label="Listed → sold"
                pct={o.funnel.listToSalePct}
                detail={`${o.mints.withFulfilledSale} / ${o.mints.withListingEver} listed tokens`}
              />
            </div>
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className={ADMIN_ARTICLE}>
              <AdminSectionTitle title="Users" />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <AdminStatTile label="Privy" value={o.users.privy} />
                <AdminStatTile label="Google" value={o.users.google} />
                <AdminStatTile label="Email OTP" value={o.users.emailOtp} />
                <AdminStatTile label="Wallet login" value={o.users.walletLogin} />
                <AdminStatTile label="With wallet" value={o.users.withWallet} />
                <AdminStatTile
                  label="Linked wallets"
                  value={o.users.linkedWallets}
                />
              </div>
            </div>

            <div className={ADMIN_ARTICLE}>
              <AdminSectionTitle
                title="Engagement & vault"
                subtitle="Watchlists and portfolio tracking"
                action={
                  <Link
                    href="/marketplace/admin/portfolio"
                    className={ADMIN_LINK_SM}
                  >
                    Portfolio ops →
                  </Link>
                }
              />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <AdminStatTile
                  label="Watchlist items"
                  value={o.watchlist.totalItems}
                  hint={`+${o.watchlist.addedInPeriod} in period`}
                />
                <AdminStatTile
                  label="Watchlist users"
                  value={o.watchlist.uniqueUsers}
                />
                <AdminStatTile
                  label="Watched collections"
                  value={o.watchlist.uniqueCollections}
                />
                <AdminStatTile
                  label="Portfolio wallets"
                  value={o.portfolio.trackedWallets}
                />
                <AdminStatTile
                  label="Portfolio snapshots"
                  value={o.portfolio.snapshotRows}
                />
                <AdminStatTile
                  label="Cost basis rows"
                  value={o.portfolio.holdingsWithCostBasis}
                  hint={`${o.portfolio.holdingsRows} holding rows`}
                />
              </div>
            </div>
          </div>

          <div className={`${ADMIN_ARTICLE} mb-5 sm:mb-6`}>
            <AdminSectionTitle
              title="AI pricing coverage"
              subtitle="Collections with Cardhedger price data"
              action={
                <Link
                  href="/marketplace/admin/collections"
                  className={ADMIN_LINK_SM}
                >
                  Manage collections →
                </Link>
              }
            />
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <AdminStatTile
                label="With Cardhedger"
                value={o.collections.withCardhedger}
                hint={`of ${o.collections.total} collections`}
              />
              <AdminStatTile
                label="With active listing"
                value={o.collections.withActiveListing}
              />
              <AdminStatTile
                label="With fulfilled sale"
                value={o.collections.withFulfilledTrade}
              />
              <AdminStatTile
                label="New in period"
                value={o.collections.inPeriod}
              />
            </div>
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className={ADMIN_ARTICLE}>
              <AdminSectionTitle title="Supply" />
              <div className="grid grid-cols-2 gap-4">
                <AdminStatTile label="Minted tokens" value={o.mints.total} />
                <AdminStatTile
                  label="Ever listed"
                  value={o.mints.withListingEver}
                />
                <AdminStatTile
                  label="Ever sold"
                  value={o.mints.withFulfilledSale}
                />
                <AdminStatTile
                  label="New mints"
                  value={o.mints.inPeriod}
                  hint="in period"
                />
              </div>
            </div>

            <div className={ADMIN_ARTICLE}>
              <AdminSectionTitle title="Orders & liquidity" />
              <div className="grid grid-cols-2 gap-4">
                <AdminStatTile label="Active asks" value={o.orders.activeAsks} />
                <AdminStatTile label="Active bids" value={o.orders.activeBids} />
                <AdminStatTile
                  label="Fulfilled sales"
                  value={o.orders.fulfilledSales}
                />
                <AdminStatTile
                  label="Sales in period"
                  value={o.orders.salesInPeriod}
                />
                <AdminStatTile
                  label="Cancelled"
                  value={o.orders.cancelled}
                />
                <AdminStatTile label="Expired" value={o.orders.expired} />
                <AdminStatTile
                  label="Avg sale"
                  value={
                    o.trades.avgSaleUsdc != null
                      ? formatUsdcPricePrimary(o.trades.avgSaleUsdc)
                      : "—"
                  }
                />
                <AdminStatTile
                  label="Unique sellers"
                  value={o.trades.uniqueSellers}
                />
              </div>
            </div>
          </div>

          <div className={`${ADMIN_ARTICLE} mb-6`}>
            <AdminSectionTitle
              title={`Activity — last ${data.periodDays} days`}
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <AdminAnalyticsMiniChart
                label="Signups"
                data={data.timeseries.signups}
                colorClass="bg-sky-500"
              />
              <AdminAnalyticsMiniChart
                label="Mints"
                data={data.timeseries.mints}
                colorClass="bg-violet-500"
              />
              <AdminAnalyticsMiniChart
                label="New listings"
                data={data.timeseries.newAsks}
                colorClass="bg-emerald-500"
              />
              <AdminAnalyticsMiniChart
                label="Sales"
                data={data.timeseries.sales}
                colorClass="bg-amber-500"
              />
              <AdminAnalyticsMiniChart
                label="GMV"
                data={data.timeseries.gmvUsdc}
                valueKey="amountUsdc"
                colorClass="bg-orange-500"
              />
            </div>
          </div>

          <div className={`${ADMIN_ARTICLE} mb-5 sm:mb-6`}>
            <AdminSectionTitle title="Orders breakdown" />
            <div className={ADMIN_TABLE_WRAP}>
              <table className={ADMIN_TABLE}>
                <thead>
                  <tr className={ADMIN_TABLE_HEAD}>
                    <th className={ADMIN_TABLE_TH}>Side</th>
                    <th className={ADMIN_TABLE_TH}>Status</th>
                    <th className={ADMIN_TABLE_TH}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {data.ordersBreakdown.map((row) => (
                    <tr key={`${row.side}-${row.status}`}>
                      <td className={ADMIN_TABLE_TD}>{row.side}</td>
                      <td className={ADMIN_TABLE_TD}>{row.status}</td>
                      <td className={`${ADMIN_TABLE_TD} font-medium text-zinc-900`}>
                        {row.count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-6 grid gap-6 lg:grid-cols-2">
            {(
              [
                ["Top by active listings", data.topCollections.byActiveListings],
                ["Top by sales", data.topCollections.bySales],
                ["Top by GMV", data.topCollections.byGmv],
                ["Top by watchlist", data.topCollections.byWatchlist],
              ] as const
            ).map(([title, rows]) => (
              <div key={title} className={ADMIN_ARTICLE}>
                <AdminSectionTitle title={title} />
                {rows.length === 0 ? (
                  <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>No data yet.</p>
                ) : (
                  <ol className="space-y-2 text-sm">
                    {rows.map((row, i) => (
                      <li
                        key={row.collectionKey}
                        className="flex items-center justify-between gap-2"
                      >
                        <span className="min-w-0 truncate text-zinc-700">
                          <span className={`mr-2 ${ADMIN_TEXT_META}`}>{i + 1}.</span>
                          <AdminCollectionLink
                            collectionKey={row.collectionKey}
                            label={row.displayLabel}
                          />
                        </span>
                        <span className="shrink-0 font-semibold text-zinc-900">
                          {row.gmvUsdc != null
                            ? formatUsdcPricePrimary(row.gmvUsdc)
                            : row.count.toLocaleString()}
                        </span>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            ))}
          </div>

          <div className={`${ADMIN_ARTICLE} mb-6`}>
            <AdminSectionTitle title="Recent platform sales" />
            {data.recentTrades.length === 0 ? (
              <p className={`text-sm ${ADMIN_TEXT_SECONDARY}`}>No fulfilled sales yet.</p>
            ) : (
              <div className={ADMIN_TABLE_WRAP}>
                <table className={ADMIN_TABLE}>
                  <thead>
                    <tr className={ADMIN_TABLE_HEAD}>
                      <th className={ADMIN_TABLE_TH}>Token</th>
                      <th className={ADMIN_TABLE_TH}>Collection</th>
                      <th className={ADMIN_TABLE_TH}>Price</th>
                      <th className={ADMIN_TABLE_TH}>Fulfilled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentTrades.map((t) => (
                      <tr key={t.orderHash}>
                        <td className={`${ADMIN_TABLE_TD} font-mono text-xs ${ADMIN_TEXT_META}`}>
                          #{t.tokenId}
                        </td>
                        <td className={ADMIN_TABLE_TD}>
                          {t.collectionKey ? (
                            <AdminCollectionLink
                              collectionKey={t.collectionKey}
                              label={t.displayLabel}
                            />
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className={`${ADMIN_TABLE_TD} font-medium text-zinc-900`}>
                          {formatUsdcPricePrimary(t.priceUsdc)}
                        </td>
                        <td className={`${ADMIN_TABLE_TD} text-xs ${ADMIN_TEXT_META}`}>
                          {new Date(t.fulfilledAt).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {infra ? (
            <div className={`${ADMIN_ARTICLE} mb-6`}>
              <AdminSectionTitle
                title="Price sync (Cardhedger)"
                subtitle="Operational context — see Price sync tab for actions"
              />
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <AdminStatTile label="Mode" value={infra.mode} />
                <AdminStatTile
                  label="Active subscriptions"
                  value={infra.activeSubscriptions}
                />
                <AdminStatTile
                  label="Delta cron"
                  value={infra.deltaCronEnabled ? "On" : "Off"}
                />
                <AdminStatTile
                  label="Recent delta runs"
                  value={infra.recentDeltaRuns.length}
                />
              </div>
            </div>
          ) : null}
        </>
      ) : null}
    </>
  );
}
