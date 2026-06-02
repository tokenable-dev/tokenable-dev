"use client";

import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { sepolia } from "viem/chains";
import {
  usePortfolioAssetList,
  usePortfolioCollectionKeys,
  usePortfolioDailyChart,
  usePortfolioHoldingActions,
  usePortfolioListingCollectionKeys,
  usePortfolioMarketPricing,
  useUserAssets,
} from "@/hooks/portfolio";
import { usePortfolioHiddenHoldings } from "@/hooks/portfolio/usePortfolioPageData";
import { useIsMobileViewport } from "@/hooks/ui";
import {
  buildPortfolioPricedRows,
  PORTFOLIO_USDC_DECIMALS,
} from "@/lib/portfolio/buildPortfolioPricedRows";
import { buildPortfolioTxRows } from "@/lib/portfolio/buildPortfolioTxRows";
import type { OwnedAsset, PricedAssetRow } from "@/lib/portfolio/portfolioTypes";
import { APP_MAIN_SHELL_CLASS } from "@/constants/layout";
import {
  PortfolioActivitySection,
  PortfolioDisconnectedState,
  PortfolioHideConfirmModal,
  PortfolioHoldingsSection,
  PortfolioSummaryBar,
  PortfolioValuePanel,
} from "@/components/portfolio";
import { isMarketplaceAdminWallet } from "@/lib/marketplace";

export default function PortfolioPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { writeContractAsync } = useWriteContract();
  const isMobileViewport = useIsMobileViewport();
  const [portfolioChartOpen, setPortfolioChartOpen] = useState(false);
  const isBurnAdmin = isMarketplaceAdminWallet(address);

  const {
    assets: hookAssets,
    activeOrders: allOrders,
    historiesFlat,
    isLoadingIds: idsLoading,
    isLoadingMetadata: assetsLoading,
    isLoadingHistoryBatch: historyBatchLoading,
    refetchActiveOrders,
  } = useUserAssets(isConnected ? address : undefined, {
    enabled: Boolean(address && isConnected),
    includeOrderHistory: true,
    includeMarketPreview: false,
  });

  const assets: OwnedAsset[] = useMemo(
    () =>
      hookAssets.map((a) => ({
        tokenId: a.tokenId,
        metadata: a.metadata,
        imageUrl: a.imageUrl,
      })),
    [hookAssets],
  );

  const { hiddenSet } = usePortfolioHiddenHoldings(address, isConnected);

  const listingCollectionKeyByToken = usePortfolioListingCollectionKeys(
    allOrders,
    address,
  );

  const { tokenToCollectionKey, uniqueCollectionKeys } = usePortfolioCollectionKeys({
    address,
    isConnected,
    assets,
    listingCollectionKeyByToken,
  });

  const {
    statsByCollectionKey,
    seriesByCollectionKey,
    mintPreviewByToken,
    valuesPending,
  } = usePortfolioMarketPricing({
    address,
    isConnected,
    assets,
    uniqueCollectionKeys,
    tokenToCollectionKey,
  });

  const myActiveListings = useMemo(
    () =>
      allOrders.filter(
        (o) =>
          o.status === "active" &&
          o.side === "ask" &&
          (o.offerer?.trim().toLowerCase() ?? "") === address?.toLowerCase(),
      ),
    [allOrders, address],
  );

  const listingByTokenId = useMemo(() => {
    const m = new Map<number, { priceUsd: number; orderHash: string }>();
    for (const o of myActiveListings) {
      const tid = Number(o.tokenId);
      if (!Number.isFinite(tid)) continue;
      m.set(tid, {
        priceUsd: Number(o.price) / PORTFOLIO_USDC_DECIMALS,
        orderHash: o.orderHash,
      });
    }
    return m;
  }, [myActiveListings]);

  const fulfilledOrders = useMemo(
    () =>
      historiesFlat
        .filter((o) => o.status === "fulfilled")
        .sort(
          (a, b) =>
            new Date(b.updatedAt ?? b.createdAt).getTime() -
            new Date(a.updatedAt ?? a.createdAt).getTime(),
        ),
    [historiesFlat],
  );

  const pricedRows: PricedAssetRow[] = useMemo(
    () =>
      buildPortfolioPricedRows({
        assets,
        listingByTokenId,
        tokenToCollectionKey,
        statsByCollectionKey,
        seriesByCollectionKey,
        mintPreviewByToken,
      }),
    [
      assets,
      listingByTokenId,
      tokenToCollectionKey,
      statsByCollectionKey,
      seriesByCollectionKey,
      mintPreviewByToken,
    ],
  );

  const assetRows = useMemo(() => {
    const rows = [...pricedRows];
    rows.sort((a, b) => Number(b.tokenId) - Number(a.tokenId));
    return rows;
  }, [pricedRows]);

  const {
    assetFilter,
    setAssetFilter,
    holdingsAssetRows,
    hiddenAssetRows,
    listedAssetCount,
    unlistedAssetCount,
    filteredAssetRows,
    pagedAssetRows,
    visibleAssetCount,
    assetScrollSentinelRef,
  } = usePortfolioAssetList(assetRows, hiddenSet);

  const holdingActions = usePortfolioHoldingActions({
    address,
    queryClient,
    publicClient: publicClient ?? undefined,
    writeContractAsync,
    refetchActiveOrders,
  });

  const txRows = useMemo(() => {
    if (!address) return [];
    return buildPortfolioTxRows(fulfilledOrders, address, assets);
  }, [fulfilledOrders, address, assets]);

  const totalValue = useMemo(
    () => holdingsAssetRows.reduce((s, r) => s + (r.currentPrice ?? 0), 0),
    [holdingsAssetRows],
  );

  const {
    dailySnapshotsLoading,
    dailyPnlUsd,
    dailyPnlPct,
    hasDailyPnl,
    dailyChartPoints,
    dailyChartLabels,
  } = usePortfolioDailyChart(address, isConnected);

  const totalTrades = fulfilledOrders.length;
  const assetsSectionLoading = idsLoading || assetsLoading;
  const chartTotalsPending = idsLoading || dailySnapshotsLoading;

  if (!isConnected) {
    return <PortfolioDisconnectedState />;
  }

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-black text-white">
      <div className={`${APP_MAIN_SHELL_CLASS} py-8 pb-20`}>
        <PortfolioSummaryBar
          holdingsCount={holdingsAssetRows.length}
          totalTrades={totalTrades}
          chartTotalsPending={chartTotalsPending}
          hasDailyPnl={hasDailyPnl}
          dailyPnlUsd={dailyPnlUsd}
        />

        <PortfolioValuePanel
          totalValue={totalValue}
          dailyPnlPct={dailyPnlPct}
          chartTotalsPending={chartTotalsPending}
          portfolioChartOpen={portfolioChartOpen}
          onToggleChart={() => setPortfolioChartOpen((open) => !open)}
          isMobileViewport={isMobileViewport}
          dailyChartPoints={dailyChartPoints}
          dailyChartLabels={dailyChartLabels}
        />

        <PortfolioHoldingsSection
          assetsSectionLoading={assetsSectionLoading}
          assetRowsLength={assetRows.length}
          assetFilter={assetFilter}
          setAssetFilter={setAssetFilter}
          holdingsCount={holdingsAssetRows.length}
          listedAssetCount={listedAssetCount}
          unlistedAssetCount={unlistedAssetCount}
          hiddenAssetCount={hiddenAssetRows.length}
          filteredAssetRows={filteredAssetRows}
          pagedAssetRows={pagedAssetRows}
          visibleAssetCount={visibleAssetCount}
          assetScrollSentinelRef={assetScrollSentinelRef}
          address={address}
          valuesPending={valuesPending}
          isBurnAdmin={isBurnAdmin}
          cancellingListingTokenId={holdingActions.cancellingListingTokenId}
          burningTokenId={holdingActions.burningTokenId}
          hidingTokenId={holdingActions.hidingTokenId}
          unhidingTokenId={holdingActions.unhidingTokenId}
          onOpenToken={(tokenId) => router.push(`/marketplace/${tokenId}`)}
          onRequestHide={(r) => {
            const titleLine = r.setName ? `${r.name} · ${r.setName}` : r.name;
            holdingActions.requestHide(r.tokenId, titleLine, r.listPriceUsd != null);
          }}
          onUnhide={(tokenId) => void holdingActions.unhideHolding(tokenId)}
          onCancelListing={(tokenId, orderHash) =>
            void holdingActions.cancelListing(tokenId, orderHash)
          }
          onBurn={(tokenId, hasListing) => void holdingActions.burnToken(tokenId, hasListing)}
        />

        <PortfolioActivitySection
          loading={idsLoading || historyBatchLoading}
          txRows={txRows}
        />
      </div>

      <PortfolioHideConfirmModal
        open={holdingActions.hideConfirm != null}
        tokenId={holdingActions.hideConfirm?.tokenId ?? 0}
        assetName={holdingActions.hideConfirm?.name ?? ""}
        pending={
          holdingActions.hideConfirm != null &&
          holdingActions.hidingTokenId === holdingActions.hideConfirm.tokenId
        }
        onClose={() => {
          if (holdingActions.hidingTokenId == null) {
            holdingActions.setHideConfirm(null);
          }
        }}
        onConfirm={() => {
          if (holdingActions.hideConfirm) {
            void holdingActions.executeHideHolding(holdingActions.hideConfirm.tokenId);
          }
        }}
      />
    </div>
  );
}
