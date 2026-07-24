"use client";

import { useMemo, type WheelEvent } from "react";
import { useRouter } from "next/navigation";
import type { Order } from "@/lib/core";
import { formatOrderUsdc6 } from "@/lib/marketplace/collection-trading/orderUsdcFormat";
import { formatOrderBookPriceUsdc } from "@/lib/marketplace/unified-order-book";
import {
  buildRwaDetailMobileTrustView,
  type RwaDetailMetadata,
} from "@/lib/marketplace/rwa-detail/rwaDetailMetadata";
import { displayAssetNameFromMetadata } from "@/lib/marketplace/rwaDisplayTitle";
import { useCollectionRwaCardData } from "@/hooks/collection-listings/useCollectionRwaCardData";
import { useIsMobileViewport } from "@/hooks/ui";

const LISTING_IMAGE_STAGE =
  "bg-[radial-gradient(ellipse_85%_72%_at_50%_100%,rgba(58,62,74,0.5)_0%,rgba(22,24,30,0.92)_52%,#0a0b0e_100%)]";

const MAX_LAYOUT_CARDS_DESKTOP = 4;
const MAX_LAYOUT_CARDS_MOBILE = 2;
const CARD_GAP_REM = 0.625;
const CARD_SLOT_REM = 13.25;
const MODAL_HORIZONTAL_PAD_REM = 2.5;

function cardSlotBasis(layoutCount: number): string {
  const gapTotal = (layoutCount - 1) * CARD_GAP_REM;
  return `calc((100% - ${gapTotal}rem) / ${layoutCount})`;
}

function modalShellMaxWidth(layoutCount: number): string {
  const gaps = Math.max(0, layoutCount - 1) * CARD_GAP_REM;
  const cards = layoutCount * CARD_SLOT_REM;
  return `min(100%, calc(${MODAL_HORIZONTAL_PAD_REM}rem + ${cards}rem + ${gaps}rem))`;
}

function scrollRowOnWheel(e: WheelEvent<HTMLUListElement>) {
  if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
  e.currentTarget.scrollLeft += e.deltaY;
  e.preventDefault();
}

function formatTokenIdLabel(tokenId: number): string {
  if (!Number.isFinite(tokenId)) return "—";
  return `#${Math.trunc(tokenId)}`;
}

function shortenAddr(addr: string | undefined): string {
  const s = (addr ?? "").trim().toLowerCase();
  if (!s.startsWith("0x") || s.length < 12) return "—";
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

function ListingMetaLine({
  label,
  value,
  mono,
  title,
}: {
  label: string;
  value: string;
  mono?: boolean;
  title?: string;
}) {
  return (
    <p className="min-w-0 text-[10px] leading-snug text-zinc-300 sm:text-[11px]">
      <span className="text-zinc-500">{label}</span>{" "}
      <span
        className={`${mono ? "font-mono tabular-nums" : ""} break-all text-zinc-200`}
        title={title}
      >
        {value}
      </span>
    </p>
  );
}

function OrderBookAskListingCard({
  order,
  slotBasis,
  onBuy,
}: {
  order: Order;
  slotBasis: string;
  onBuy: () => void;
}) {
  const tokenId = Number(order.tokenId);
  const { metadata, imageUrl } = useCollectionRwaCardData({ tokenId });
  const meta = metadata as RwaDetailMetadata | null;
  const displayTitle = displayAssetNameFromMetadata(meta, formatTokenIdLabel(tokenId));
  const trust = buildRwaDetailMobileTrustView(meta);
  const priceLabel = formatOrderUsdc6(order.considerationAmount);
  const sellerAddr = order.offerer || order.parameters?.offerer;
  const sellerDisplay =
    order.sellerDisplayName?.trim() || shortenAddr(sellerAddr);

  return (
    <li
      className="flex min-w-0 shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-zinc-800/80 bg-black/25"
      style={{ flexBasis: slotBasis }}
    >
      <div
        className={`relative flex aspect-[2/3] w-full shrink-0 items-center justify-center overflow-hidden border-b border-zinc-800/60 ${LISTING_IMAGE_STAGE}`}
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="relative z-[1] h-full w-full max-h-full max-w-full object-contain object-center"
          />
        ) : (
          <div className="relative z-[1] text-[10px] font-medium uppercase tracking-wide text-zinc-600">
            Card
          </div>
        )}
        <div className="pointer-events-none absolute left-2 top-2 z-[2] rounded-full border border-emerald-900/60 bg-[#0f1a14]/90 px-2 py-0.5 text-[9px] font-medium text-white backdrop-blur-[2px]">
          Listed
        </div>
      </div>

      <div className="flex min-h-0 flex-col gap-1 p-1.5 sm:p-2">
        <div className="min-w-0 space-y-0.5">
          <p className="line-clamp-1 text-[11px] font-semibold leading-snug text-white sm:text-[12px]">
            {displayTitle}
          </p>
          {trust.certNumber ? (
            <ListingMetaLine label="Cert #" value={trust.certNumber} mono />
          ) : null}
          <ListingMetaLine label="Seller" value={sellerDisplay} mono title={sellerAddr} />
        </div>

        <div className="space-y-1.5 border-t border-zinc-800/60 pt-1.5">
          <p className="font-mono text-[12px] font-bold tabular-nums text-mint sm:text-[13px]">
            ${priceLabel}
            <span className="ml-1 text-[9px] font-semibold text-zinc-500">USDC</span>
          </p>
          <button
            type="button"
            onClick={onBuy}
            className="w-full rounded-lg border border-mint/35 bg-mint/[0.08] px-2 py-1.5 text-[10px] font-semibold text-mint transition-colors hover:bg-mint/[0.14] sm:text-[11px]"
          >
            Buy
          </button>
        </div>
      </div>
    </li>
  );
}

export function OrderBookAskListingModal({
  open,
  onClose,
  collectionKey,
  price,
  orders,
}: {
  open: boolean;
  onClose: () => void;
  collectionKey: string;
  price: number;
  orders: Order[];
}) {
  const router = useRouter();
  const isMobileViewport = useIsMobileViewport();

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => Number(a.tokenId) - Number(b.tokenId)),
    [orders],
  );

  const visibleSlots = isMobileViewport ? MAX_LAYOUT_CARDS_MOBILE : MAX_LAYOUT_CARDS_DESKTOP;
  const scrollable = sortedOrders.length > visibleSlots;
  const slotBasis = cardSlotBasis(visibleSlots);
  const modalMaxWidth = modalShellMaxWidth(MAX_LAYOUT_CARDS_DESKTOP);
  const centerCards = !scrollable && sortedOrders.length < visibleSlots;

  if (!open || sortedOrders.length === 0) return null;

  const listingLabel =
    sortedOrders.length === 1 ? "Listed card" : `${sortedOrders.length} listed cards`;

  const navigateToBuy = (tokenId: number) => {
    onClose();
    router.push(
      `/marketplace/collections/${encodeURIComponent(collectionKey)}?listing=${tokenId}&checkout=buy`,
    );
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 py-6">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="orderbook-ask-listing-title"
        className="relative mx-auto flex w-full max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-zinc-700/90 bg-zinc-950 shadow-xl shadow-black/50 sm:max-w-none"
        style={isMobileViewport ? undefined : { maxWidth: modalMaxWidth }}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800/90 px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="min-w-0 pr-9">
            <h2
              id="orderbook-ask-listing-title"
              className="text-base font-bold tracking-tight text-white sm:text-lg"
            >
              {listingLabel}
            </h2>
            <p className="mt-1 text-[12px] leading-snug text-zinc-400 sm:text-[13px]">
              Listed at{" "}
              <span className="font-mono tabular-nums text-zinc-200">
                {formatOrderBookPriceUsdc(price)} USDC
              </span>
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-3 top-3 rounded-lg p-2 text-base text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200 sm:right-4 sm:top-3.5"
          >
            ✕
          </button>
        </div>

        <div className="min-w-0 px-3 py-3 sm:px-5 sm:py-4">
          <ul
            className={`flex min-w-0 gap-2.5 [-webkit-overflow-scrolling:touch] ${
              scrollable
                ? "snap-x snap-mandatory overflow-x-auto overscroll-x-contain pb-1"
                : `overflow-x-hidden ${centerCards ? "justify-center" : ""}`
            }`}
            onWheel={scrollable ? scrollRowOnWheel : undefined}
          >
            {sortedOrders.map((order) => (
              <OrderBookAskListingCard
                key={order.orderHash}
                order={order}
                slotBasis={slotBasis}
                onBuy={() => navigateToBuy(Number(order.tokenId))}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
