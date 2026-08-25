"use client";

import { useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import { pickCollectionDetailDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";
import { readRememberedCollectionCoverImage } from "@/lib/marketplace/collectionCoverSession";
import { catalogCoverSearchFromCollection } from "@/lib/marketplace/catalogCoverSearch";
import { COLLECTION_DETAIL_SHELL_CLASS } from "@/constants/layout";
import { useCollectionCoverGallery } from "@/hooks/collection-detail/useCollectionCoverGallery";
import { useCatalogCoverUrl } from "@/hooks/media/useCatalogCoverUrl";
import { useTradeAccessGate } from "@/hooks/auth/useTradeAccessGate";
import { useBuyerListingAlert } from "@/hooks/collection-detail/useBuyerListingAlert";
import { trackEvent } from "@/lib/analytics/googleAnalytics";
import { CollectionOverviewBoard } from "@/components/marketplace/collection-overview";
import { WatchlistToggleButton } from "@/components/watchlist/WatchlistToggleButton";
import { CollectionDetailsKvCard, CollectionHeroDetailsTabs } from "@/components/marketplace/collection-hero";
import { OrderBookAskListingModal } from "@/components/marketplace/unified-order-book/OrderBookAskListingModal";
import { TradeCelebrationModal } from "@/components/marketplace/trade";
import type { CollectionDetailLoadedProps } from "@/hooks/collection-detail";
import { parseCollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import { resolveCollectionPsaPopulationPanelData } from "@/lib/market/psaPopulationByGrade";
import { CollectionPsaPopulationPanel } from "./CollectionPsaPopulationPanel";
import { CollectionDetailBreadcrumb } from "./CollectionDetailBreadcrumb";
import { useCollectionListingModal } from "@/hooks/collection-detail/useCollectionListingModal";
import { CollectionListingCheckoutModal } from "./CollectionListingCheckoutModal";
import { CollectionListingDetailModal } from "./CollectionListingDetailModal";
import { CollectionMobileTradeBar } from "./CollectionMobileTradeBar";
import { CollectionSimilarItemsSection } from "./CollectionSimilarItemsSection";
import {
  buildCollectionDetailMarketsSlots,
} from "./buildCollectionDetailMarketsSlots";
import {
  bestAskFromRows,
  bestBidFromRows,
  priceLevelKey,
  priceUsdcFromOrder,
} from "@/lib/marketplace/unified-order-book";

export function CollectionDetailLoadedView(detail: CollectionDetailLoadedProps) {
  const {
    collectionKey,
    router,
    address,
    data,
    headline,
    market,
    asks,
    collectionBids,
    listings,
    invalidateCollection,
    collectionOrderBookProps,
    tradeCelebration,
    setTradeCelebration,
    orderBookAskPicker,
    setOrderBookAskPicker,
    showOrderBook,
    setShowOrderBook,
  } = detail;

  const collection = data.collection!;
  const comp = parseCollectionComponents(collection.components);
  const rememberedCoverUrl = useMemo(
    () => readRememberedCollectionCoverImage(collectionKey),
    [collectionKey],
  );
  // Prefer detail/seed cover (e.g. pinned Collectr) over a stale session remember.
  const existingCoverUrl =
    pickCollectionDetailDisplayImageUrl(data) || rememberedCoverUrl;
  const catalogCoverSearch = useMemo(
    () =>
      catalogCoverSearchFromCollection({
        collectionKey,
        displayLabel: collection.displayLabel,
        components: collection.components,
      }).search,
    [collectionKey, collection.displayLabel, collection.components],
  );
  const { url: collectionCoverUrl } = useCatalogCoverUrl({
    existingUrl: existingCoverUrl,
    search: catalogCoverSearch,
  });

  const psaPopulationPanel = useMemo(
    () => resolveCollectionPsaPopulationPanelData(comp),
    [comp],
  );

  const coverGalleryState = useCollectionCoverGallery(collectionKey, router);
  const coverGallery = useMemo(() => {
    const g = coverGalleryState.gallery;
    if (!g) return undefined;
    return {
      entries: g.entries,
      viewingKey: g.viewingKey,
      currentIndex: g.currentIndex,
      canSwipe: g.canSwipe,
      onNext: g.onNext,
      onPrev: g.onPrev,
      open: coverGalleryState.lightboxOpen,
      onOpenChange: coverGalleryState.setLightboxOpen,
      onClose: coverGalleryState.closeLightbox,
    };
  }, [coverGalleryState]);

  const listingsBatchMetadata = useMemo(() => {
    const base = listings.batchMetadata;
    if (!collectionCoverUrl || !base?.size) return base;
    let needsOverlay = false;
    for (const entry of base.values()) {
      if (!entry.imageUrl?.trim()) {
        needsOverlay = true;
        break;
      }
    }
    if (!needsOverlay) return base;
    const next = new Map(base);
    for (const [tokenId, entry] of base) {
      if (entry.imageUrl?.trim()) continue;
      next.set(tokenId, { ...entry, imageUrl: collectionCoverUrl });
    }
    return next;
  }, [listings.batchMetadata, collectionCoverUrl]);

  const listingModal = useCollectionListingModal({
    collectionKey,
    askMap: listings.askMap,
    batchMetadata: listingsBatchMetadata,
    address,
    onInvalidate: invalidateCollection,
    onPurchaseCelebration: (kind) => setTradeCelebration(kind),
  });

  const pathname = usePathname();
  const { runTradeAccessGate } = useTradeAccessGate(pathname || `/marketplace/collections/${collectionKey}`);
  const {
    active: listingAlertActive,
    pending: listingAlertPending,
    canToggle: canToggleListingAlert,
    toggle: toggleListingAlert,
  } = useBuyerListingAlert(collectionKey);

  const handleToggleListingAlert = useCallback(() => {
    if (!canToggleListingAlert) {
      runTradeAccessGate();
      return;
    }
    trackEvent("buyer_listing_alert_toggled", {
      collection_id: collectionKey,
      active: !listingAlertActive,
      source: "orderbook_notify",
    });
    toggleListingAlert();
  }, [
    canToggleListingAlert,
    collectionKey,
    listingAlertActive,
    runTradeAccessGate,
    toggleListingAlert,
  ]);

  const orderBookPropsWithActions = useMemo(
    () => ({
      ...collectionOrderBookProps,
      onPlaceBid: listingModal.openSetLevelBid,
      onListYours: () => router.push("/sell"),
      listingAlertActive,
      listingAlertPending,
      onToggleListingAlert: handleToggleListingAlert,
    }),
    [
      collectionOrderBookProps,
      listingModal.openSetLevelBid,
      router,
      listingAlertActive,
      listingAlertPending,
      handleToggleListingAlert,
    ],
  );

  const highestBidUsd = useMemo(
    () => bestBidFromRows(collectionBids),
    [collectionBids],
  );
  const lowestAskUsd = useMemo(
    () => bestAskFromRows(asks),
    [asks],
  );

  const fulfillBuyForToken = useCallback(
    (tokenId: number) => {
      const listing = listings.askMap.get(tokenId);
      if (!listing || listing.status !== "active") return;
      const priceUsdc = priceUsdcFromOrder(listing);
      trackEvent("buy_now_clicked", {
        card_id: String(tokenId),
        price: priceUsdc > 0 ? priceUsdc : undefined,
        collection_id: collectionKey,
      });
      runTradeAccessGate(() => {
        void listingModal.buyFlow.handleFulfillAsk(listing);
      });
    },
    [
      listings.askMap,
      collectionKey,
      runTradeAccessGate,
      listingModal.buyFlow.handleFulfillAsk,
    ],
  );

  const openBuyFloor = () => {
    const active = [...listings.askMap.values()].filter((o) => o.status === "active");
    if (active.length === 0) return;
    active.sort((a, b) => {
      try {
        const pa = BigInt(a.considerationAmount);
        const pb = BigInt(b.considerationAmount);
        if (pa === pb) return Number(a.tokenId) - Number(b.tokenId);
        return pa < pb ? -1 : 1;
      } catch {
        return 0;
      }
    });
    let floorAmt: bigint;
    try {
      floorAmt = BigInt(active[0]!.considerationAmount);
    } catch {
      return;
    }
    const floorOrders = active.filter((o) => {
      try {
        return BigInt(o.considerationAmount) === floorAmt;
      } catch {
        return false;
      }
    });
    // Same floor price on multiple cards → pick which copy (Order book ask picker UX).
    if (floorOrders.length > 1) {
      const price = priceUsdcFromOrder(floorOrders[0]!);
      setOrderBookAskPicker({
        side: "ask",
        levelKey: `ask-${priceLevelKey(price)}`,
        price,
        orders: floorOrders,
      });
      return;
    }
    const floor = floorOrders[0];
    if (floor?.tokenId == null) return;
    const tid = Number(floor.tokenId);
    if (!Number.isFinite(tid)) return;
    fulfillBuyForToken(tid);
  };

  const similarPanel = (
    <CollectionSimilarItemsSection collectionKey={collectionKey} />
  );

  const renderHeroDetailsTabs = () => (
    <CollectionHeroDetailsTabs
      detailsPanel={
        <CollectionDetailsKvCard
          title={headline.collectionHeadlineDisplayTitle}
          subtitle={null}
          catalogLine={headline.detailsCatalogLine}
          rows={headline.heroDetailsKvRows}
        />
      }
      psaPanel={
        <CollectionPsaPopulationPanel
          byGrade={psaPopulationPanel.byGrade}
          totalPop={psaPopulationPanel.totalPop}
          highlightGrade={comp.gradeScore ?? "10"}
        />
      }
    />
  );

  const {
    marketsPriceMetricsStrip,
    collectionDualPriceChart,
    collectionOrderBook,
    mobileScrollPanel,
  } = buildCollectionDetailMarketsSlots({
    market,
    collectionOrderBookProps: orderBookPropsWithActions,
    coverImageUrl: collectionCoverUrl,
    headlineTitle: headline.collectionHeadlineDisplayTitle,
    headlineParts: headline.collectionHeadlineParts,
    headlineMeta: headline.collectionHeadlineMetaStrip,
    similarPanel,
    detailsPanel: renderHeroDetailsTabs(),
    highestBidUsd,
    lowestAskUsd,
    onPlaceBid: listingModal.openSetLevelBid,
    placeBidDisabled: false,
    onBuyLowestAsk: openBuyFloor,
    buyDisabled: asks.length === 0,
  });

  return (
    <div className="collection-detail-page min-h-screen min-w-0 text-white max-lg:min-h-0">
      <div
        className={`collection-detail-page__shell ${COLLECTION_DETAIL_SHELL_CLASS} flex min-h-0 flex-1 flex-col max-lg:overflow-visible lg:overflow-visible`}
      >
        <CollectionDetailBreadcrumb
          categoryLabel={headline.collectionCategoryBadge}
          trailLabel={headline.headlineSetLine ?? headline.subtitle ?? headline.collectionHeadlineDisplayTitle}
        />
        {collection.reviewStatus === "pending_review" ||
        collection.reviewStatus === "rejected" ? (
          <div
            className="mb-4 rounded-lg border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-50"
            role="status"
          >
            {collection.reviewStatus === "pending_review"
              ? "This collection is under review and is not yet listed on Markets."
              : "This collection was not approved for Markets."}
          </div>
        ) : null}
          <CollectionOverviewBoard
          title={headline.collectionWovenTitle}
          subtitle={headline.subtitle}
          headlineTitle={headline.collectionHeadlineDisplayTitle}
          headlineStructuredTitle={headline.collectionHeadlineParts}
          headlineSetLine={headline.headlineSetLine}
          headlineMetaStrip={headline.collectionHeadlineMetaStrip ?? undefined}
          headlineInfoTags={headline.headlineInfoTags ?? undefined}
          categoryBadge={headline.collectionCategoryBadge}
          gradeBadge={headline.headlineGradeBadge ?? undefined}
          populationBadge={headline.collectionPopulationBadge ?? undefined}
          headlineTitleLayout
          hideDesktopTopBarHeadline
          badgeLabel="Collection"
          imageUrl={collectionCoverUrl}
          coverOverlay={<WatchlistToggleButton collectionKey={collectionKey} size="sm" />}
          coverGallery={coverGallery}
          belowCover={renderHeroDetailsTabs()}
          metadataRows={headline.metadataRows}
          stats={[]}
          chartMetricsRow={marketsPriceMetricsStrip}
          mobileTabbedMarketUi
          mobileMarketTabs={mobileScrollPanel}
          showOrderBook={showOrderBook}
          onShowOrderBookChange={setShowOrderBook}
          marketsDockTradePanel={false}
          listingCount={asks.length}
          showListingSummary={false}
          priceChart={collectionDualPriceChart}
          orderBookNextToChart={collectionOrderBook}
          marketsBelowChart={similarPanel}
        />
      </div>

      <CollectionMobileTradeBar
        lowestAskUsd={lowestAskUsd}
        onBuy={openBuyFloor}
        onBid={listingModal.openSetLevelBid}
        buyDisabled={asks.length === 0}
        bidDisabled={false}
      />

      <TradeCelebrationModal
        open={tradeCelebration != null}
        kind={tradeCelebration ?? "purchase"}
        onClose={() => setTradeCelebration(null)}
      />

      <OrderBookAskListingModal
        open={orderBookAskPicker?.side === "ask"}
        onClose={() => setOrderBookAskPicker(null)}
        collectionKey={collection.collectionKey}
        price={orderBookAskPicker?.price ?? 0}
        orders={orderBookAskPicker?.side === "ask" ? orderBookAskPicker.orders : []}
        onBuyToken={(tokenId) => {
          setOrderBookAskPicker(null);
          fulfillBuyForToken(tokenId);
        }}
      />

      <CollectionListingDetailModal
        open={listingModal.selectedTokenId != null && listingModal.checkout == null}
        tokenId={listingModal.selectedTokenId}
        listing={listingModal.selectedListing}
        prefetchedMetadata={listingModal.selectedPrefetch?.metadata}
        prefetchedImageUrl={listingModal.selectedPrefetch?.imageUrl}
        onClose={listingModal.closeDetail}
        onBuy={() => {
          const tid = listingModal.selectedTokenId;
          if (tid == null) return;
          listingModal.closeDetail();
          fulfillBuyForToken(tid);
        }}
      />

      <CollectionListingCheckoutModal
        open={listingModal.checkout === "bid"}
        mode="bid"
        tokenId={listingModal.selectedTokenId}
        listing={listingModal.selectedListing}
        metadata={listingModal.selectedPrefetch?.metadata ?? null}
        imageUrl={listingModal.selectedPrefetch?.imageUrl ?? collectionCoverUrl}
        collectionTitle={headline.collectionHeadlineDisplayTitle}
        collectionKey={collectionKey}
        collectionBids={collectionBids}
        connectedAddress={address}
        buyBusy={listingModal.buyFlow.buyBusy}
        buyErr={listingModal.buyFlow.buyErr}
        onClose={listingModal.closeDetail}
        onFulfillBuy={() => void listingModal.buyFlow.handleFulfillAsk()}
        onBidPlaced={() => {
          invalidateCollection();
        }}
        onPurchaseFilled={() => {
          listingModal.closeDetail();
          setTradeCelebration("purchase");
          invalidateCollection();
        }}
      />
    </div>
  );
}
