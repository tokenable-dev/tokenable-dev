"use client";

import { useEffect, useMemo, type WheelEvent } from "react";
import { createPortal } from "react-dom";
import type { Order } from "@/lib/core";
import { TkButton } from "@/components/ds";
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

/** Desktop shell ≈3 cards wide; mobile shell ≈2. Cards scroll when count exceeds shell slots. */
const MODAL_SHELL_SLOTS_DESKTOP = 3;
const MODAL_SHELL_SLOTS_MOBILE = 2;
const CARD_GAP_REM = 0.625;
const CARD_SLOT_DESKTOP_REM = 13.25;
const CARD_SLOT_MOBILE_REM = 11.5;
const MODAL_HORIZONTAL_PAD_DESKTOP_REM = 2.5;
const MODAL_HORIZONTAL_PAD_MOBILE_REM = 1.5;

function modalShellMaxWidth(shellSlots: number, mobile: boolean): string {
  const pad = mobile ? MODAL_HORIZONTAL_PAD_MOBILE_REM : MODAL_HORIZONTAL_PAD_DESKTOP_REM;
  const slot = mobile ? CARD_SLOT_MOBILE_REM : CARD_SLOT_DESKTOP_REM;
  const gaps = Math.max(0, shellSlots - 1) * CARD_GAP_REM;
  const cards = shellSlots * slot;
  return `min(calc(100vw - 2rem), calc(${pad}rem + ${cards}rem + ${gaps}rem))`;
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
    <p className="min-w-0 text-[10px] leading-snug text-zinc-300 sm:text-xs">
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
  cardWidthRem,
  onBuy,
}: {
  order: Order;
  cardWidthRem: number;
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
      className="flex shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-zinc-800/80 bg-black/25"
      style={{
        width: `${cardWidthRem}rem`,
        flex: `0 0 ${cardWidthRem}rem`,
        maxWidth: "100%",
      }}
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
          <p className="line-clamp-1 text-xs font-semibold leading-snug text-white sm:text-[12px]">
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
          <TkButton
            type="button"
            variant="primary"
            size="sm"
            className="w-full"
            onClick={onBuy}
          >
            Buy
          </TkButton>
        </div>
      </div>
    </li>
  );
}

export function OrderBookAskListingModal({
  open,
  onClose,
  collectionKey: _collectionKey,
  price,
  orders,
  onBuyToken,
}: {
  open: boolean;
  onClose: () => void;
  /** Kept for callers / analytics context; buy no longer navigates by URL. */
  collectionKey: string;
  price: number;
  orders: Order[];
  /** Direct buy — no Confirm-purchase checkout sheet. */
  onBuyToken: (tokenId: number) => void;
}) {
  /* Match collection-detail mobile column (≤1023), not just Tailwind `sm`. */
  const isMobileViewport = useIsMobileViewport(1023);

  const sortedOrders = useMemo(
    () => [...orders].sort((a, b) => Number(a.tokenId) - Number(b.tokenId)),
    [orders],
  );

  const shellSlots = isMobileViewport
    ? MODAL_SHELL_SLOTS_MOBILE
    : MODAL_SHELL_SLOTS_DESKTOP;
  const cardWidthRem = isMobileViewport ? CARD_SLOT_MOBILE_REM : CARD_SLOT_DESKTOP_REM;
  const scrollable = sortedOrders.length > shellSlots;
  const modalMaxWidth = modalShellMaxWidth(shellSlots, isMobileViewport);
  const centerCards = !scrollable && sortedOrders.length < shellSlots;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open || sortedOrders.length === 0 || typeof document === "undefined") return null;

  const listingLabel =
    sortedOrders.length === 1 ? "Listed card" : `${sortedOrders.length} listed cards`;

  const handleBuy = (tokenId: number) => {
    onClose();
    onBuyToken(tokenId);
  };

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center px-4 py-6">
      <div
        className="absolute inset-0 bg-black/75 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="orderbook-ask-listing-title"
        className="relative mx-auto flex max-h-[min(90dvh,920px)] w-auto max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-zinc-700/90 bg-zinc-950 shadow-xl shadow-black/50"
        style={{ width: modalMaxWidth, maxWidth: modalMaxWidth }}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800/90 px-3 py-3 sm:px-5 sm:py-4">
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
          <TkButton
            type="button"
            variant="ghost"
            size="sm"
            aria-label="Close"
            onClick={onClose}
            className="absolute right-3 top-3 !min-w-0 px-2 sm:right-4 sm:top-3.5"
          >
            ✕
          </TkButton>
        </div>

        <div className="min-h-0 min-w-0 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4">
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
                cardWidthRem={cardWidthRem}
                onBuy={() => handleBuy(Number(order.tokenId))}
              />
            ))}
          </ul>
        </div>
      </div>
    </div>,
    document.body,
  );
}
