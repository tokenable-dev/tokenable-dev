"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { pickCollectionDetailDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";
import { readRememberedCollectionCoverImage } from "@/lib/marketplace/collectionCoverSession";
import { COLLECTION_DETAIL_SHELL_CLASS } from "@/constants/layout";
import { useCollectionCoverGallery } from "@/hooks/collection-detail/useCollectionCoverGallery";
import { useTradeAccessGate } from "@/hooks/auth/useTradeAccessGate";
import { useBuyerListingAlert } from "@/hooks/collection-detail/useBuyerListingAlert";
import { useCollectionOwnedRwa } from "@/hooks/collection-detail/useCollectionOwnedRwa";
import { trackEvent } from "@/lib/analytics/googleAnalytics";
import { CollectionOverviewBoard } from "@/components/marketplace/collection-overview";
import { WatchlistToggleButton } from "@/components/watchlist/WatchlistToggleButton";
import { CollectionDetailsKvCard, CollectionHeroDetailsTabs } from "@/components/marketplace/collection-hero";
import { CollectionChooseCopyModal } from "./CollectionChooseCopyModal";
import { TradeCelebrationModal } from "@/components/marketplace/trade";
import type { CollectionDetailLoadedProps } from "@/hooks/collection-detail";
import { parseCollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import { resolveCollectionPsaPopulationPanelData } from "@/lib/market/psaPopulationByGrade";
import { CollectionPsaPopulationPanel } from "./CollectionPsaPopulationPanel";
import { CollectionDetailBreadcrumb } from "./CollectionDetailBreadcrumb";
import { useCollectionTradeDirectActions } from "@/hooks/collection-detail/useCollectionTradeDirectActions";
import { CollectionMobileTradeBar } from "./CollectionMobileTradeBar";
import { CollectionMobileTradeSheet } from "./CollectionMobileTradeSheet";
import { CollectionSimilarItemsSection } from "./CollectionSimilarItemsSection";
import {
  CollectionDetailTradePanel,
  type CollectionDetailTradeTab,
  type CollectionTradeCertItem,
} from "./CollectionDetailTradePanel";
import { buildCollectionDetailMarketsSlots } from "./buildCollectionDetailMarketsSlots";
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
import { formatCardDisplayLanguageLong } from "@/lib/marketplace/cardDisplayName";
import { sortActiveAsksLowestFirst } from "@/lib/seaport/criteria/collectionCriteriaBidAsk";
import type { BookRowSelection } from "@/lib/marketplace/marketplaceTradingTypes";
import type { Order } from "@/lib/core";

export function CollectionDetailLoadedView(detail: CollectionDetailLoadedProps) {
  const {
    collectionKey,
    router,
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
  const sealedBox = comp.assetKind === "sealed_box";
  const rememberedCoverUrl = useMemo(
    () => readRememberedCollectionCoverImage(collectionKey),
    [collectionKey],
  );
  // Prefer detail/seed cover (e.g. pinned Collectr) over a stale session remember.
  // No client Cardhedger search fallback — unmatched collections show no cover
  // rather than a ungated search hit (wrong character / wrong TCG).
  const collectionCoverUrl =
    pickCollectionDetailDisplayImageUrl(data) || rememberedCoverUrl;

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
    const overlayCover = collectionCoverUrl;
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
  }, [listings.batchMetadata, collectionCoverUrl]);

  const owned = useCollectionOwnedRwa(collectionKey);

  const tradeCardTitle = useMemo(
    () =>
      formatAssetDetailLine1(headline.collectionHeadlineParts, {
        grade: headline.headlineGrade ?? market.gradeAwareTierLabel,
      }) || headline.collectionHeadlineDisplayTitle,
    [
      headline.collectionHeadlineParts,
      headline.headlineGrade,
      headline.collectionHeadlineDisplayTitle,
      market.gradeAwareTierLabel,
    ],
  );

  const certNumberForToken = useCallback(
    (tokenId: number): string | null => {
      const ownedRow = owned.rows.find((row) => row.tokenId === tokenId);
      if (ownedRow?.metadata) {
        const ownedTiles = listingVerificationTiles(ownedRow.metadata);
        if (ownedTiles.certNumber && ownedTiles.certNumber !== "—") {
          return ownedTiles.certNumber;
        }
      }
      const packed = listingsBatchMetadata?.get(tokenId);
      const tiles = listingVerificationTiles(packed?.metadata ?? null);
      if (tiles.certNumber && tiles.certNumber !== "—") return tiles.certNumber;
      return null;
    },
    [listingsBatchMetadata, owned.rows],
  );

  const tradeDirect = useCollectionTradeDirectActions({
    collectionKey,
    askMap: listings.askMap,
    activeAsks: asks,
    collectionBids,
    toastCardTitle: tradeCardTitle,
    certNumberForToken,
    onInvalidate: () => {
      invalidateCollection();
      void owned.refetch();
    },
  });

  const [mobileTradeSheetOpen, setMobileTradeSheetOpen] = useState(false);
  const [tradeFocus, setTradeFocus] = useState<{
    seq: number;
    tab: CollectionDetailTradeTab;
    buyTokenId?: number | null;
    bidUsd?: number | null;
  }>({ seq: 0, tab: "buy" });

  const focusTrade = useCallback(
    (next: {
      tab: CollectionDetailTradeTab;
      buyTokenId?: number | null;
      bidUsd?: number | null;
    }) => {
      setTradeFocus((prev) => ({ ...next, seq: prev.seq + 1 }));
    },
    [],
  );

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const listingQuery = searchParams.get("listing")?.trim() ?? "";
  const checkoutQuery = searchParams.get("checkout")?.trim() ?? "";
  const tradeReturnTo =
    pathname || `/marketplace/collections/${collectionKey}`;
  const { canAccess, canTrade, walletSessionPending, runTradeAccessGate } =
    useTradeAccessGate(tradeReturnTo);
  const tradeWalletNotReady =
    canAccess && !canTrade && walletSessionPending;

  useEffect(() => {
    if (!listingQuery && !checkoutQuery) return;
    const tokenId = /^\d+$/.test(listingQuery) ? Number(listingQuery) : null;
    if (checkoutQuery === "bid") {
      focusTrade({ tab: "bid", buyTokenId: tokenId });
    } else if (checkoutQuery !== "list") {
      focusTrade({ tab: "buy", buyTokenId: tokenId });
    }
    router.replace(pathname || `/marketplace/collections/${collectionKey}`);
  }, [listingQuery, checkoutQuery, focusTrade, pathname, router, collectionKey]);
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

  /** Trade Buy — selected cert → Privy fulfill (no checkout sheet). */
  const handleTradeBuy = useCallback(
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
        void tradeDirect.buyToken(tokenId);
      });
    },
    [listings.askMap, collectionKey, runTradeAccessGate, tradeDirect.buyToken],
  );

  const handleTradeBid = useCallback(
    (priceUsd: number) => {
      if (!(priceUsd > 0)) return;
      runTradeAccessGate(() => {
        void tradeDirect.placeBid(priceUsd);
      });
    },
    [runTradeAccessGate, tradeDirect.placeBid],
  );

  /**
   * Order-book ask click: 1 copy → Privy fulfill; 2+ → choose-copy, then fulfill.
   */
  const openBuyForAskOrders = useCallback(
    (orders: Order[], priceUsd: number) => {
      const active = orders.filter((o) => o.status === "active");
      if (active.length === 0) return;
      if (active.length === 1) {
        handleTradeBuy(Number(active[0]!.tokenId));
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
    [handleTradeBuy, setOrderBookAskPicker],
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

  const highestBidUsd = useMemo(
    () => bestBidFromRows(collectionBids),
    [collectionBids],
  );
  const lowestAskUsd = useMemo(
    () => bestAskFromRows(asks),
    [asks],
  );

  const defaultMobileBidUsd = useMemo(() => {
    const top = highestBidUsd != null && highestBidUsd > 0 ? highestBidUsd : 0;
    const last =
      market.gradeAwareExternalUsd != null && market.gradeAwareExternalUsd > 0
        ? market.gradeAwareExternalUsd
        : lowestAskUsd != null && lowestAskUsd > 0
          ? lowestAskUsd
          : top;
    if (top > 0) return Math.round(top * 1.01);
    if (last > 0) return Math.round(last);
    return 0;
  }, [highestBidUsd, lowestAskUsd, market.gradeAwareExternalUsd]);

  const openMobileTradeSheet = useCallback(
    (tab: CollectionDetailTradeTab) => {
      focusTrade({
        tab,
        buyTokenId: null,
        bidUsd:
          tab === "bid" && defaultMobileBidUsd > 0 ? defaultMobileBidUsd : null,
      });
      setMobileTradeSheetOpen(true);
    },
    [focusTrade, defaultMobileBidUsd],
  );

  const orderBookPropsWithActions = useMemo(
    () => ({
      ...collectionOrderBookProps,
      onSelectLevel: handleOrderBookSelectLevel,
      onPlaceBid: () => {
        const mobile =
          typeof window !== "undefined" &&
          window.matchMedia("(max-width: 1140px)").matches;
        if (mobile) {
          openMobileTradeSheet("bid");
          return;
        }
        focusTrade({ tab: "bid" });
      },
      listingAlertActive,
      listingAlertPending,
      onToggleListingAlert: handleToggleListingAlert,
    }),
    [
      collectionOrderBookProps,
      handleOrderBookSelectLevel,
      focusTrade,
      openMobileTradeSheet,
      listingAlertActive,
      listingAlertPending,
      handleToggleListingAlert,
    ],
  );

  const closeMobileTradeSheet = useCallback(() => {
    setMobileTradeSheetOpen(false);
  }, []);

  const tradeBuyItems = useMemo((): CollectionTradeCertItem[] => {
    return sortActiveAsksLowestFirst(asks).map((order: Order) => {
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

  const tradePanel = (
    <CollectionDetailTradePanel
      buyItems={tradeBuyItems}
      lowestAskUsd={lowestAskUsd}
      highestBidUsd={highestBidUsd}
      askCount={asks.length}
      bidCount={collectionBids.length}
      onBuy={handleTradeBuy}
      onBid={handleTradeBid}
      buyDisabled={
        asks.length === 0 ||
        tradeDirect.busy != null ||
        tradeWalletNotReady
      }
      bidDisabled={tradeDirect.busy != null || tradeWalletNotReady}
      buyBusy={tradeDirect.busy === "buy"}
      bidBusy={tradeDirect.busy === "bid"}
      focusSeq={tradeFocus.seq}
      focusTab={tradeFocus.tab}
      focusBuyTokenId={tradeFocus.buyTokenId}
      focusBidUsd={tradeFocus.bidUsd}
    />
  );

  const mobileSheetTradePanel = (
    <CollectionDetailTradePanel
      buyItems={tradeBuyItems}
      lowestAskUsd={lowestAskUsd}
      highestBidUsd={highestBidUsd}
      askCount={asks.length}
      bidCount={collectionBids.length}
      onBuy={(tokenId) => {
        closeMobileTradeSheet();
        handleTradeBuy(tokenId);
      }}
      onBid={(priceUsd) => {
        closeMobileTradeSheet();
        handleTradeBid(priceUsd);
      }}
      buyDisabled={
        asks.length === 0 ||
        tradeDirect.busy != null ||
        tradeWalletNotReady
      }
      bidDisabled={tradeDirect.busy != null || tradeWalletNotReady}
      buyBusy={tradeDirect.busy === "buy"}
      bidBusy={tradeDirect.busy === "bid"}
      focusSeq={tradeFocus.seq}
      focusTab={tradeFocus.tab}
      focusBuyTokenId={tradeFocus.buyTokenId}
      focusBidUsd={tradeFocus.bidUsd}
    />
  );

  const chooseCopyLine1 = sealedBox
    ? [
        (comp.consoleName ?? "")
          .replace(/\s*&\s*/g, " and ")
          .replace(/\s+/g, " ")
          .trim(),
        (comp.productName ?? "").trim(),
      ]
        .filter(Boolean)
        .join(" · ") || headline.collectionHeadlineDisplayTitle
    : formatAssetDetailLine1(headline.collectionHeadlineParts, {
        grade: headline.headlineGrade ?? market.gradeAwareTierLabel,
      }) || headline.collectionHeadlineDisplayTitle;

  const chooseCopyMetaLine = sealedBox
    ? [
        headline.collectionHeadlineParts.year?.trim() || null,
        formatCardDisplayLanguageLong(
          headline.collectionHeadlineParts.language,
        ),
      ]
        .filter(Boolean)
        .join(" · ") || null
    : headline.collectionHeadlineMetaStrip;

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
        sealedBox ? undefined : (
        <CollectionPsaPopulationPanel
          byGrade={psaPopulationPanel.byGrade}
          totalPop={psaPopulationPanel.totalPop}
          highlightGrade={comp.gradeScore ?? "10"}
        />
        )
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
    coverComp: comp,
    coverDisplayLabel: collection.displayLabel,
    coverCollectionKey: collectionKey,
    headlineTitle: headline.collectionHeadlineDisplayTitle,
    headlineParts: headline.collectionHeadlineParts,
    headlineMeta: headline.collectionHeadlineMetaStrip,
    similarPanel,
    detailsPanel: renderHeroDetailsTabs(),
  });

  return (
    <div
      className={`collection-detail-page min-h-screen min-w-0 text-white max-[1140px]:min-h-0${
        sealedBox ? " collection-detail-page--sealed-box" : ""
      }`}
    >
      <div
        className={`collection-detail-page__shell ${COLLECTION_DETAIL_SHELL_CLASS} flex min-h-0 flex-1 flex-col max-[1140px]:overflow-visible min-[1141px]:overflow-visible`}
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
          headlineStructuredTitle={
            sealedBox ? null : headline.collectionHeadlineParts
          }
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
          coverComp={comp}
          coverDisplayLabel={collection.displayLabel}
          coverCollectionKey={collectionKey}
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
        onBuy={() => openMobileTradeSheet("buy")}
        onBid={() => openMobileTradeSheet("bid")}
        buyDisabled={tradeDirect.busy != null || tradeWalletNotReady}
        bidDisabled={tradeDirect.busy != null || tradeWalletNotReady}
      />

      <CollectionMobileTradeSheet
        open={mobileTradeSheetOpen}
        onClose={closeMobileTradeSheet}
      >
        {mobileSheetTradePanel}
      </CollectionMobileTradeSheet>

      <TradeCelebrationModal
        open={tradeCelebration != null}
        kind={tradeCelebration ?? "purchase"}
        onClose={() => setTradeCelebration(null)}
      />

      <CollectionChooseCopyModal
        open={orderBookAskPicker?.side === "ask"}
        onClose={() => setOrderBookAskPicker(null)}
        variant={sealedBox ? "box" : "card"}
        collectionTitle={chooseCopyLine1}
        itemMetaLine={chooseCopyMetaLine}
        coverImageUrl={collectionCoverUrl}
        price={orderBookAskPicker?.price ?? 0}
        orders={orderBookAskPicker?.side === "ask" ? orderBookAskPicker.orders : []}
        batchMetadata={listingsBatchMetadata}
        onConfirm={(tokenId) => {
          setOrderBookAskPicker(null);
          handleTradeBuy(tokenId);
        }}
      />
    </div>
  );
}
