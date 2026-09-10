"use client";

import { useCallback, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { pickCollectionDetailDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";
import { readRememberedCollectionCoverImage } from "@/lib/marketplace/collectionCoverSession";
import { catalogCoverSearchFromCollection } from "@/lib/marketplace/catalogCoverSearch";
import { COLLECTION_DETAIL_SHELL_CLASS } from "@/constants/layout";
import { useCollectionCoverGallery } from "@/hooks/collection-detail/useCollectionCoverGallery";
import { useCatalogCoverUrl } from "@/hooks/media/useCatalogCoverUrl";
import { useTradeAccessGate } from "@/hooks/auth/useTradeAccessGate";
import { useBuyerListingAlert } from "@/hooks/collection-detail/useBuyerListingAlert";
import { useCollectionOwnedRwa } from "@/hooks/collection-detail/useCollectionOwnedRwa";
import { trackEvent } from "@/lib/analytics/googleAnalytics";
import { CollectionOverviewBoard } from "@/components/marketplace/collection-overview";
import { WatchlistToggleButton } from "@/components/watchlist/WatchlistToggleButton";
import { CollectionDetailsKvCard, CollectionHeroDetailsTabs } from "@/components/marketplace/collection-hero";
import { CollectionChooseCopyModal } from "./CollectionChooseCopyModal";
import { CollectionChooseOwnedModal } from "./CollectionChooseOwnedModal";
import { CollectionListConfirmModal } from "./CollectionListConfirmModal";
import { TradeCelebrationModal } from "@/components/marketplace/trade";
import type { CollectionDetailLoadedProps } from "@/hooks/collection-detail";
import { parseCollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import { resolveCollectionPsaPopulationPanelData } from "@/lib/market/psaPopulationByGrade";
import { CollectionPsaPopulationPanel } from "./CollectionPsaPopulationPanel";
import { CollectionDetailBreadcrumb } from "./CollectionDetailBreadcrumb";
import { useCollectionListingModal } from "@/hooks/collection-detail/useCollectionListingModal";
import { CollectionListingCheckoutModal } from "./CollectionListingCheckoutModal";
import { CollectionMobileTradeBar } from "./CollectionMobileTradeBar";
import { CollectionSimilarItemsSection } from "./CollectionSimilarItemsSection";
import { CollectionDetailTradePanel } from "./CollectionDetailTradePanel";
import type { CollectionTradeCertItem } from "./CollectionDetailTradePanel";
import {
  buildCollectionDetailMarketsSlots,
} from "./buildCollectionDetailMarketsSlots";
import {
  bestAskFromRows,
  bestBidFromRows,
  priceLevelKey,
  priceUsdcFromOrder,
} from "@/lib/marketplace/unified-order-book";
import {
  listingVerificationTiles,
  listingVaultBadge,
} from "@/lib/marketplace/collectionListingModalHelpers";
import { formatAssetDetailLine1 } from "@/lib/marketplace/assetDetailHeadline";
import type { BookRowSelection } from "@/lib/marketplace/marketplaceTradingTypes";
import type { Order } from "@/lib/core";

const ListRwaModal = dynamic(
  () =>
    import("@/components/marketplace/list-rwa/ListRwaModal").then((m) => ({
      default: m.ListRwaModal,
    })),
  { ssr: false },
);

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
    const overlayCover = existingCoverUrl || collectionCoverUrl;
    if (!overlayCover || !base?.size) return base;
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
      next.set(tokenId, { ...entry, imageUrl: overlayCover });
    }
    return next;
  }, [listings.batchMetadata, existingCoverUrl, collectionCoverUrl]);

  const listingModal = useCollectionListingModal({
    collectionKey,
    askMap: listings.askMap,
    batchMetadata: listingsBatchMetadata,
    address,
    onInvalidate: invalidateCollection,
  });

  const owned = useCollectionOwnedRwa(collectionKey);
  const [bidPresetUsd, setBidPresetUsd] = useState<number | null>(null);
  const [listPricePreset, setListPricePreset] = useState<string | null>(null);
  const [listTokenId, setListTokenId] = useState<number | null>(null);
  const [chooseOwnedOpen, setChooseOwnedOpen] = useState(false);
  /** Card.html `#tk-bidconf` — confirm list from trade Sell (price already set). */
  const [listConfirmOpen, setListConfirmOpen] = useState(false);

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

  const openBuyCheckoutForToken = useCallback(
    (tokenId: number) => {
      const listing = listings.askMap.get(tokenId);
      if (!listing || listing.status !== "active") return;
      const priceUsdc = priceUsdcFromOrder(listing);
      trackEvent("buy_now_clicked", {
        card_id: String(tokenId),
        price: priceUsdc > 0 ? priceUsdc : undefined,
        collection_id: collectionKey,
      });
      listingModal.openListing(tokenId, "buy");
    },
    [listings.askMap, collectionKey, listingModal.openListing],
  );

  /**
   * Card.html `tkBuy`: one ask at the price → checkout; 2+ → `#tk-choose`.
   */
  const openBuyForAskOrders = useCallback(
    (orders: Order[], priceUsd: number) => {
      const active = orders.filter((o) => o.status === "active");
      if (active.length === 0) return;
      if (active.length === 1) {
        openBuyCheckoutForToken(Number(active[0]!.tokenId));
        return;
      }
      const price = priceUsd > 0 ? priceUsd : priceUsdcFromOrder(active[0]!);
      setOrderBookAskPicker({
        side: "ask",
        levelKey: `ask-${priceLevelKey(price)}`,
        price,
        orders: active,
      });
    },
    [openBuyCheckoutForToken, setOrderBookAskPicker],
  );

  /** Trade Buy / bid-meets-ask — group by the selected ask's price level. */
  const handleTradeBuy = useCallback(
    (tokenId: number) => {
      const listing = listings.askMap.get(tokenId);
      if (!listing || listing.status !== "active") return;
      const price = priceUsdcFromOrder(listing);
      const key = priceLevelKey(price);
      const atPrice = [...listings.askMap.values()].filter((o) => {
        if (o.status !== "active") return false;
        try {
          return priceLevelKey(priceUsdcFromOrder(o)) === key;
        } catch {
          return false;
        }
      });
      openBuyForAskOrders(atPrice, price);
    },
    [listings.askMap, openBuyForAskOrders],
  );

  const openListFlow = useCallback(
    (priceUsd: number | null, tokenId?: number | null) => {
      const preset =
        priceUsd != null && priceUsd > 0 ? String(Math.round(priceUsd)) : null;
      setListPricePreset(preset);
      setListConfirmOpen(false);
      if (tokenId != null && tokenId >= 0) {
        setListTokenId(tokenId);
        return;
      }
      const rows = owned.rows;
      if (rows.length === 0) {
        router.push("/sell");
        return;
      }
      if (rows.length === 1) {
        setListTokenId(rows[0]!.tokenId);
        return;
      }
      setChooseOwnedOpen(true);
    },
    [owned.rows, router],
  );

  const handleOrderBookSelectLevel = useCallback(
    (sel: BookRowSelection) => {
      if (sel.side === "ask" && sel.orders.length >= 1) {
        openBuyForAskOrders(sel.orders, sel.price);
        return;
      }
      collectionOrderBookProps?.onSelectLevel?.(sel);
    },
    [collectionOrderBookProps, openBuyForAskOrders],
  );

  const orderBookPropsWithActions = useMemo(
    () => ({
      ...collectionOrderBookProps,
      onSelectLevel: handleOrderBookSelectLevel,
      onPlaceBid: () => {
        setBidPresetUsd(null);
        listingModal.openSetLevelBid();
      },
      onListYours: () => {
        runTradeAccessGate(() => {
          openListFlow(null);
        });
      },
      listingAlertActive,
      listingAlertPending,
      onToggleListingAlert: handleToggleListingAlert,
    }),
    [
      collectionOrderBookProps,
      handleOrderBookSelectLevel,
      listingModal.openSetLevelBid,
      listingAlertActive,
      listingAlertPending,
      handleToggleListingAlert,
      runTradeAccessGate,
      openListFlow,
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

  const openBuyFloor = () => {
    const active = [...listings.askMap.values()].filter(
      (o) => o.status === "active",
    );
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
    if (floorOrders.length === 0) return;
    openBuyForAskOrders(floorOrders, priceUsdcFromOrder(floorOrders[0]!));
  };

  const handleTradeBid = useCallback(
    (priceUsd: number) => {
      setBidPresetUsd(priceUsd > 0 ? priceUsd : null);
      listingModal.openSetLevelBid();
    },
    [listingModal.openSetLevelBid],
  );

  const handleTradeSell = useCallback(
    (tokenId: number, priceUsd: number) => {
      runTradeAccessGate(() => {
        const preset =
          priceUsd > 0 ? String(Math.round(priceUsd)) : null;
        setListPricePreset(preset);
        setListTokenId(tokenId);
        setListConfirmOpen(true);
      });
    },
    [runTradeAccessGate],
  );

  const tradeBuyItems = useMemo((): CollectionTradeCertItem[] => {
    const active = asks.filter((o) => o.status === "active");
    const sorted = [...active].sort((a, b) => {
      try {
        const pa = BigInt(a.considerationAmount);
        const pb = BigInt(b.considerationAmount);
        if (pa === pb) return Number(a.tokenId) - Number(b.tokenId);
        return pa < pb ? -1 : 1;
      } catch {
        return 0;
      }
    });
    return sorted.map((order: Order) => {
      const tokenId = Number(order.tokenId);
      const packed = listingsBatchMetadata?.get(tokenId);
      const tiles = listingVerificationTiles(packed?.metadata ?? null);
      const vault = listingVaultBadge(order);
      const cert =
        tiles.certNumber !== "—"
          ? `Cert. ${tiles.certNumber}`
          : `Token #${tokenId}`;
      return {
        tokenId,
        label: `${cert} · ${vault.label}`,
        priceUsd: priceUsdcFromOrder(order),
      };
    });
  }, [asks, listingsBatchMetadata]);

  const tradeOwnedItems = useMemo((): CollectionTradeCertItem[] => {
    return owned.rows.map((row) => ({
      tokenId: row.tokenId,
      label: `${row.certLabel} · ${row.vaultLabel}`,
    }));
  }, [owned.rows]);

  const tradePanel = (
    <CollectionDetailTradePanel
      buyItems={tradeBuyItems}
      ownedItems={tradeOwnedItems}
      lowestAskUsd={lowestAskUsd}
      highestBidUsd={highestBidUsd}
      lastSaleUsd={market.gradeAwareExternalUsd}
      askCount={asks.length}
      bidCount={collectionBids.length}
      onBuy={handleTradeBuy}
      onBid={handleTradeBid}
      onSell={handleTradeSell}
      buyDisabled={asks.length === 0}
      sellDisabled={owned.rows.length === 0}
    />
  );

  /** Select your card — SSOT Line 1 with grade. */
  const chooseCopyLine1 =
    formatAssetDetailLine1(headline.collectionHeadlineParts, {
      grade: headline.headlineGrade ?? market.gradeAwareTierLabel,
    }) || headline.collectionHeadlineDisplayTitle;
  /** Shared omit-grade title for checkout shells that put grade on the copy line. */
  const chooseCopyTitle =
    formatAssetDetailLine1(headline.collectionHeadlineParts, { omitGrade: true }) ||
    headline.collectionHeadlineDisplayTitle;
  const checkoutGradeOnly = useMemo(() => {
    const raw =
      market.gradeAwareTierLabel?.trim() ||
      (comp.gradeScore?.trim()
        ? /^\d/.test(comp.gradeScore.trim())
          ? `PSA ${comp.gradeScore.trim()}`
          : comp.gradeScore.trim()
        : null);
    return raw || null;
  }, [comp.gradeScore, market.gradeAwareTierLabel]);
  /** Bid modal `#tkb-copy` — Card.html often shows grade + mint label. */
  const chooseCopyGradeLine = checkoutGradeOnly
    ? `${checkoutGradeOnly} · Gem Mint`
    : null;

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
  });

  return (
    <div className="collection-detail-page min-h-screen min-w-0 text-white max-lg:min-h-0">
      <div
        className={`collection-detail-page__shell ${COLLECTION_DETAIL_SHELL_CLASS} flex min-h-0 flex-1 flex-col max-lg:overflow-visible lg:overflow-visible`}
      >
        <CollectionDetailBreadcrumb
          categoryLabel={headline.collectionCategoryBadge}
          trailLabel={headline.collectionBreadcrumbTrail}
        />
        {collection.reviewStatus === "pending_review" ||
        collection.reviewStatus === "rejected" ? (
          <div
            className="mb-4 rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn"
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
          headlineGrade={headline.headlineGrade ?? undefined}
          populationBadge={headline.collectionPopulationBadge ?? undefined}
          headlineTitleLayout
          hideDesktopTopBarHeadline
          badgeLabel="Collection"
          imageUrl={collectionCoverUrl}
          coverOverlay={<WatchlistToggleButton collectionKey={collectionKey} />}
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
          tradePanel={tradePanel}
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
        onBid={() => {
          setBidPresetUsd(null);
          listingModal.openSetLevelBid();
        }}
        buyDisabled={asks.length === 0}
        bidDisabled={false}
      />

      <TradeCelebrationModal
        open={tradeCelebration != null}
        kind={tradeCelebration ?? "purchase"}
        onClose={() => setTradeCelebration(null)}
      />

      <CollectionChooseCopyModal
        open={orderBookAskPicker?.side === "ask"}
        onClose={() => setOrderBookAskPicker(null)}
        collectionTitle={chooseCopyLine1}
        itemMetaLine={headline.collectionHeadlineMetaStrip}
        coverImageUrl={collectionCoverUrl}
        price={orderBookAskPicker?.price ?? 0}
        orders={orderBookAskPicker?.side === "ask" ? orderBookAskPicker.orders : []}
        batchMetadata={listingsBatchMetadata}
        onConfirm={(tokenId) => {
          setOrderBookAskPicker(null);
          openBuyCheckoutForToken(tokenId);
        }}
      />

      <CollectionListingCheckoutModal
        open={listingModal.checkout === "buy"}
        mode="buy"
        tokenId={listingModal.selectedTokenId}
        listing={listingModal.selectedListing}
        metadata={listingModal.selectedPrefetch?.metadata ?? null}
        imageUrl={
          listingModal.selectedPrefetch?.imageUrl ?? collectionCoverUrl
        }
        collectionTitle={chooseCopyTitle}
        collectionMeta={headline.collectionHeadlineMetaStrip}
        collectionGradeLine={checkoutGradeOnly}
        collectionKey={collectionKey}
        connectedAddress={address}
        buyBusy={listingModal.buyFlow.buyBusy}
        buyErr={listingModal.buyFlow.buyErr}
        buyComplete={listingModal.buyComplete}
        onClose={listingModal.closeDetail}
        onFulfillBuy={() => {
          runTradeAccessGate(() => {
            void listingModal.buyFlow.handleFulfillAsk();
          });
        }}
      />

      <CollectionListingCheckoutModal
        open={listingModal.checkout === "bid"}
        mode="bid"
        tokenId={listingModal.selectedTokenId}
        listing={listingModal.selectedListing}
        metadata={listingModal.selectedPrefetch?.metadata ?? null}
        imageUrl={collectionCoverUrl}
        collectionTitle={chooseCopyTitle}
        collectionMeta={headline.collectionHeadlineMetaStrip}
        collectionGradeLine={chooseCopyGradeLine}
        collectionKey={collectionKey}
        collectionBids={collectionBids}
        askUsd={lowestAskUsd}
        highestBidUsd={highestBidUsd}
        initialBidUsd={bidPresetUsd}
        connectedAddress={address}
        buyBusy={listingModal.buyFlow.buyBusy}
        buyErr={listingModal.buyFlow.buyErr}
        onClose={() => {
          setBidPresetUsd(null);
          listingModal.closeDetail();
        }}
        onFulfillBuy={() => void listingModal.buyFlow.handleFulfillAsk()}
        onBidPlaced={() => {
          invalidateCollection();
        }}
        onPurchaseFilled={() => {
          invalidateCollection();
        }}
      />

      <CollectionChooseOwnedModal
        open={chooseOwnedOpen}
        onClose={() => setChooseOwnedOpen(false)}
        collectionTitle={chooseCopyTitle}
        rows={owned.rows}
        onConfirm={(tokenId) => {
          setChooseOwnedOpen(false);
          setListConfirmOpen(false);
          setListTokenId(tokenId);
        }}
      />

      {listConfirmOpen &&
      listTokenId != null &&
      listPricePreset != null &&
      Number(listPricePreset) > 0 ? (
        <CollectionListConfirmModal
          open
          tokenId={listTokenId}
          priceUsd={Number(listPricePreset)}
          imageUrl={
            owned.rows.find((r) => r.tokenId === listTokenId)?.imageUrl ??
            collectionCoverUrl
          }
          assetTitle={chooseCopyTitle}
          headlineParts={headline.collectionHeadlineParts}
          headlineGrade={headline.headlineGrade ?? market.gradeAwareTierLabel}
          headlineMeta={headline.collectionHeadlineMetaStrip}
          certLabel={
            owned.rows.find((r) => r.tokenId === listTokenId)?.certLabel ??
            `Token #${listTokenId}`
          }
          vaultLabel={
            owned.rows.find((r) => r.tokenId === listTokenId)?.vaultLabel ??
            "Tokenable Vault"
          }
          collectionKey={collectionKey}
          collectionBids={collectionBids}
          onClose={() => {
            setListConfirmOpen(false);
            setListTokenId(null);
            setListPricePreset(null);
          }}
          onListed={() => {
            setListConfirmOpen(false);
            setListTokenId(null);
            setListPricePreset(null);
            invalidateCollection();
            void owned.refetch();
          }}
          onMatchedSale={() => {
            setListConfirmOpen(false);
            setListTokenId(null);
            setListPricePreset(null);
            invalidateCollection();
            void owned.refetch();
          }}
        />
      ) : listTokenId != null ? (
        <ListRwaModal
          shell="sheet"
          tokenId={listTokenId}
          assetTitle={chooseCopyTitle}
          headlineParts={headline.collectionHeadlineParts}
          headlineGrade={headline.headlineGrade ?? market.gradeAwareTierLabel}
          collectionKey={collectionKey}
          collectionBids={collectionBids}
          initialPriceUsdc={listPricePreset}
          marketValueUsd={market.gradeAwareExternalUsd}
          copyVariant="default"
          onClose={() => {
            setListTokenId(null);
            setListPricePreset(null);
            setListConfirmOpen(false);
          }}
          onListed={() => {
            setListTokenId(null);
            setListPricePreset(null);
            setListConfirmOpen(false);
            invalidateCollection();
            void owned.refetch();
          }}
          onMatchedSale={() => {
            setListTokenId(null);
            setListPricePreset(null);
            setListConfirmOpen(false);
            invalidateCollection();
            void owned.refetch();
          }}
        />
      ) : null}
    </div>
  );
}
