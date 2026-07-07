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

/** Individual listing strip: oldest active ask first (not lowest token id). */
export function sortedTokenIdsByOldestListing(asks: Order[]): number[] {
  const rows = asks.filter(
    (o) => String(o.side ?? "ask").toLowerCase() !== "bid",
  );
  rows.sort((a, b) => {
    const ta = new Date(a.createdAt ?? 0).getTime();
    const tb = new Date(b.createdAt ?? 0).getTime();
    if (ta !== tb) return ta - tb;
    return Number(a.tokenId) - Number(b.tokenId);
  });
  const seen = new Set<number>();
  const out: number[] = [];
  for (const o of rows) {
    const id = Number(o.tokenId);
    if (!Number.isFinite(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
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
 * Desktop listing grid — fills chart column width; cards share row space evenly.
 */
export const COLLECTION_DETAIL_LISTING_CARD_MIN_PX = 168;

/** Mobile listing grid card image — full slab visible, scaled down within cell. */
export const COLLECTION_MOBILE_LISTING_IMG_CLASS =
  "mx-auto block h-auto w-full max-h-[min(38vw,136px)] max-w-[92%] object-contain object-center sm:max-h-[min(36vw,140px)]";

export const COLLECTION_DETAIL_LISTING_GRID_DESKTOP_CLASS = [
  "cd-listing-grid",
  "cd-listing-grid--desktop",
  "hidden w-full min-w-0 max-w-full lg:grid",
  "lg:grid-cols-[repeat(auto-fill,minmax(240px,1fr))] lg:gap-[18px]",
].join(" ");

export const COLLECTION_DETAIL_LISTING_ORDERBOOK_CLASS = [
  "cd-listing-orderbook",
  "flex flex-col lg:hidden",
].join(" ");

/** @deprecated use COLLECTION_DETAIL_LISTING_GRID_DESKTOP_CLASS */
export const COLLECTION_DETAIL_LISTING_GRID_CLASS = COLLECTION_DETAIL_LISTING_GRID_DESKTOP_CLASS;
