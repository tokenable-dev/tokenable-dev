"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { usePublicClient, useWriteContract } from "wagmi";
import { sepolia } from "viem/chains";
import { useLinkedPortfolioWallet } from "@/hooks/auth/useLinkedPortfolioWallet";
import { usePortfolioWalletMismatchPrompt } from "@/hooks/auth/usePortfolioWalletMismatchPrompt";
import {
  usePortfolioAssetList,
  usePortfolioCollectionKeys,
  usePortfolioDailyChart,
  usePortfolioBidActions,
  usePortfolioHoldingActions,
  usePortfolioListingCollectionKeys,
  usePortfolioMarketPricing,
  usePortfolioMyBids,
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
import { useAuthStore } from "@/store/authStore";
import { isLinkedPortfolioViewAddress } from "@/lib/auth/wallets";
import {
  PortfolioActivitySection,
  PortfolioCollectionBidsSection,
  PortfolioDisconnectedState,
  PortfolioGuestState,
  PortfolioCancelBidConfirmModal,
  PortfolioHideConfirmModal,
  PortfolioHoldingsSection,
  PortfolioMainSection,
  type PortfolioMainTab,
  PortfolioSummaryBar,
  PortfolioValuePanel,
  PortfolioWatchlistSection,
} from "@/components/portfolio";
import { CollectionChangeBidModal } from "@/components/marketplace/collection-trading/CollectionChangeBidModal";
import { isMarketplaceAdminWallet } from "@/lib/marketplace";
import { useSellAccessGate } from "@/hooks/auth/useSellAccessGate";

export default function PortfolioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const authInitialized = useAuthStore((s) => s.initialized);
  const authLoading = useAuthStore((s) => s.loading);
  const { runSellAccessGate } = useSellAccessGate("/portfolio");
  const wallet = useLinkedPortfolioWallet();
  const { connectedAddress, isConnected } = wallet;
  const portfolioMismatchPromptEnabled =
    authInitialized && Boolean(user) && wallet.hasLinkedWallet;
  usePortfolioWalletMismatchPrompt(portfolioMismatchPromptEnabled);
  const portfolioAddress = wallet.portfolioAddress;
  const portfolioDataEnabled =
    authInitialized &&
    Boolean(user) &&
    Boolean(portfolioAddress) &&
    isLinkedPortfolioViewAddress(user, portfolioAddress);
  const signerAddress = wallet.canSign ? connectedAddress : undefined;
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { writeContractAsync } = useWriteContract();
  const isMobileViewport = useIsMobileViewport();
  const [portfolioChartOpen, setPortfolioChartOpen] = useState(false);
  const [portfolioMainTab, setPortfolioMainTab] = useState<PortfolioMainTab>("collectibles");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "watchlist" || tab === "bids" || tab === "collectibles") {
      setPortfolioMainTab(tab);
    }
  }, [searchParams]);

  const isBurnAdmin = isMarketplaceAdminWallet(
    wallet.connectedIsLinked ? connectedAddress : portfolioAddress,
  );

  const {
    assets: hookAssets,
    activeOrders: allOrders,
    historiesFlat,
    isLoadingIds: idsLoading,
    isLoadingMetadata: assetsLoading,
    isLoadingHistoryBatch: historyBatchLoading,
    refetchActiveOrders,
  } = useUserAssets(portfolioAddress, {
    enabled: portfolioDataEnabled,
    includeOrderHistory: true,
    includeMarketPreview: false,
    retainPreviousOwner: false,
  });

  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#transaction-history") return;
    const scrollToHistory = () => {
      document.getElementById("transaction-history")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    };
    const timer = window.setTimeout(scrollToHistory, 150);
    return () => window.clearTimeout(timer);
  }, [searchParams, idsLoading, historyBatchLoading]);

  const assets: OwnedAsset[] = useMemo(
    () =>
      hookAssets.map((a) => ({
        tokenId: a.tokenId,
        metadata: a.metadata,
        imageUrl: a.imageUrl,
      })),
    [hookAssets],
  );

  const { hiddenSet } = usePortfolioHiddenHoldings(
    portfolioAddress,
    portfolioDataEnabled,
  );

  const listingCollectionKeyByToken = usePortfolioListingCollectionKeys(
    allOrders,
    portfolioAddress,
  );

  const { tokenToCollectionKey, uniqueCollectionKeys } = usePortfolioCollectionKeys({
    address: portfolioAddress,
    isConnected: portfolioDataEnabled,
    assets,
    listingCollectionKeyByToken,
  });

  const {
    statsByCollectionKey,
    seriesByCollectionKey,
    mintPreviewByToken,
    valuesPending,
  } = usePortfolioMarketPricing({
    address: portfolioAddress,
    isConnected: portfolioDataEnabled,
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
          (o.offerer?.trim().toLowerCase() ?? "") ===
            portfolioAddress?.toLowerCase(),
      ),
    [allOrders, portfolioAddress],
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
    filteredAssetRows,
  } = usePortfolioAssetList(assetRows, hiddenSet);

  useEffect(() => {
    if (assetFilter !== "hidden" && assetFilter !== "all") {
      setAssetFilter("all");
    }
  }, [assetFilter, setAssetFilter]);

  const holdingActions = usePortfolioHoldingActions({
    address: signerAddress,
    queryClient,
    publicClient: publicClient ?? undefined,
    writeContractAsync,
    refetchActiveOrders,
  });

  const myBids = usePortfolioMyBids(portfolioDataEnabled ? portfolioAddress : undefined);
  const bidActions = usePortfolioBidActions({
    address: signerAddress,
    queryClient,
    refetchActiveOrders,
    refetchPortfolioBids: () => myBids.refetchBids(),
  });

  const txRows = useMemo(() => {
    if (!portfolioAddress) return [];
    return buildPortfolioTxRows(fulfilledOrders, portfolioAddress, assets);
  }, [fulfilledOrders, portfolioAddress, assets]);

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
  } = usePortfolioDailyChart(portfolioAddress, portfolioDataEnabled);

  const totalTrades = fulfilledOrders.length;
  const assetsSectionLoading = idsLoading || assetsLoading;
  const chartTotalsPending = idsLoading || dailySnapshotsLoading;

  if (!authInitialized || authLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-black">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-mint/30 border-t-mint" />
      </div>
    );
  }

  if (!user) {
    return <PortfolioGuestState />;
  }

  if (!wallet.hasLinkedWallet) {
    return <PortfolioDisconnectedState />;
  }

  return (
    <div className="min-h-screen min-w-0 overflow-x-clip bg-black text-white">
      <div className={`${APP_MAIN_SHELL_CLASS} py-5 pb-16 sm:py-8 sm:pb-20`}>
        {!isConnected ? (
          <p className="mb-4 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3 text-xs text-gray-400">
            Connect MetaMask with a linked wallet to manage listings and bids.
          </p>
        ) : null}
        <PortfolioSummaryBar
          holdingsCount={holdingsAssetRows.length}
          totalTrades={totalTrades}
          totalValue={totalValue}
          dailyPnlPct={dailyPnlPct}
          chartTotalsPending={chartTotalsPending}
          hasDailyPnl={hasDailyPnl}
          dailyPnlUsd={dailyPnlUsd}
          portfolioChartOpen={portfolioChartOpen}
          onToggleChart={() => setPortfolioChartOpen((open) => !open)}
        />

        <PortfolioValuePanel
          chartTotalsPending={chartTotalsPending}
          portfolioChartOpen={portfolioChartOpen}
          isMobileViewport={isMobileViewport}
          dailyChartPoints={dailyChartPoints}
          dailyChartLabels={dailyChartLabels}
        />

        <PortfolioMainSection
          activeTab={portfolioMainTab}
          onTabChange={setPortfolioMainTab}
          collectiblesPanel={
            <PortfolioHoldingsSection
              embedded
              assetsSectionLoading={assetsSectionLoading}
              assetRowsLength={assetRows.length}
              assetFilter={assetFilter}
              setAssetFilter={setAssetFilter}
              hiddenAssetCount={hiddenAssetRows.length}
              filteredAssetRows={filteredAssetRows}
              address={portfolioAddress}
              valuesPending={valuesPending}
              isBurnAdmin={isBurnAdmin}
              cancellingListingTokenId={holdingActions.cancellingListingTokenId}
              burningTokenId={holdingActions.burningTokenId}
              hidingTokenId={holdingActions.hidingTokenId}
              unhidingTokenId={holdingActions.unhidingTokenId}
              onOpenToken={(tokenId) => router.push(`/marketplace/${tokenId}`)}
              onChangeListing={(tokenId) =>
                runSellAccessGate(() =>
                  router.push(`/marketplace/${tokenId}?list=1`),
                )
              }
              onRequestHide={(r) => {
                holdingActions.requestHide(r.tokenId, r.name, r.listPriceUsd != null);
              }}
              onUnhide={(tokenId) => void holdingActions.unhideHolding(tokenId)}
              onCancelListing={(tokenId, orderHash) =>
                void holdingActions.cancelListing(tokenId, orderHash)
              }
              onBurn={(tokenId, hasListing) =>
                void holdingActions.burnToken(tokenId, hasListing)
              }
            />
          }
          bidsPanel={
            <PortfolioCollectionBidsSection
              embedded
              loading={myBids.loading}
              metaLoading={myBids.collectionMetaLoading}
              activeBids={myBids.activeBids}
              collectionMetaByKey={myBids.collectionMetaByKey}
              cancellingHash={bidActions.cancellingHash}
              openingChangeHash={bidActions.openingChangeHash}
              onCancel={(hash, key, label, price) =>
                bidActions.requestCancel(hash, key, label, price)
              }
              onChangePrice={(hash, key) => void bidActions.openChangeBid(hash, key)}
            />
          }
          watchlistPanel={<PortfolioWatchlistSection />}
        />

        <PortfolioActivitySection
          loading={idsLoading || historyBatchLoading}
          txRows={txRows}
        />
      </div>

      {bidActions.changeModal != null ? (
        <CollectionChangeBidModal
          open
          bid={bidActions.changeModal.bid}
          collectionKey={bidActions.changeModal.collectionKey}
          activeAsks={bidActions.changeModal.activeAsks}
          connectedAddress={signerAddress}
          onClose={bidActions.closeChangeModal}
          onUpdated={() =>
            void bidActions.handleBidUpdated(bidActions.changeModal!.collectionKey)
          }
        />
      ) : null}

      {bidActions.cancelConfirm != null ? (
        <PortfolioCancelBidConfirmModal
          open
          collectionLabel={bidActions.cancelConfirm.collectionLabel}
          priceLabel={bidActions.cancelConfirm.priceLabel}
          pending={bidActions.cancellingHash === bidActions.cancelConfirm.orderHash}
          onClose={bidActions.closeCancelConfirm}
          onConfirm={() => void bidActions.confirmCancel()}
        />
      ) : null}

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
