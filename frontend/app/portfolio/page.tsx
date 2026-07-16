"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useLinkedPortfolioWallet } from "@/hooks/auth/useLinkedPortfolioWallet";
import { usePortfolioWalletMismatchPrompt } from "@/hooks/auth/usePortfolioWalletMismatchPrompt";
import {
  usePortfolioCollectionKeys,
  usePortfolioDailyChart,
  usePortfolioBidActions,
  usePortfolioHoldingActions,
  usePortfolioHoldings,
  usePortfolioListingCollectionKeys,
  usePortfolioMarketPricing,
  usePortfolioMyBids,
  useUserAssets,
} from "@/hooks/portfolio";
import { useIsMobileViewport } from "@/hooks/ui";
import {
  buildPortfolioPricedRows,
  PORTFOLIO_USDC_DECIMALS,
} from "@/lib/portfolio/buildPortfolioPricedRows";
import { buildPortfolioTxRows } from "@/lib/portfolio/buildPortfolioTxRows";
import {
  PORTFOLIO_MOCK_ASSET_ROWS,
  PORTFOLIO_MOCK_BID_META_BY_KEY,
  PORTFOLIO_MOCK_BIDS,
  PORTFOLIO_MOCK_CHART_LABELS,
  PORTFOLIO_MOCK_CHART_POINTS,
  PORTFOLIO_MOCK_COST_BASIS_BY_TOKEN,
  PORTFOLIO_MOCK_METADATA_BY_TOKEN,
  PORTFOLIO_MOCK_STATS_BY_KEY,
  PORTFOLIO_MOCK_TOKEN_TO_COLLECTION_KEY,
  PORTFOLIO_MOCK_TOTAL_VALUE,
  PORTFOLIO_MOCK_TRADES_COUNT,
  PORTFOLIO_MOCK_TX_ROWS,
  isPortfolioMockTokenId,
  shouldUsePortfolioMock,
} from "@/lib/portfolio/portfolioMockData";
import type { OwnedAsset } from "@/lib/portfolio/portfolioTypes";
import { putPortfolioCostBasis, rq } from "@/lib/core";
import { invalidateAfterListing } from "@/lib/core/invalidation";
import { APP_MAIN_SHELL_CLASS } from "@/constants/layout";
import { HomeTicker } from "@/components/home/HomeTicker";
import { useAuthStore } from "@/store/authStore";
import { isLinkedPortfolioViewAddress } from "@/lib/auth/wallets";
import {
  PortfolioActivitySection,
  PortfolioCollectionBidsSection,
  PortfolioDisconnectedState,
  PortfolioGuestState,
  PortfolioCancelBidConfirmModal,
  PortfolioHoldingsSection,
  PortfolioMainSection,
  type PortfolioMainTab,
  PortfolioSummaryBar,
  PortfolioValuePanel,
} from "@/components/portfolio";
import { CollectionChangeBidModal } from "@/components/marketplace/collection-trading/CollectionChangeBidModal";
import { RwaDetailListModalHost } from "@/components/marketplace/rwa-detail/modals/RwaDetailListModalHost";
import { useSellAccessGate } from "@/hooks/auth/useSellAccessGate";
import { usePageViewedEvent } from "@/hooks/analytics/usePageViewedEvent";
import { trackEvent } from "@/lib/analytics/googleAnalytics";

export default function PortfolioPage() {
  usePageViewedEvent("portfolio");
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
  const isMobileViewport = useIsMobileViewport();
  const [portfolioMainTab, setPortfolioMainTab] = useState<PortfolioMainTab>("collectibles");
  const [savingCostBasisTokenId, setSavingCostBasisTokenId] = useState<number | null>(null);
  const [listModal, setListModal] = useState<{
    tokenId: number;
    assetTitle: string;
    collectionKey?: string;
    existingAskOrderHash?: string;
  } | null>(null);
  const listQueryHandledRef = useRef<string | null>(null);

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab === "bids") {
      setPortfolioMainTab("bids");
      return;
    }
    if (tab === "history" || tab === "transaction-history" || tab === "watchlist") {
      setPortfolioMainTab("history");
      return;
    }
    if (tab === "collectibles" || tab === "assets") {
      setPortfolioMainTab("collectibles");
    }
  }, [searchParams]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#transaction-history") {
      setPortfolioMainTab("history");
    }
  }, []);

  const {
    assets: hookAssets,
    tokenIds,
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

  const assets: OwnedAsset[] = useMemo(
    () =>
      hookAssets.map((a) => ({
        tokenId: a.tokenId,
        metadata: a.metadata,
        imageUrl: a.imageUrl,
      })),
    [hookAssets],
  );

  const metadataByTokenId = useMemo(() => {
    const m = new Map<number, OwnedAsset["metadata"]>();
    for (const a of assets) {
      m.set(a.tokenId, a.metadata);
    }
    return m;
  }, [assets]);

  const listingCollectionKeyByToken = usePortfolioListingCollectionKeys(
    allOrders,
    portfolioAddress,
  );

  const { tokenToCollectionKey, uniqueCollectionKeys } = usePortfolioCollectionKeys({
    address: portfolioAddress,
    isConnected: portfolioDataEnabled,
    assets,
    tokenIds,
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

  const { costBasisByTokenId, hiddenSet } = usePortfolioHoldings(
    portfolioAddress,
    tokenIds,
    portfolioDataEnabled,
  );

  const assetRows = useMemo(
    () =>
      buildPortfolioPricedRows({
        assets,
        listingByTokenId,
        tokenToCollectionKey,
        statsByCollectionKey,
        seriesByCollectionKey,
        mintPreviewByToken,
      }).sort((a, b) => Number(b.tokenId) - Number(a.tokenId)),
    [
      assets,
      listingByTokenId,
      tokenToCollectionKey,
      statsByCollectionKey,
      seriesByCollectionKey,
      mintPreviewByToken,
    ],
  );

  const saveCostBasis = async (tokenId: number, costBasisUsd: number) => {
    if (!signerAddress) return;
    setSavingCostBasisTokenId(tokenId);
    try {
      await putPortfolioCostBasis(signerAddress, tokenId, costBasisUsd);
      await queryClient.invalidateQueries({
        queryKey: rq.portfolioHoldings(signerAddress, tokenIds),
      });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to save cost basis");
      throw err;
    } finally {
      setSavingCostBasisTokenId(null);
    }
  };

  const holdingActions = usePortfolioHoldingActions({
    address: signerAddress,
    tokenIds,
    queryClient,
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

  const visibleAssetRows = useMemo(
    () => assetRows.filter((row) => !hiddenSet.has(row.tokenId)),
    [assetRows, hiddenSet],
  );

  const usePortfolioMocks = shouldUsePortfolioMock(visibleAssetRows.length > 0);

  const displayAssetRows = usePortfolioMocks ? PORTFOLIO_MOCK_ASSET_ROWS : visibleAssetRows;
  const displayMetadataByTokenId = usePortfolioMocks
    ? PORTFOLIO_MOCK_METADATA_BY_TOKEN
    : metadataByTokenId;
  const displayCostBasisByTokenId = usePortfolioMocks
    ? PORTFOLIO_MOCK_COST_BASIS_BY_TOKEN
    : costBasisByTokenId;
  const displayTokenToCollectionKey = usePortfolioMocks
    ? PORTFOLIO_MOCK_TOKEN_TO_COLLECTION_KEY
    : tokenToCollectionKey;
  const displayStatsByCollectionKey = usePortfolioMocks
    ? PORTFOLIO_MOCK_STATS_BY_KEY
    : statsByCollectionKey;
  const displayTxRows = usePortfolioMocks ? PORTFOLIO_MOCK_TX_ROWS : txRows;
  const displayBids = usePortfolioMocks ? PORTFOLIO_MOCK_BIDS : myBids.activeBids;
  const displayBidMeta = usePortfolioMocks
    ? PORTFOLIO_MOCK_BID_META_BY_KEY
    : myBids.collectionMetaByKey;

  const openPortfolioListModal = useCallback(
    (tokenId: number) => {
      if (isPortfolioMockTokenId(tokenId)) return;
      runSellAccessGate(() => {
        const row = assetRows.find((r) => r.tokenId === tokenId);
        const listing = listingByTokenId.get(tokenId);
        setListModal({
          tokenId,
          assetTitle: row?.name ?? `RWA #${tokenId}`,
          collectionKey: tokenToCollectionKey[tokenId],
          existingAskOrderHash: listing?.orderHash,
        });
      });
    },
    [assetRows, listingByTokenId, runSellAccessGate, tokenToCollectionKey],
  );

  const {
    dailySnapshotsLoading,
    portfolioValue,
    dailyChartPoints,
    dailyChartLabels,
  } = usePortfolioDailyChart(portfolioAddress, portfolioDataEnabled);

  const displayPortfolioValue = usePortfolioMocks
    ? PORTFOLIO_MOCK_TOTAL_VALUE
    : (portfolioValue ?? 0);
  const displayChartPoints = usePortfolioMocks
    ? PORTFOLIO_MOCK_CHART_POINTS
    : dailyChartPoints;
  const displayChartLabels = usePortfolioMocks
    ? PORTFOLIO_MOCK_CHART_LABELS
    : dailyChartLabels;

  const assetsSectionLoading =
    !usePortfolioMocks && (idsLoading || assetsLoading);
  const portfolioValuePending = !usePortfolioMocks && dailySnapshotsLoading;
  const bidsSectionLoading = !usePortfolioMocks && myBids.loading;
  const historySectionLoading =
    !usePortfolioMocks && (idsLoading || historyBatchLoading);

  const portfolioViewedFiredRef = useRef(false);
  useEffect(() => {
    if (!user || !wallet.hasLinkedWallet) return;
    if (assetsSectionLoading || portfolioValuePending) return;
    if (portfolioViewedFiredRef.current) return;
    portfolioViewedFiredRef.current = true;
    trackEvent("portfolio_viewed", {
      total_assets: displayAssetRows.length,
      total_value: displayPortfolioValue,
    });
  }, [user, wallet.hasLinkedWallet, assetsSectionLoading, portfolioValuePending, displayAssetRows.length, displayPortfolioValue]);

  useEffect(() => {
    const listParam = searchParams.get("list")?.trim() ?? "";
    if (!/^\d+$/.test(listParam)) return;
    if (listQueryHandledRef.current === listParam) return;
    if (!portfolioDataEnabled || assetsSectionLoading) return;

    const tokenId = Number(listParam);
    const ownsToken = tokenIds.includes(tokenId);
    listQueryHandledRef.current = listParam;
    router.replace("/portfolio", { scroll: false });

    if (ownsToken) {
      openPortfolioListModal(tokenId);
    }
  }, [
    searchParams,
    portfolioDataEnabled,
    assetsSectionLoading,
    tokenIds,
    router,
    openPortfolioListModal,
  ]);

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
    <div className="portfolio-page min-h-screen min-w-0 overflow-x-clip text-white">
      <HomeTicker />
      <div className={`portfolio-page__shell tkl-wrap ${APP_MAIN_SHELL_CLASS}`}>
        {!isConnected ? (
          <p className="mb-4 rounded-xl border border-white/10 bg-white/4 px-4 py-3 text-xs text-[var(--t2)]">
            Connect your Privy wallet to manage listings and bids.
          </p>
        ) : null}

        <PortfolioSummaryBar
          holdingsCount={displayAssetRows.length}
          tradesCount={
            usePortfolioMocks ? PORTFOLIO_MOCK_TRADES_COUNT : displayTxRows.length
          }
        />

        <PortfolioValuePanel
          chartTotalsPending={portfolioValuePending}
          isMobileViewport={isMobileViewport}
          dailyChartPoints={displayChartPoints}
          dailyChartLabels={displayChartLabels}
          totalValue={displayPortfolioValue}
        />

        <PortfolioMainSection
          activeTab={portfolioMainTab}
          onTabChange={setPortfolioMainTab}
          collectiblesPanel={
            <PortfolioHoldingsSection
              assetsSectionLoading={assetsSectionLoading}
              assetRows={displayAssetRows}
              metadataByTokenId={displayMetadataByTokenId}
              tokenToCollectionKey={displayTokenToCollectionKey}
              seriesByCollectionKey={seriesByCollectionKey}
              costBasisByTokenId={displayCostBasisByTokenId}
              valuesPending={!usePortfolioMocks && valuesPending}
              canEditCostBasis={!usePortfolioMocks && Boolean(signerAddress)}
              onSaveCostBasis={usePortfolioMocks ? undefined : saveCostBasis}
              savingCostBasisTokenId={savingCostBasisTokenId}
              cancellingListingTokenId={holdingActions.cancellingListingTokenId}
              onOpenToken={(tokenId) => {
                const ck = displayTokenToCollectionKey[tokenId];
                if (ck) {
                  router.push(
                    `/marketplace/collections/${encodeURIComponent(ck)}?listing=${tokenId}`,
                  );
                } else {
                  router.push(`/marketplace/${tokenId}`);
                }
              }}
              onChangeListing={openPortfolioListModal}
              onCancelListing={(tokenId, orderHash) => {
                if (isPortfolioMockTokenId(tokenId)) return;
                const priceUsd = listingByTokenId.get(tokenId)?.priceUsd;
                void holdingActions.cancelListing(tokenId, orderHash, priceUsd);
              }}
              onSellNow={openPortfolioListModal}
            />
          }
          bidsPanel={
            <PortfolioCollectionBidsSection
              loading={bidsSectionLoading}
              metaLoading={!usePortfolioMocks && myBids.collectionMetaLoading}
              activeBids={displayBids}
              collectionMetaByKey={displayBidMeta}
              statsByCollectionKey={displayStatsByCollectionKey}
              cancellingHash={bidActions.cancellingHash}
              openingChangeHash={bidActions.openingChangeHash}
              onCancel={(hash, key, label, price) => {
                if (usePortfolioMocks) return;
                bidActions.requestCancel(hash, key, label, price);
              }}
              onChangePrice={(hash, key) => {
                if (usePortfolioMocks) return;
                void bidActions.openChangeBid(hash, key);
              }}
            />
          }
          historyPanel={
            <PortfolioActivitySection
              loading={historySectionLoading}
              txRows={displayTxRows}
            />
          }
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

      {listModal != null ? (
        <RwaDetailListModalHost
          open
          tokenId={listModal.tokenId}
          assetTitle={listModal.assetTitle}
          collectionKey={listModal.collectionKey}
          collectionBids={[]}
          existingAskOrderHash={listModal.existingAskOrderHash}
          initialPriceUsdc={null}
          onMatchedSale={() => {}}
          onClose={() => setListModal(null)}
          onListed={() => {
            void invalidateAfterListing(queryClient, {
              collectionKey: listModal.collectionKey,
              address: signerAddress ?? portfolioAddress,
              tokenId: listModal.tokenId,
            });
            void refetchActiveOrders();
            setListModal(null);
          }}
        />
      ) : null}
    </div>
  );
}
