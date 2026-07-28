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
  PORTFOLIO_USDC_DECIMALS,
  buildPortfolioPricedRows,
} from "@/lib/portfolio/buildPortfolioPricedRows";
import { buildPortfolioTxRows } from "@/lib/portfolio/buildPortfolioTxRows";
import type { OwnedAsset } from "@/lib/portfolio/portfolioTypes";
import { putPortfolioCostBasis, rq } from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";
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
  PortfolioCancelListingConfirmModal,
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
import { formatPortfolioGradeLabel } from "@/lib/portfolio/portfolioTableHelpers";
import { usePortfolioCollectionTopBids } from "@/hooks/portfolio/usePortfolioCollectionTopBids";

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
    marketValueUsd?: number | null;
    listedPriceUsd?: number | null;
  } | null>(null);
  const [cancelListingConfirm, setCancelListingConfirm] = useState<{
    tokenId: number;
    assetTitle: string;
    gradeLabel: string | null;
    orderHash: string;
    listPriceUsd: number | null;
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
        queryKey: rq.portfolioHoldings(signerAddress, tokenIds, activeRqChainId()),
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

  const openPortfolioSetPriceModal = useCallback(
    (tokenId: number) => {
      runSellAccessGate(() => {
        const row = assetRows.find((r) => r.tokenId === tokenId);
        const listing = listingByTokenId.get(tokenId);
        setListModal({
          tokenId,
          assetTitle: row?.name ?? `RWA #${tokenId}`,
          collectionKey: tokenToCollectionKey[tokenId],
          existingAskOrderHash: listing?.orderHash,
          marketValueUsd: row?.currentPrice ?? null,
          listedPriceUsd: listing?.priceUsd ?? row?.listPriceUsd ?? null,
        });
      });
    },
    [assetRows, listingByTokenId, runSellAccessGate, tokenToCollectionKey],
  );

  const collectionTopBids = usePortfolioCollectionTopBids(
    uniqueCollectionKeys,
    portfolioDataEnabled,
  );

  const highestBidByCollectionKey = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const [key, info] of collectionTopBids.byCollectionKey) {
      map.set(key, info.highestBidUsd);
    }
    return map;
  }, [collectionTopBids.byCollectionKey]);

  const {
    dailySnapshotsLoading,
    portfolioValue,
    dailyChartPoints,
    dailyChartLabels,
  } = usePortfolioDailyChart(portfolioAddress, portfolioDataEnabled);

  const assetsSectionLoading = idsLoading || assetsLoading;
  const portfolioValuePending = dailySnapshotsLoading;
  const bidsSectionLoading = myBids.loading;
  const historySectionLoading = idsLoading || historyBatchLoading;

  const portfolioViewedFiredRef = useRef(false);
  useEffect(() => {
    if (!user || !wallet.hasLinkedWallet) return;
    if (assetsSectionLoading || portfolioValuePending) return;
    if (portfolioViewedFiredRef.current) return;
    portfolioViewedFiredRef.current = true;
    trackEvent("portfolio_viewed", {
      total_assets: visibleAssetRows.length,
      total_value: portfolioValue ?? 0,
    });
  }, [
    user,
    wallet.hasLinkedWallet,
    assetsSectionLoading,
    portfolioValuePending,
    visibleAssetRows.length,
    portfolioValue,
  ]);

  useEffect(() => {
    const listParam =
      searchParams.get("setprice")?.trim() ||
      searchParams.get("list")?.trim() ||
      "";
    if (!/^\d+$/.test(listParam)) return;
    if (listQueryHandledRef.current === listParam) return;
    if (!portfolioDataEnabled || assetsSectionLoading) return;

    const tokenId = Number(listParam);
    const ownsToken = tokenIds.includes(tokenId);
    listQueryHandledRef.current = listParam;
    router.replace("/portfolio", { scroll: false });

    if (ownsToken) {
      openPortfolioSetPriceModal(tokenId);
    }
  }, [
    searchParams,
    portfolioDataEnabled,
    assetsSectionLoading,
    tokenIds,
    router,
    openPortfolioSetPriceModal,
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
          holdingsCount={visibleAssetRows.length}
          tradesCount={txRows.length}
        />

        <PortfolioValuePanel
          chartTotalsPending={portfolioValuePending}
          isMobileViewport={isMobileViewport}
          dailyChartPoints={dailyChartPoints}
          dailyChartLabels={dailyChartLabels}
          totalValue={portfolioValue ?? 0}
        />

        <PortfolioMainSection
          activeTab={portfolioMainTab}
          onTabChange={setPortfolioMainTab}
          collectiblesPanel={
            <PortfolioHoldingsSection
              assetsSectionLoading={assetsSectionLoading}
              assetRows={visibleAssetRows}
              metadataByTokenId={metadataByTokenId}
              tokenToCollectionKey={tokenToCollectionKey}
              highestBidByCollectionKey={highestBidByCollectionKey}
              costBasisByTokenId={costBasisByTokenId}
              valuesPending={valuesPending}
              canEditCostBasis={Boolean(signerAddress)}
              onSaveCostBasis={saveCostBasis}
              savingCostBasisTokenId={savingCostBasisTokenId}
              onOpenToken={(tokenId) => {
                const ck = tokenToCollectionKey[tokenId];
                if (ck) {
                  router.push(
                    `/marketplace/collections/${encodeURIComponent(ck)}?listing=${tokenId}`,
                  );
                } else {
                  router.push(`/marketplace/${tokenId}`);
                }
              }}
              onSetPrice={openPortfolioSetPriceModal}
            />
          }
          bidsPanel={
            <PortfolioCollectionBidsSection
              loading={bidsSectionLoading}
              metaLoading={myBids.collectionMetaLoading}
              activeBids={myBids.activeBids}
              collectionMetaByKey={myBids.collectionMetaByKey}
              statsByCollectionKey={statsByCollectionKey}
              cancellingHash={bidActions.cancellingHash}
              openingChangeHash={bidActions.openingChangeHash}
              onCancel={(hash, key, label, price) => {
                bidActions.requestCancel(hash, key, label, price);
              }}
              onChangePrice={(hash, key) => {
                void bidActions.openChangeBid(hash, key);
              }}
            />
          }
          historyPanel={
            <PortfolioActivitySection
              loading={historySectionLoading}
              txRows={txRows}
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

      {cancelListingConfirm != null ? (
        <PortfolioCancelListingConfirmModal
          open
          assetTitle={cancelListingConfirm.assetTitle}
          gradeLabel={cancelListingConfirm.gradeLabel}
          listPriceUsd={cancelListingConfirm.listPriceUsd}
          pending={
            holdingActions.cancellingListingTokenId === cancelListingConfirm.tokenId
          }
          onClose={() => setCancelListingConfirm(null)}
          onConfirm={async () => {
            await holdingActions.cancelListing(
              cancelListingConfirm.tokenId,
              cancelListingConfirm.orderHash,
              cancelListingConfirm.listPriceUsd ?? undefined,
            );
            setCancelListingConfirm(null);
          }}
        />
      ) : null}

      {listModal != null ? (
        <RwaDetailListModalHost
          open
          tokenId={listModal.tokenId}
          assetTitle={listModal.assetTitle}
          collectionKey={listModal.collectionKey}
          collectionBids={
            listModal.collectionKey
              ? collectionTopBids.byCollectionKey.get(listModal.collectionKey)?.bids ??
                []
              : []
          }
          existingAskOrderHash={listModal.existingAskOrderHash}
          initialPriceUsdc={
            listModal.listedPriceUsd != null
              ? String(listModal.listedPriceUsd)
              : null
          }
          marketValueUsd={listModal.marketValueUsd}
          listedPriceUsd={listModal.listedPriceUsd}
          copyVariant="set-price"
          onRequestCancelListing={
            listModal.existingAskOrderHash
              ? () => {
                  const meta = metadataByTokenId.get(listModal.tokenId) ?? null;
                  setCancelListingConfirm({
                    tokenId: listModal.tokenId,
                    assetTitle: listModal.assetTitle,
                    gradeLabel: formatPortfolioGradeLabel(meta),
                    orderHash: listModal.existingAskOrderHash!,
                    listPriceUsd: listModal.listedPriceUsd ?? null,
                  });
                  setListModal(null);
                }
              : undefined
          }
          onMatchedSale={() => {
            void refetchActiveOrders();
            setListModal(null);
          }}
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
