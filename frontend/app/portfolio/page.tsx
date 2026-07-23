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
  usePortfolioAcceptOffer,
  usePortfolioMyBids,
  useUserAssets,
} from "@/hooks/portfolio";
import { useIsMobileViewport } from "@/hooks/ui";
import {
  buildPortfolioPricedRows,
  PORTFOLIO_USDC_DECIMALS,
} from "@/lib/portfolio/buildPortfolioPricedRows";
import { buildPortfolioTxRows } from "@/lib/portfolio/buildPortfolioTxRows";
import type { OwnedAsset } from "@/lib/portfolio/portfolioTypes";
import { putPortfolioCostBasis, rq } from "@/lib/core";
import { invalidateAfterListing } from "@/lib/core/invalidation";
import { APP_MAIN_SHELL_CLASS } from "@/constants/layout";
import { HomeTicker } from "@/components/home/HomeTicker";
import { useAuthStore } from "@/store/authStore";
import { isLinkedPortfolioViewAddress } from "@/lib/auth/wallets";
import {
  PortfolioActivitySection,
  PortfolioAcceptOfferModal,
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
    refetchAll,
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

  const acceptOffer = usePortfolioAcceptOffer({
    address: signerAddress,
    canSign: wallet.canSign,
    refetchActiveOrders,
    refetchAssets: async () => {
      await refetchAll();
    },
  });
  const {
    resolveAndOpen: resolveAcceptOffer,
    deepLinkHandledRef: acceptDeepLinkRef,
  } = acceptOffer;

  const txRows = useMemo(() => {
    if (!portfolioAddress) return [];
    return buildPortfolioTxRows(fulfilledOrders, portfolioAddress, assets);
  }, [fulfilledOrders, portfolioAddress, assets]);

  const visibleAssetRows = useMemo(
    () => assetRows.filter((row) => !hiddenSet.has(row.tokenId)),
    [assetRows, hiddenSet],
  );

  const openPortfolioListModal = useCallback(
    (tokenId: number) => {
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

  useEffect(() => {
    const acceptBid = searchParams.get("acceptBid")?.trim() ?? "";
    const tokenParam = searchParams.get("tokenId")?.trim() ?? "";
    const askHash = searchParams.get("askHash")?.trim() || null;
    if (!acceptBid || !/^\d+$/.test(tokenParam)) return;
    const key = `${acceptBid}:${tokenParam}:${askHash ?? ""}`;
    if (acceptDeepLinkRef.current === key) return;
    if (!portfolioDataEnabled || assetsSectionLoading) return;

    const tokenId = Number(tokenParam);
    acceptDeepLinkRef.current = key;
    router.replace("/portfolio", { scroll: false });
    setPortfolioMainTab("collectibles");

    const row = assetRows.find((r) => r.tokenId === tokenId);
    void resolveAcceptOffer({
      bidOrderHash: acceptBid,
      tokenId,
      askOrderHash: askHash,
      assetTitle: row?.name,
    }).catch((e) => {
      window.alert(
        e instanceof Error ? e.message : "Could not open accept-offer flow",
      );
    });
  }, [
    searchParams,
    portfolioDataEnabled,
    assetsSectionLoading,
    router,
    resolveAcceptOffer,
    acceptDeepLinkRef,
    assetRows,
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
              seriesByCollectionKey={seriesByCollectionKey}
              costBasisByTokenId={costBasisByTokenId}
              valuesPending={valuesPending}
              canEditCostBasis={Boolean(signerAddress)}
              onSaveCostBasis={saveCostBasis}
              savingCostBasisTokenId={savingCostBasisTokenId}
              cancellingListingTokenId={holdingActions.cancellingListingTokenId}
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
              onChangeListing={openPortfolioListModal}
              onCancelListing={(tokenId, orderHash) => {
                const priceUsd = listingByTokenId.get(tokenId)?.priceUsd;
                void holdingActions.cancelListing(tokenId, orderHash, priceUsd);
              }}
              onSellNow={openPortfolioListModal}
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

      {acceptOffer.modal != null ? (
        <PortfolioAcceptOfferModal
          open
          assetTitle={acceptOffer.modal.assetTitle}
          bid={acceptOffer.modal.bid}
          listing={acceptOffer.modal.listing}
          pending={acceptOffer.pending}
          preflightPending={acceptOffer.preflightPending}
          buyerReady={acceptOffer.buyerReady}
          error={acceptOffer.error}
          onClose={acceptOffer.closeModal}
          onConfirm={() => void acceptOffer.confirmAccept()}
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
