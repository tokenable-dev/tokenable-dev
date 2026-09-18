import { formatUnits } from "viem";
import type { Order } from "@/lib/core";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";

/** IPFS `metadata.name` persisted on `collection.components` at listing — matches in-grid RWA titles. */
export function listingDisplayTitleFromComp(comp: CollectionComponents): string {
  const v = comp.listingDisplayTitle;
  return typeof v === "string" ? v.trim().replace(/\s+/g, " ") : "";
}

export function bestAskByToken(asks: Order[]): Map<number, Order> {
  const m = new Map<number, Order>();
  for (const o of asks) {
    const id = Number(o.tokenId);
    if (!Number.isFinite(id)) continue;
    const prev = m.get(id);
    if (!prev) {
      m.set(id, o);
      continue;
    }
    try {
      if (BigInt(o.considerationAmount) < BigInt(prev.considerationAmount)) {
        m.set(id, o);
      }
    } catch {
      m.set(id, o);
    }
  }
  return m;
}

/**
 * Individual listings — Card.html: sorted by lowest ask.
 * One row per token (best ask wins when duplicates exist).
 */
export function sortedTokenIdsByLowestAsk(asks: Order[]): number[] {
  const byToken = bestAskByToken(
    asks.filter((o) => String(o.side ?? "ask").toLowerCase() !== "bid"),
  );
  const rows = [...byToken.entries()];
  rows.sort((a, b) => {
    try {
      const diff = BigInt(a[1].considerationAmount) - BigInt(b[1].considerationAmount);
      if (diff < BigInt(0)) return -1;
      if (diff > BigInt(0)) return 1;
    } catch {
      /* fall through */
    }
    return a[0] - b[0];
  });
  return rows.map(([id]) => id);
}

/** @deprecated Prefer {@link sortedTokenIdsByLowestAsk} (Card.html listings order). */
export function sortedTokenIdsByOldestListing(asks: Order[]): number[] {
  return sortedTokenIdsByLowestAsk(asks);
}

export function bidDisplayUsdc(b: Order): number {
  let display = Number(b.considerationAmount) / 1_000_000;
  try {
    const offer0 = b.parameters?.offer?.[0];
    if (offer0?.startAmount) display = Number(formatUnits(BigInt(offer0.startAmount), 6));
  } catch {
    /* keep considerationAmount */
  }
  return display;
}

/**
 * Desktop listing grid — always 3 columns so 1–2 cards leave empty slots
 * (do not stretch a single card across the row).
 */
export const COLLECTION_DETAIL_LISTING_CARD_MIN_PX = 200;

/** Mobile listing grid card image — full slab visible, scaled down within cell. */
export const COLLECTION_MOBILE_LISTING_IMG_CLASS =
  "mx-auto block h-auto w-full max-h-[min(38vw,136px)] max-w-[92%] object-contain object-center sm:max-h-[min(36vw,140px)]";

export const COLLECTION_DETAIL_LISTING_GRID_DESKTOP_CLASS = [
  "cd-listing-grid",
  "cd-listing-grid--desktop",
  "hidden w-full min-w-0 max-w-full lg:grid",
].join(" ");

export const COLLECTION_DETAIL_LISTING_ORDERBOOK_CLASS = [
  "cd-listing-orderbook",
  "flex flex-col lg:hidden",
].join(" ");

/** @deprecated use COLLECTION_DETAIL_LISTING_GRID_DESKTOP_CLASS */
