import type { Order } from "@/lib/core";

const USDC_MICROS = 1_000_000;

export function parseRwaDetailListingBuyPriceUsdc(
  considerationAmount: string | number | null | undefined,
): number | null {
  if (considerationAmount == null || String(considerationAmount).trim() === "") {
    return null;
  }
  const n = Number(considerationAmount) / USDC_MICROS;
  return Number.isFinite(n) ? n : null;
}

export function pickActiveAskListing(listing: Order | null | undefined): Order | null {
  if (!listing || listing.side === "bid") return null;
  return listing;
}
