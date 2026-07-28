"use client";

import { useMemo, useState } from "react";
import type { Address } from "viem";
import { pickCollectionDetailDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";
import { readRememberedCollectionCoverImage } from "@/lib/marketplace/collectionCoverSession";
import { catalogCoverSearchFromCollection } from "@/lib/marketplace/catalogCoverSearch";
import { COLLECTION_DETAIL_SHELL_CLASS } from "@/constants/layout";
import { useCollectionCoverGallery } from "@/hooks/collection-detail/useCollectionCoverGallery";
import { useCatalogCoverUrl } from "@/hooks/media/useCatalogCoverUrl";
import { CollectionOverviewBoard } from "@/components/marketplace/collection-overview";
import { AssetDetailHeadlineTitle } from "@/components/marketplace/marketplace-shared";
import { WatchlistToggleButton } from "@/components/watchlist/WatchlistToggleButton";
import { CollectionDetailsKvCard, CollectionHeroDetailsTabs } from "@/components/marketplace/collection-hero";
import { CollectionTradingTabs } from "@/components/marketplace/collection-trading";
import { OrderBookAskListingModal } from "@/components/marketplace/unified-order-book/OrderBookAskListingModal";
import { CollectionOwnedRwaListModal } from "@/components/marketplace/collection-listings";
import { TradeCelebrationModal } from "@/components/marketplace/trade";
import type { CollectionDetailLoadedProps } from "@/hooks/collection-detail";
import { parseCollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import { resolveCollectionPsaPopulationPanelData } from "@/lib/market/psaPopulationByGrade";
import { CollectionPsaPopulationPanel } from "./CollectionPsaPopulationPanel";
import { CollectionDetailBreadcrumb } from "./CollectionDetailBreadcrumb";
import { CollectionDetailListingsGrid } from "./CollectionDetailListingsGrid";
import { CollectionDetailListingsSection } from "./CollectionDetailListingsSection";
import { CollectionDetailMobileNav } from "./CollectionDetailMobileNav";
import { useCollectionListingModal } from "@/hooks/collection-detail/useCollectionListingModal";
import { CollectionListingCheckoutModal } from "./CollectionListingCheckoutModal";
import { CollectionListingDetailModal } from "./CollectionListingDetailModal";
import {
  buildCollectionDetailMarketsSlots,
} from "./buildCollectionDetailMarketsSlots";
import {
  bestAskFromRows,
  bestBidFromRows,
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
    presetPriceFromBook,
    listPricePresetUsdc,
    preferredBidOrderHash,
    collectionOrderBookProps,
    sellModalOpen,
    setSellModalOpen,
    tradeCelebration,
    setTradeCelebration,
    bookSelection,
    orderBookAskPicker,
    setOrderBookAskPicker,
    showOrderBook,
    setShowOrderBook,
    tradeFlow,
    setTradeFlow,
    tradeDockOpen,
    setTradeDockOpen,
    setSessionFillPoint,
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

  const highestBidUsd = useMemo(
    () => bestBidFromRows(collectionBids),
    [collectionBids],
  );
  const lowestAskUsd = useMemo(
    () => bestAskFromRows(asks),
    [asks],
  );
  const canPlaceSetBid = asks.length > 0;

  const collectionListingsGrid = (
    <CollectionDetailListingsGrid
      collectionKey={collectionKey}
      tokenIds={listings.tokenIds}
      askMap={listings.askMap}
      batchMetadata={listingsBatchMetadata}
      address={address as Address | undefined}
      gradeLabel={headline.headlineGradeBadge ?? market.gradeAwareTierLabel}
      onOpenListing={listingModal.openListing}
    />
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
    collectionOrderBookProps,
    coverImageUrl: collectionCoverUrl,
    mobileListingsBody: collectionListingsGrid,
    mobileListingCount: asks.length,
    detailsPanel: renderHeroDetailsTabs(),
    highestBidUsd,
    lowestAskUsd,
    onPlaceBid: listingModal.openSetLevelBid,
    placeBidDisabled: !canPlaceSetBid,
  });

  const collectionListingsBody = (
    <CollectionDetailListingsSection
      listingCount={asks.length}
      highestBidUsd={highestBidUsd}
      lowestAskUsd={lowestAskUsd}
      onPlaceBid={listingModal.openSetLevelBid}
      placeBidDisabled={!canPlaceSetBid}
    >
      {collectionListingsGrid}
    </CollectionDetailListingsSection>
  );

  return (
    <div className="collection-detail-page min-h-screen min-w-0 overflow-x-clip text-white max-lg:min-h-0">
      <div
        className={`collection-detail-page__shell ${COLLECTION_DETAIL_SHELL_CLASS} flex min-h-0 flex-1 flex-col max-lg:overflow-visible sm:pb-20 lg:overflow-visible`}
      >
        <CollectionDetailMobileNav />
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
        {headline.collectionHeadlineDisplayTitle ? (
          <div className="cd-page-headline">
            {headline.collectionHeadlineParts ? (
              <AssetDetailHeadlineTitle
                as="h1"
                parts={headline.collectionHeadlineParts}
                className="cd-page-headline__title"
              />
            ) : (
              <h1
                className="cd-page-headline__title"
                title={headline.collectionHeadlineDisplayTitle}
              >
                {headline.collectionHeadlineDisplayTitle}
              </h1>
            )}
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
          marketsDockTradePanel
          listingCount={asks.length}
          showListingSummary={false}
          priceChart={collectionDualPriceChart}
          orderBookNextToChart={collectionOrderBook}
          tradePanel={
            <CollectionTradingTabs
              bookSelection={bookSelection}
              address={address as Address | undefined}
              onBuySuccess={() => {
                setSellModalOpen(false);
                setTradeCelebration("purchase");
                invalidateCollection();
              }}
              onOpenSellModal={() => setSellModalOpen(true)}
              collectionKey={collection.collectionKey}
              collectionLabel={headline.collectionHeadlineDisplayTitle}
              asks={asks}
              collectionBids={collectionBids}
              connectedAddress={address ?? undefined}
              onInvalidate={invalidateCollection}
              onInstantBuyFillUsdc={(usdc) =>
                setSessionFillPoint({ t: Math.floor(Date.now() / 1000), v: usdc })
              }
              onPurchaseFilled={() => {
                setSellModalOpen(false);
                setTradeCelebration("purchase");
                invalidateCollection();
              }}
              presetPriceFromBook={presetPriceFromBook}
              listingCount={asks.length}
              showSellListingCount={false}
              tradeFlow={tradeFlow}
              onTradeFlowChange={setTradeFlow}
              marketsDock
              dockOpen={tradeDockOpen}
              onDockOpenChange={setTradeDockOpen}
            />
          }
          marketsBelowChart={collectionListingsBody}
        />
      </div>

      <TradeCelebrationModal
        open={tradeCelebration != null}
        kind={tradeCelebration ?? "purchase"}
        onClose={() => setTradeCelebration(null)}
      />

      <CollectionOwnedRwaListModal
        open={sellModalOpen}
        onClose={() => setSellModalOpen(false)}
        collectionKey={collection.collectionKey}
        collectionLabel={headline.collectionHeadlineDisplayTitle}
        collectionBids={collectionBids}
        listPricePresetUsdc={listPricePresetUsdc}
        preferredBidOrderHash={preferredBidOrderHash}
        onSaleCelebration={() => setTradeCelebration("sale")}
      />

      <OrderBookAskListingModal
        open={orderBookAskPicker?.side === "ask"}
        onClose={() => setOrderBookAskPicker(null)}
        collectionKey={collection.collectionKey}
        price={orderBookAskPicker?.price ?? 0}
        orders={orderBookAskPicker?.side === "ask" ? orderBookAskPicker.orders : []}
      />

      <CollectionListingDetailModal
        open={listingModal.selectedTokenId != null && listingModal.checkout == null}
        tokenId={listingModal.selectedTokenId}
        listing={listingModal.selectedListing}
        prefetchedMetadata={listingModal.selectedPrefetch?.metadata}
        prefetchedImageUrl={listingModal.selectedPrefetch?.imageUrl}
        onClose={listingModal.closeDetail}
        onBuy={() => listingModal.setCheckout("buy")}
      />

      <CollectionListingCheckoutModal
        open={listingModal.checkout != null && listingModal.selectedTokenId != null}
        mode={listingModal.checkout ?? "buy"}
        tokenId={listingModal.selectedTokenId}
        listing={listingModal.selectedListing}
        metadata={listingModal.selectedPrefetch?.metadata ?? null}
        imageUrl={listingModal.selectedPrefetch?.imageUrl ?? null}
        collectionKey={collectionKey}
        collectionAsks={asks}
        collectionBids={collectionBids}
        connectedAddress={address}
        buyBusy={listingModal.buyFlow.buyBusy}
        buyErr={listingModal.buyFlow.buyErr}
        onClose={() => listingModal.setCheckout(null)}
        onFulfillBuy={() => void listingModal.buyFlow.handleFulfillAsk()}
        onBidPlaced={() => {
          invalidateCollection();
        }}
        onPurchaseFilled={() => {
          listingModal.setCheckout(null);
          listingModal.closeDetail();
          setTradeCelebration("purchase");
          invalidateCollection();
        }}
      />
    </div>
  );
}
