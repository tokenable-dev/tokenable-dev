"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { usePrivy } from "@privy-io/react-auth";
import { useLinkedPortfolioWallet } from "@/hooks/auth/useLinkedPortfolioWallet";
import { usePortfolioWalletMismatchPrompt } from "@/hooks/auth/usePortfolioWalletMismatchPrompt";
import {
  usePortfolioDailyChart,
  usePortfolioBidActions,
  usePortfolioHoldingActions,
  usePortfolioListingCollectionKeys,
  usePortfolioActiveOrders,
  usePortfolioAssetsPage,
  usePortfolioMyBids,
  useMyRedemptions,
} from "@/hooks/portfolio";
import { isRedeemInFlight } from "@/lib/portfolio/redeemDraft";
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
  putPortfolioCostBasis,
  rq,
  type Order,
  type RwaMetadata,
} from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";
import { invalidateAfterListing } from "@/lib/core/invalidation";
import { APP_MAIN_SHELL_CLASS } from "@/constants/layout";
import { useAuthStore } from "@/store/authStore";
import { useAuthUiStore } from "@/store/authUiStore";
import { shouldDeferGuestSignIn } from "@/lib/auth/privySessionGate";
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
  PortfolioValuePanel,
} from "@/components/portfolio";
import {
  PARTNER_PORTFOLIO_PATH,
  PORTFOLIO_PATH,
  portfolioUrl,
} from "@/lib/portfolio/portfolioPaths";
import { RwaDetailListModalHost } from "@/components/marketplace/rwa-detail/modals/RwaDetailListModalHost";
import { useSellAccessGate } from "@/hooks/auth/useSellAccessGate";
import { usePageViewedEvent } from "@/hooks/analytics/usePageViewedEvent";
import { trackEvent } from "@/lib/analytics/googleAnalytics";
import { formatPortfolioGradeLabel, listPriceSheetIdentity } from "@/lib/portfolio/portfolioTableHelpers";
import { usePortfolioCollectionTopBids } from "@/hooks/portfolio/usePortfolioCollectionTopBids";
import { usePortfolioLoadPerf } from "@/hooks/portfolio/usePortfolioLoadPerf";

export type PortfolioPageVariant = "default" | "partner";

export function PortfolioPageView({
  variant = "default",
}: {
  variant?: PortfolioPageVariant;
}) {
  const isPartnerPortfolio = variant === "partner";
  const portfolioBase = isPartnerPortfolio ? PARTNER_PORTFOLIO_PATH : PORTFOLIO_PATH;

  usePageViewedEvent(isPartnerPortfolio ? "partner-portfolio" : "portfolio");
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const authInitialized = useAuthStore((s) => s.initialized);
  const authLoading = useAuthStore((s) => s.loading);
  const privySessionSyncing = useAuthStore((s) => s.privySessionSyncing);
  const { ready: privyReady, authenticated: privyAuthenticated } = usePrivy();
  const openSignIn = useAuthUiStore((s) => s.openSignIn);
  const guestSignInPromptedRef = useRef(false);
  const { runSellAccessGate } = useSellAccessGate(portfolioBase);
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
  const [portfolioMainTab, setPortfolioMainTab] = useState<PortfolioMainTab>("collectibles");
  const [savingCostBasisTokenId, setSavingCostBasisTokenId] = useState<number | null>(null);
  const [listModal, setListModal] = useState<{
    tokenId: number;
    assetTitle: string;
    headlineParts: ReturnType<typeof listPriceSheetIdentity>["parts"];
    headlineGrade: string;
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
      setPortfolioMainTab("collectibles");
      return;
    }
    if (tab === "history" || tab === "transaction-history" || tab === "watchlist") {
      setPortfolioMainTab("history");
      return;
    }
    // Bare /portfolio and ?tab=assets|collectibles → My Assets
    setPortfolioMainTab("collectibles");
  }, [searchParams, isPartnerPortfolio]);

  useEffect(() => {
    if (
      shouldDeferGuestSignIn({
        authInitialized,
        authLoading,
        user,
        privyReady,
        privyAuthenticated,
        privySessionSyncing,
      })
    ) {
      if (user) guestSignInPromptedRef.current = false;
      return;
    }
    if (guestSignInPromptedRef.current) return;
    guestSignInPromptedRef.current = true;
    const qs = searchParams.toString();
    openSignIn({
      returnTo: portfolioUrl(portfolioBase, qs || "tab=assets"),
    });
  }, [
    authInitialized,
    authLoading,
    user,
    privyReady,
    privyAuthenticated,
    privySessionSyncing,
    searchParams,
    portfolioBase,
    openSignIn,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash === "#transaction-history") {
      setPortfolioMainTab("history");
    }
  }, []);

  const { activeOrders: allOrders, refetchActiveOrders } = usePortfolioActiveOrders(
    portfolioAddress,
    portfolioDataEnabled,
  );

  const chainId = activeRqChainId();
  const activityQuery = useQuery({
    queryKey: rq.portfolioActivity(portfolioAddress ?? "", chainId),
    queryFn: () => getPortfolioActivityOrders(portfolioAddress!),
    enabled: portfolioDataEnabled && Boolean(portfolioAddress?.trim()),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const {
    redeemStatusByTokenId,
    redeemTrackingByTokenId,
    redeemCarrierDeliveredByTokenId,
    redeemPaymentBatchByTokenId,
    inFlightRows,
    completedRows,
    query: myRedemptionsQuery,
  } = useMyRedemptions(portfolioDataEnabled);

  const listingCollectionKeyByToken = usePortfolioListingCollectionKeys(
    allOrders,
    portfolioAddress,
  );

  const assetsPage = usePortfolioAssetsPage({
    address: portfolioAddress,
    enabled: portfolioDataEnabled,
    listingCollectionKeyByToken,
  });

  const {
    ownedTokenIds: tokenIds,
    loadedTokenIds,
    idsLoading,
    hasMoreAssets,
    loadMoreAssets,
    isLoadingMoreAssets,
    assets,
    tokenToCollectionKey,
    statsByCollectionKey,
    seriesByCollectionKey,
    mintPreviewByToken,
    valuesPending,
    costBasisByTokenId,
    acquiredAtByTokenId,
    hiddenSet,
  } = assetsPage;

  const metadataByTokenId = useMemo(() => {
    const m = new Map<number, OwnedAsset["metadata"]>();
    for (const a of assets) {
      m.set(a.tokenId, a.metadata);
    }
    return m;
  }, [assets]);

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
    for (const row of myRedemptionsQuery.data ?? []) {
      const tid = Number(row.tokenId);
      if (Number.isFinite(tid) && tid >= 0) ids.add(tid);
    }
    return [...ids].sort((a, b) => a - b);
  }, [fulfilledOrders, myRedemptionsQuery.data]);

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

  const activityImageByTokenId = useMemo(() => {
    const m = new Map<number, string | null>();
    for (const a of assets) {
      m.set(a.tokenId, a.imageUrl);
    }
    for (const item of activityMetaQuery.data?.items ?? []) {
      m.set(item.tokenId, item.imageUrl ?? m.get(item.tokenId) ?? null);
    }
    return m;
  }, [assets, activityMetaQuery.data]);

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
    bidsAddress: portfolioAddress,
    queryClient,
    refetchActiveOrders,
  });

  const bidsTabActive = portfolioMainTab === "bids";

  const topBidCollectionKeys = useMemo(() => {
    if (!bidsTabActive) return [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const bid of myBids.activeBids) {
      const key = bid.collectionKey?.trim();
      if (!key) continue;
      const lower = key.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      out.push(key);
    }
    return out;
  }, [bidsTabActive, myBids.activeBids]);

  const collectionTopBids = usePortfolioCollectionTopBids(
    topBidCollectionKeys,
    portfolioDataEnabled && bidsTabActive,
  );

  const highestBidByCollectionKey = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const [key, info] of collectionTopBids.byCollectionKey) {
      map.set(key, info.highestBidUsd);
      map.set(key.toLowerCase(), info.highestBidUsd);
    }
    return map;
  }, [collectionTopBids.byCollectionKey]);

  const bidsByCollectionKey = useMemo(() => {
    const map = new Map<string, Order[]>();
    for (const [key, info] of collectionTopBids.byCollectionKey) {
      map.set(key, info.bids);
    }
    return map;
  }, [collectionTopBids.byCollectionKey]);

  const txRows = useMemo(() => {
    if (!portfolioAddress) return [];
    const ownedMints: Array<{ tokenId: number; dateMs: number }> = [];
    for (const tid of tokenIds) {
      if (hiddenSet.has(tid)) continue;
      const iso = acquiredAtByTokenId.get(tid);
      if (!iso) continue;
      const dateMs = Date.parse(iso);
      if (!Number.isFinite(dateMs)) continue;
      ownedMints.push({ tokenId: tid, dateMs });
    }
    return buildPortfolioTxRows(
      fulfilledOrders,
      portfolioAddress,
      activityMetadataByTokenId,
      activityImageByTokenId,
      {
        redemptions: myRedemptionsQuery.data ?? [],
        ownedMints,
      },
    );
  }, [
    fulfilledOrders,
    portfolioAddress,
    activityMetadataByTokenId,
    activityImageByTokenId,
    tokenIds,
    hiddenSet,
    acquiredAtByTokenId,
    myRedemptionsQuery.data,
  ]);

  const visibleAssetRows = useMemo(
    () => assetRows.filter((row) => !hiddenSet.has(row.tokenId)),
    [assetRows, hiddenSet],
  );

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
        sparkline1y: [],
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
        sparkline1y: [],
      };
    });
  }, [
    completedRows,
    phantomRedeemTokenIds,
    ownedTokenIdSet,
    phantomMetaQuery.data,
  ]);

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
        const identity = listPriceSheetIdentity(
          holdingsMetadataByTokenId.get(tokenId) ??
            metadataByTokenId.get(tokenId) ??
            null,
          tokenId,
          row?.name,
        );
        setListModal({
          tokenId,
          assetTitle: identity.line1,
          headlineParts: identity.parts,
          headlineGrade: identity.grade,
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
      holdingsMetadataByTokenId,
      metadataByTokenId,
    ],
  );

  const { dailyPnlUsd, dailyPnlPct } = usePortfolioDailyChart(
    portfolioAddress,
    portfolioDataEnabled,
  );

  /** Live mark-to-market — sum of priced visible rows (not daily snapshot). */
  const livePortfolioValue = useMemo(
    () =>
      visibleAssetRows.reduce(
        (sum, row) =>
          row.currentPrice != null && Number.isFinite(row.currentPrice)
            ? sum + row.currentPrice
            : sum,
        0,
      ),
    [visibleAssetRows],
  );

  const assetsSectionLoading = idsLoading || assetsPage.isLoading;
  const portfolioValuePending = assetsSectionLoading || valuesPending;

  usePortfolioLoadPerf({
    enabled: portfolioDataEnabled,
    tokenIdsCount: tokenIds.length,
    assetsCount: assets.length,
    valuesPending,
    assetsLoading: assetsSectionLoading,
  });

  const bidsSectionLoading = myBids.loading;
  const historySectionLoading =
    idsLoading || activityQuery.isLoading || myRedemptionsQuery.isLoading;

  const portfolioViewedFiredRef = useRef(false);
  useEffect(() => {
    if (!user || !wallet.hasLinkedWallet) return;
    if (assetsSectionLoading || portfolioValuePending) return;
    if (portfolioViewedFiredRef.current) return;
    portfolioViewedFiredRef.current = true;
    trackEvent("portfolio_viewed", {
      total_assets: tokenIds.filter((id) => !hiddenSet.has(id)).length,
      total_value: livePortfolioValue,
    });
  }, [
    user,
    wallet.hasLinkedWallet,
    assetsSectionLoading,
    portfolioValuePending,
    tokenIds,
    hiddenSet,
    livePortfolioValue,
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
    router.replace(portfolioUrl(portfolioBase, "tab=assets"), { scroll: false });

    if (tokenIds.includes(tokenId)) {
      openPortfolioSetPriceModal(tokenId);
    }
  }, [
    searchParams,
    portfolioDataEnabled,
    assetsSectionLoading,
    tokenIds,
    portfolioBase,
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
      className={`portfolio-page min-h-screen min-w-0 overflow-x-clip text-white${
        isPartnerPortfolio ? " portfolio-page--partner" : ""
      }`}
    >
      <div className={`portfolio-page__shell tkl-wrap ${APP_MAIN_SHELL_CLASS}`}>
        <PortfolioValuePanel
          totalsPending={portfolioValuePending}
          totalValue={livePortfolioValue}
          dailyPnlUsd={dailyPnlUsd}
          dailyPnlPct={dailyPnlPct}
          partnerRedeemHref={isPartnerPortfolio ? "/partner/shipments" : null}
        />

        <PortfolioMainSection
          variant={isPartnerPortfolio ? "partner" : "default"}
          activeTab={portfolioMainTab}
          counts={{
            assets: holdingsDisplayCount,
            redeem: redeemInProgressCount,
            bids: myBids.activeBids.length,
            history: txRows.length,
          }}
          onTabChange={(tab) => {
            setPortfolioMainTab(tab);
            const next =
              tab === "bids"
                ? "bids"
                : tab === "history"
                  ? "history"
                  : "assets";
            const params = new URLSearchParams(searchParams.toString());
            params.set("tab", next);
            router.replace(portfolioUrl(portfolioBase, params), { scroll: false });
          }}
          collectiblesPanel={
            <PortfolioHoldingsSection
              assetsSectionLoading={assetsSectionLoading}
              assetRows={holdingsDisplayRows}
              metadataByTokenId={holdingsMetadataByTokenId}
              tokenToCollectionKey={tokenToCollectionKey}
              bidsByCollectionKey={bidsByCollectionKey}
              costBasisByTokenId={costBasisByTokenId}
              acquiredAtByTokenId={acquiredAtByTokenId}
              valuesPending={valuesPending}
              canEditCostBasis={Boolean(signerAddress)}
              onSaveCostBasis={saveCostBasis}
              savingCostBasisTokenId={savingCostBasisTokenId}
              onSetPrice={openPortfolioSetPriceModal}
              redeemStatusByTokenId={redeemStatusByTokenId}
              redeemTrackingByTokenId={redeemTrackingByTokenId}
              redeemCarrierDeliveredByTokenId={redeemCarrierDeliveredByTokenId}
              redeemPaymentBatchByTokenId={redeemPaymentBatchByTokenId}
              hasMoreAssets={hasMoreAssets}
              isLoadingMoreAssets={isLoadingMoreAssets}
              onLoadMoreAssets={loadMoreAssets}
              loadedAssetCount={holdingsDisplayRows.length}
              totalAssetCount={holdingsDisplayCount}
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
              highestBidByCollectionKey={highestBidByCollectionKey}
              cancellingHash={bidActions.cancellingHash}
              clearingOutbid={bidActions.clearingOutbid}
              onCancel={(hash, key, label, price, mode) => {
                bidActions.requestCancel(hash, key, label, price, mode);
              }}
              onClearOutbid={(items) => {
                bidActions.requestClearOutbid(items);
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

      {bidActions.cancelConfirm != null ? (
        <PortfolioCancelBidConfirmModal
          open
          confirm={bidActions.cancelConfirm}
          pending={
            bidActions.clearingOutbid ||
            (bidActions.cancelConfirm.mode !== "clear_outbid" &&
              bidActions.cancellingHash === bidActions.cancelConfirm.orderHash)
          }
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
          headlineParts={listModal.headlineParts}
          headlineGrade={listModal.headlineGrade}
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
