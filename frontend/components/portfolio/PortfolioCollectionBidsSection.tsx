"use client";

import Link from "next/link";
import { useIsMobileViewport } from "@/hooks/ui";
import type { PortfolioBidCollectionMeta, PortfolioBidRow } from "@/lib/portfolio/portfolioBidTypes";

/** Visible active bid rows before vertical scroll (desktop) */
const ACTIVE_BID_VISIBLE_MAX_DESKTOP = 5;
/** Visible active bid rows before vertical scroll (mobile — taller stacked cards) */
const ACTIVE_BID_VISIBLE_MAX_MOBILE = 3;
/** Approx. one card row height on desktop */
const ACTIVE_BID_ROW_HEIGHT_DESKTOP_REM = 5.5;
/** Approx. one stacked card height on mobile */
const ACTIVE_BID_ROW_HEIGHT_MOBILE_REM = 7.75;
const ACTIVE_BID_ROW_GAP_REM = 0.5;

function activeBidsListMaxHeight(visibleMax: number, rowHeightRem: number): string {
  return `calc(${visibleMax} * ${rowHeightRem}rem + ${visibleMax - 1} * ${ACTIVE_BID_ROW_GAP_REM}rem)`;
}

function collectionHref(collectionKey: string) {
  return `/marketplace/collections/${encodeURIComponent(collectionKey)}`;
}

function formatBidDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function CollectionThumb({
  meta,
  metaLoading,
}: {
  meta?: PortfolioBidCollectionMeta;
  metaLoading: boolean;
}) {
  return (
    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-gray-800/80 bg-gray-900/80 sm:h-12 sm:w-12">
      {meta?.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={meta.imageUrl} alt="" className="h-full w-full object-cover" />
      ) : metaLoading ? (
        <div className="h-full w-full animate-pulse bg-gray-800/60" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] font-semibold uppercase tracking-wide text-gray-600">
          Bid
        </div>
      )}
    </div>
  );
}

function ActiveBidCard({
  bid,
  meta,
  metaLoading,
  busy,
  isOpening,
  isCancelling,
  onChangePrice,
  onCancel,
}: {
  bid: PortfolioBidRow;
  meta?: PortfolioBidCollectionMeta;
  metaLoading: boolean;
  busy: boolean;
  isOpening: boolean;
  isCancelling: boolean;
  onChangePrice: () => void;
  onCancel: () => void;
}) {
  const label = meta?.displayLabel ?? bid.collectionKey.replace(/^ch:/, "").slice(0, 48);

  return (
    <li className="flex min-w-0 flex-col gap-0 overflow-hidden rounded-xl border border-gray-800/80 bg-black/30 sm:flex-row sm:items-center sm:gap-3 sm:px-3.5 sm:py-3">
      <Link
        href={collectionHref(bid.collectionKey)}
        className="flex min-w-0 flex-1 items-center gap-2.5 px-3 py-3 transition-opacity hover:opacity-90 sm:gap-3 sm:p-0"
      >
        <CollectionThumb meta={meta} metaLoading={metaLoading} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-white sm:text-sm">{label}</p>
          <p className="mt-0.5 truncate text-[10px] text-gray-500 sm:text-[11px]">
            Active bid · {formatBidDate(bid.createdAt)}
          </p>
        </div>
      </Link>

      <div className="flex min-w-0 w-full flex-col gap-2.5 border-t border-gray-800/60 px-3 pb-3 pt-2.5 sm:w-auto sm:shrink-0 sm:border-0 sm:items-end sm:gap-2 sm:p-0">
        <p className="font-mono text-[13px] font-semibold tabular-nums text-mint sm:text-right sm:text-sm">
          {bid.priceLabel} USDC
        </p>
        <div className="grid min-w-0 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onChangePrice}
            className="min-w-0 rounded-lg border border-mint/35 bg-mint/[0.08] px-2.5 py-2 text-[10px] font-semibold text-mint transition-colors hover:bg-mint/[0.14] disabled:opacity-40 sm:px-3 sm:py-1.5 sm:text-[11px]"
          >
            {isOpening ? "Opening…" : "Change price"}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="min-w-0 rounded-lg border border-zinc-700/55 bg-zinc-800/35 px-2.5 py-2 text-[10px] font-semibold text-zinc-400 transition-colors hover:border-zinc-600/65 hover:bg-zinc-800/55 hover:text-zinc-200 disabled:opacity-40 sm:px-3 sm:py-1.5 sm:text-[11px]"
          >
            {isCancelling ? "Cancelling…" : "Cancel"}
          </button>
        </div>
      </div>
    </li>
  );
}

export function PortfolioCollectionBidsSection({
  embedded = false,
  loading,
  metaLoading,
  activeBids,
  collectionMetaByKey,
  cancellingHash,
  openingChangeHash,
  onCancel,
  onChangePrice,
}: {
  /** When true, omits outer card chrome (used inside PortfolioMainSection tabs). */
  embedded?: boolean;
  loading: boolean;
  metaLoading: boolean;
  activeBids: PortfolioBidRow[];
  collectionMetaByKey: Map<string, PortfolioBidCollectionMeta>;
  cancellingHash: string | null;
  openingChangeHash: string | null;
  onCancel: (orderHash: string, collectionKey: string) => void;
  onChangePrice: (orderHash: string, collectionKey: string) => void;
}) {
  const isMobileViewport = useIsMobileViewport();
  const visibleMax = isMobileViewport
    ? ACTIVE_BID_VISIBLE_MAX_MOBILE
    : ACTIVE_BID_VISIBLE_MAX_DESKTOP;
  const rowHeightRem = isMobileViewport
    ? ACTIVE_BID_ROW_HEIGHT_MOBILE_REM
    : ACTIVE_BID_ROW_HEIGHT_DESKTOP_REM;
  const scrollable = activeBids.length > visibleMax;
  const listMaxHeight = activeBidsListMaxHeight(visibleMax, rowHeightRem);

  const intro = embedded ? null : (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-sm font-bold text-white">My Collection Bids</h2>
        <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-gray-500">
          Collection-wide buy offers you placed on Tokenable. Change price or cancel active bids
          below.
        </p>
      </div>
      {!loading && activeBids.length > 0 ? (
        <span className="shrink-0 pt-0.5 text-[10px] tabular-nums text-gray-600">
          {activeBids.length}
        </span>
      ) : null}
    </div>
  );

  const content = (
    <>
      {intro}
      {loading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="h-[7.25rem] animate-pulse rounded-xl bg-gray-800/40 sm:h-[4.5rem]"
            />
          ))}
        </div>
      ) : activeBids.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-800/90 bg-black/20 px-3 py-8 text-center sm:px-4 sm:py-10">
          <p className="text-sm text-gray-400">No collection bids yet</p>
          <p className="mx-auto mt-2 max-w-md text-[10px] leading-relaxed text-gray-600 sm:text-[11px]">
            Place a bid from a collection&apos;s Buy tab — your active bids will appear here.
          </p>
          <Link
            href="/markets"
            className="mt-4 inline-flex rounded-lg border border-mint/30 bg-mint/[0.08] px-3 py-2 text-xs font-semibold text-mint hover:bg-mint/[0.12]"
          >
            Browse collections
          </Link>
        </div>
      ) : (
        <div
          className={
            scrollable
              ? "min-w-0 overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]"
              : "min-w-0"
          }
          style={
            scrollable
              ? {
                  maxHeight: isMobileViewport
                    ? `min(${listMaxHeight}, 55svh)`
                    : listMaxHeight,
                }
              : undefined
          }
        >
          <ul className="min-w-0 space-y-2">
            {activeBids.map((bid) => {
              const busy =
                cancellingHash === bid.orderHash || openingChangeHash === bid.orderHash;
              return (
                <ActiveBidCard
                  key={bid.orderHash}
                  bid={bid}
                  meta={collectionMetaByKey.get(bid.collectionKey)}
                  metaLoading={metaLoading}
                  busy={busy}
                  isOpening={openingChangeHash === bid.orderHash}
                  isCancelling={cancellingHash === bid.orderHash}
                  onChangePrice={() => onChangePrice(bid.orderHash, bid.collectionKey)}
                  onCancel={() => onCancel(bid.orderHash, bid.collectionKey)}
                />
              );
            })}
          </ul>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="min-w-0 overflow-x-hidden">{content}</div>;
  }

  return (
    <div className="mb-6 min-w-0 rounded-2xl border border-gray-800 bg-[#0b1118] p-4 sm:p-6">
      {content}
    </div>
  );
}
