"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
  PORTFOLIO_ASSETS_PAGE_SIZE,
  useMyRedemptions,
  useRedeemSelection,
} from "@/hooks/portfolio";
import { isRedeemInFlight } from "@/lib/portfolio/redeemDraft";
import { useIsMobileViewport } from "@/hooks/ui";
import {
  PORTFOLIO_USDC_DECIMALS,
  buildPortfolioPricedRows,
} from "@/lib/portfolio/buildPortfolioPricedRows";
import { buildPortfolioTxRows } from "@/lib/portfolio/buildPortfolioTxRows";
import type { OwnedAsset } from "@/lib/portfolio/portfolioTypes";
import {
  getPortfolioActivityOrders,
  marketplaceRqPolicy,
  postRwaMetadataBatchBatched,
  postRwaVaultInfoBatch,
  putPortfolioCostBasis,
  rq,
  type Order,
  type RwaMetadata,
} from "@/lib/core";
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
  PortfolioRedeemInProgressSection,
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
  /** Align with GNB / portfolio CSS mobile breakpoint (≤1024). */
  const isMobileViewport = useIsMobileViewport(1024);
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
    if (tab === "redeem" || tab === "redemptions") {
      setPortfolioMainTab("redeem");
      return;
    }
    if (tab === "history" || tab === "transaction-history" || tab === "watchlist") {
      setPortfolioMainTab("history");
      return;
    }
    // Bare /portfolio and ?tab=assets|collectibles → My Assets
    setPortfolioMainTab("collectibles");
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
    loadedTokenIds,
    activeOrders: allOrders,
    isLoadingIds: idsLoading,
    isLoadingMetadata: assetsLoading,
    hasMoreAssets,
    isLoadingMoreAssets,
    loadMoreAssets,
    refetchActiveOrders,
  } = useUserAssets(portfolioAddress, {
    enabled: portfolioDataEnabled,
    includeOrderHistory: false,
    includeMarketPreview: false,
    retainPreviousOwner: false,
    assetPageSize: PORTFOLIO_ASSETS_PAGE_SIZE,
  });

  const chainId = activeRqChainId();
  const activityQuery = useQuery({
    queryKey: rq.portfolioActivity(portfolioAddress ?? "", chainId),
    queryFn: () => getPortfolioActivityOrders(portfolioAddress!),
    enabled: portfolioDataEnabled && Boolean(portfolioAddress?.trim()),
    staleTime: 30_000,
    refetchInterval: 60_000,
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
    // Only resolve keys for loaded pages — keeps Load more cheap.
    tokenIds: loadedTokenIds,
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
      (activityQuery.data ?? [])
        .filter((o) => o.status === "fulfilled")
        .sort(
          (a, b) =>
            new Date(b.updatedAt ?? b.createdAt).getTime() -
            new Date(a.updatedAt ?? a.createdAt).getTime(),
        ),
    [activityQuery.data],
  );

  const activityTokenIds = useMemo(() => {
    const ids = new Set<number>();
    for (const o of fulfilledOrders) {
      const tid = Number(o.tokenId);
      if (Number.isFinite(tid) && tid >= 0) ids.add(tid);
    }
    return [...ids].sort((a, b) => a - b);
  }, [fulfilledOrders]);

  const activityMetaQuery = useQuery({
    queryKey: rq.rwaMetadataBatch(
      portfolioAddress,
      activityTokenIds,
      activeRqChainId(),
    ),
    queryFn: () => postRwaMetadataBatchBatched(activityTokenIds),
    enabled: Boolean(portfolioDataEnabled && portfolioAddress && activityTokenIds.length > 0),
    staleTime: marketplaceRqPolicy.metadataBatchStaleMs,
  });

  const activityMetadataByTokenId = useMemo(() => {
    const m = new Map<number, RwaMetadata | null>(metadataByTokenId);
    for (const item of activityMetaQuery.data?.items ?? []) {
      m.set(item.tokenId, item.metadata);
    }
    return m;
  }, [metadataByTokenId, activityMetaQuery.data]);

  const vaultInfoQuery = useQuery({
    queryKey: rq.rwaVaultInfoBatch(
      portfolioAddress,
      loadedTokenIds,
      activeRqChainId(),
    ),
    queryFn: () => postRwaVaultInfoBatch(loadedTokenIds),
    enabled: Boolean(
      portfolioDataEnabled && portfolioAddress && loadedTokenIds.length > 0,
    ),
    staleTime: marketplaceRqPolicy.metadataBatchStaleMs,
  });

  const vaultLabelByTokenId = useMemo(() => {
    const m = new Map<number, string>();
    for (const item of vaultInfoQuery.data?.items ?? []) {
      const tid = Number(item.tokenId);
      if (!Number.isFinite(tid)) continue;
      m.set(tid, item.vaultLabel || "PSA Vault");
    }
    return m;
  }, [vaultInfoQuery.data]);

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
    return buildPortfolioTxRows(
      fulfilledOrders,
      portfolioAddress,
      activityMetadataByTokenId,
    );
  }, [fulfilledOrders, portfolioAddress, activityMetadataByTokenId]);

  const visibleAssetRows = useMemo(
    () => assetRows.filter((row) => !hiddenSet.has(row.tokenId)),
    [assetRows, hiddenSet],
  );

  const { redeemStatusByTokenId, redeemTrackingByTokenId, inFlightRows, completedRows, query: myRedemptionsQuery } =
    useMyRedemptions(portfolioDataEnabled);

  const ownedTokenIdSet = useMemo(() => new Set(tokenIds), [tokenIds]);

  const phantomRedeemTokenIds = useMemo(() => {
    const ids: number[] = [];
    const seen = new Set<number>();
    for (const row of inFlightRows) {
      const id = Number(row.tokenId);
      if (!Number.isFinite(id) || ownedTokenIdSet.has(id) || seen.has(id)) {
        continue;
      }
      seen.add(id);
      ids.push(id);
    }
    return ids;
  }, [inFlightRows, ownedTokenIdSet]);

  /** In-flight + completed (not in wallet) — name/image for Redeem tab. */
  const redeemMetaTokenIds = useMemo(() => {
    const ids: number[] = [];
    const seen = new Set<number>();
    for (const row of [...inFlightRows, ...completedRows]) {
      const id = Number(row.tokenId);
      if (!Number.isFinite(id) || ownedTokenIdSet.has(id) || seen.has(id)) {
        continue;
      }
      seen.add(id);
      ids.push(id);
    }
    return ids;
  }, [inFlightRows, completedRows, ownedTokenIdSet]);

  const phantomMetaQuery = useQuery({
    queryKey: [
      "rwa",
      "metadata",
      "redeem-phantom",
      redeemMetaTokenIds.join(","),
      activeRqChainId(),
    ],
    queryFn: () => postRwaMetadataBatchBatched(redeemMetaTokenIds),
    enabled: portfolioDataEnabled && redeemMetaTokenIds.length > 0,
    staleTime: marketplaceRqPolicy.metadataBatchStaleMs,
  });

  const redeemPhantomAssetRows = useMemo(() => {
    if (phantomRedeemTokenIds.length === 0) return [] as typeof assetRows;
    const byId = new Map(
      (phantomMetaQuery.data?.items ?? []).map((it) => [it.tokenId, it]),
    );
    return phantomRedeemTokenIds.map((tokenId) => {
      const it = byId.get(tokenId);
      const meta = (it?.metadata ?? null) as RwaMetadata | null;
      const name =
        meta && typeof meta.name === "string" && meta.name.trim()
          ? meta.name.trim()
          : `RWA #${tokenId}`;
      return {
        tokenId,
        name,
        imageUrl: it?.imageUrl ?? null,
        category: null,
        amount: 1,
        currentPrice: null,
        priceSource: "none" as const,
        liquidityLabel: null,
        listPriceUsd: null,
        activeListingOrderHash: null,
        setName: null,
        marketPreviewRaw: null,
      };
    });
  }, [phantomRedeemTokenIds, phantomMetaQuery.data]);

  const redeemHistoryAssetRows = useMemo(() => {
    const inFlightSet = new Set(phantomRedeemTokenIds);
    const completedIds: number[] = [];
    const seen = new Set<number>();
    for (const row of completedRows) {
      const id = Number(row.tokenId);
      if (
        !Number.isFinite(id) ||
        ownedTokenIdSet.has(id) ||
        inFlightSet.has(id) ||
        seen.has(id)
      ) {
        continue;
      }
      seen.add(id);
      completedIds.push(id);
    }
    if (completedIds.length === 0) return [] as typeof assetRows;
    const byId = new Map(
      (phantomMetaQuery.data?.items ?? []).map((it) => [it.tokenId, it]),
    );
    return completedIds.map((tokenId) => {
      const it = byId.get(tokenId);
      const meta = (it?.metadata ?? null) as RwaMetadata | null;
      const name =
        meta && typeof meta.name === "string" && meta.name.trim()
          ? meta.name.trim()
          : `RWA #${tokenId}`;
      return {
        tokenId,
        name,
        imageUrl: it?.imageUrl ?? null,
        category: null,
        amount: 1,
        currentPrice: null,
        priceSource: "none" as const,
        liquidityLabel: null,
        listPriceUsd: null,
        activeListingOrderHash: null,
        setName: null,
        marketPreviewRaw: null,
      };
    });
  }, [
    completedRows,
    phantomRedeemTokenIds,
    ownedTokenIdSet,
    phantomMetaQuery.data,
  ]);

  const redeemSelection = useRedeemSelection({
    assetRows: visibleAssetRows,
    metadataByTokenId,
    redeemStatusByTokenId,
    vaultLabelByTokenId,
  });

  const holdingsDisplayRows = useMemo(() => {
    if (redeemPhantomAssetRows.length === 0) return visibleAssetRows;
    /* Redeeming (custody) cards first so Preparing status stays visible. */
    return [...redeemPhantomAssetRows, ...visibleAssetRows];
  }, [redeemPhantomAssetRows, visibleAssetRows]);

  const holdingsMetadataByTokenId = useMemo(() => {
    const m = new Map(metadataByTokenId);
    for (const it of phantomMetaQuery.data?.items ?? []) {
      if (!m.has(it.tokenId)) {
        m.set(it.tokenId, (it.metadata ?? null) as RwaMetadata | null);
      }
    }
    return m;
  }, [metadataByTokenId, phantomMetaQuery.data]);

  const holdingsDisplayCount = useMemo(
    () =>
      Math.max(0, tokenIds.filter((id) => !hiddenSet.has(id)).length) +
      redeemPhantomAssetRows.length,
    [tokenIds, hiddenSet, redeemPhantomAssetRows.length],
  );

  const assetRowsByTokenId = useMemo(() => {
    const m = new Map<number, (typeof holdingsDisplayRows)[number]>();
    for (const row of holdingsDisplayRows) m.set(row.tokenId, row);
    for (const row of redeemHistoryAssetRows) {
      if (!m.has(row.tokenId)) m.set(row.tokenId, row);
    }
    return m;
  }, [holdingsDisplayRows, redeemHistoryAssetRows]);

  const redeemInProgressCount = inFlightRows.length;

  const openPortfolioSetPriceModal = useCallback(
    (tokenId: number) => {
      if (isRedeemInFlight(redeemStatusByTokenId.get(tokenId))) {
        window.alert("This card has a redemption in progress and cannot be listed.");
        return;
      }
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
    [
      assetRows,
      listingByTokenId,
      runSellAccessGate,
      tokenToCollectionKey,
      redeemStatusByTokenId,
    ],
  );

  const collectionTopBids = usePortfolioCollectionTopBids(
    uniqueCollectionKeys,
    portfolioDataEnabled,
  );

  const bidsByCollectionKey = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const [key, info] of collectionTopBids.byCollectionKey) {
      map.set(key, info.bids);
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
  const historySectionLoading = idsLoading || activityQuery.isLoading;

  const portfolioViewedFiredRef = useRef(false);
  useEffect(() => {
    if (!user || !wallet.hasLinkedWallet) return;
    if (assetsSectionLoading || portfolioValuePending) return;
    if (portfolioViewedFiredRef.current) return;
    portfolioViewedFiredRef.current = true;
    trackEvent("portfolio_viewed", {
      total_assets: tokenIds.filter((id) => !hiddenSet.has(id)).length,
      total_value: portfolioValue ?? 0,
    });
  }, [
    user,
    wallet.hasLinkedWallet,
    assetsSectionLoading,
    portfolioValuePending,
    tokenIds,
    hiddenSet,
    portfolioValue,
  ]);

  useEffect(() => {
    const listParam =
      searchParams.get("setprice")?.trim() ||
      searchParams.get("list")?.trim() ||
      "";
    if (!/^\d+$/.test(listParam)) {
      // Clear after URL cleanup so the same notification can reopen the modal.
      listQueryHandledRef.current = null;
      return;
    }
    if (listQueryHandledRef.current === listParam) return;
    if (!portfolioDataEnabled || assetsSectionLoading) return;

    const tokenId = Number(listParam);
    listQueryHandledRef.current = listParam;

    // Stay on My Assets after clearing the deep-link query.
    router.replace("/portfolio?tab=assets", { scroll: false });

    if (tokenIds.includes(tokenId)) {
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
    <div
      className={`portfolio-page min-h-screen min-w-0 overflow-x-clip text-white${redeemSelection.selectMode ? " portfolio-page--redeem-select" : ""}`}
    >
      <HomeTicker />
      <div className={`portfolio-page__shell tkl-wrap ${APP_MAIN_SHELL_CLASS}`}>
        {!isConnected ? (
          <p className="mb-4 rounded-xl border border-white/10 bg-white/4 px-4 py-3 text-xs text-[var(--t2)]">
            Connect your Privy wallet to manage listings and bids.
          </p>
        ) : null}

        <PortfolioSummaryBar
          holdingsCount={Math.max(
            0,
            tokenIds.filter((id) => !hiddenSet.has(id)).length,
          )}
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
          counts={{
            assets: holdingsDisplayCount,
            redeem: redeemInProgressCount,
            bids: myBids.activeBids.length,
            history: txRows.length,
          }}
          showRedeemButton={
            portfolioMainTab === "collectibles" && !redeemSelection.selectMode
          }
          onEnterRedeemSelect={redeemSelection.enterSelectMode}
          onTabChange={(tab) => {
            if (tab !== "collectibles" && redeemSelection.selectMode) {
              redeemSelection.exitSelectMode();
            }
            setPortfolioMainTab(tab);
            const next =
              tab === "bids"
                ? "bids"
                : tab === "history"
                  ? "history"
                  : tab === "redeem"
                    ? "redeem"
                    : "assets";
            const params = new URLSearchParams(searchParams.toString());
            params.set("tab", next);
            const qs = params.toString();
            router.replace(qs ? `/portfolio?${qs}` : "/portfolio", { scroll: false });
          }}
          collectiblesPanel={
            <PortfolioHoldingsSection
              assetsSectionLoading={assetsSectionLoading}
              assetRows={holdingsDisplayRows}
              metadataByTokenId={holdingsMetadataByTokenId}
              tokenToCollectionKey={tokenToCollectionKey}
              bidsByCollectionKey={bidsByCollectionKey}
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
              redeemSelectMode={redeemSelection.selectMode}
              redeemSelected={redeemSelection.selected}
              redeemEligibleIds={redeemSelection.eligibleIds}
              redeemLimitError={redeemSelection.limitError}
              redeemStatusByTokenId={redeemStatusByTokenId}
              redeemTrackingByTokenId={redeemTrackingByTokenId}
              onExitRedeemSelect={redeemSelection.exitSelectMode}
              onToggleRedeemToken={redeemSelection.toggleToken}
              onContinueRedeem={redeemSelection.goToRedeem}
              redeemMaxBatch={redeemSelection.maxBatch}
              hasMoreAssets={hasMoreAssets}
              isLoadingMoreAssets={isLoadingMoreAssets}
              onLoadMoreAssets={loadMoreAssets}
              loadedAssetCount={holdingsDisplayRows.length}
              totalAssetCount={holdingsDisplayCount}
              vaultLabelByTokenId={vaultLabelByTokenId}
            />
          }
          redeemPanel={
            <PortfolioRedeemInProgressSection
              loading={myRedemptionsQuery.isLoading}
              inFlightRows={inFlightRows}
              completedRows={completedRows}
              assetRowsByTokenId={assetRowsByTokenId}
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
          }}
          onClose={() => setListModal(null)}
          onListed={() => {
            void invalidateAfterListing(queryClient, {
              collectionKey: listModal.collectionKey,
              address: signerAddress ?? portfolioAddress,
              tokenId: listModal.tokenId,
            });
            void refetchActiveOrders();
            // Keep sheet open so DS-4 complete state can render; Done closes via onClose.
          }}
        />
      ) : null}
    </div>
  );
}
