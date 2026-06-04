import type { CollectionPlatformTapeFill } from "@/lib/core";

/** Cardhedger daily close backfill — excluded from tape/volume when present. */
export const CARDHEDGER_REFERENCE_DAILY_SALE_TYPE = "Daily reference";

/** Product-wide trade volume window (comps + platform fills). */
export const TRADE_VOLUME_30D_SEC = 30 * 86_400;

export function isVolumeCountableTapeFill(
  row: CollectionPlatformTapeFill,
): boolean {
  if (!Number.isFinite(row.priceUsdc) || row.priceUsdc <= 0) return false;
  if (
    row.source === "cardhedger" &&
    row.externalSaleType === CARDHEDGER_REFERENCE_DAILY_SALE_TYPE
  ) {
    return false;
  }
  return true;
}

export function countableTapeFills(
  trades: CollectionPlatformTapeFill[],
): CollectionPlatformTapeFill[] {
  return trades.filter(isVolumeCountableTapeFill);
}

/** Sum notional over trades in the last 30 calendar days. */
export function computeTradeVolume30dUsdc(
  trades: CollectionPlatformTapeFill[],
  sessionFillPoint: { t: number; v: number } | null | undefined,
  dedupSec: number,
  nowSec = Math.floor(Date.now() / 1000),
): number {
  const cutoff = nowSec - TRADE_VOLUME_30D_SEC;
  let sum = 0;
  for (const row of countableTapeFills(trades)) {
    if (row.t >= cutoff) sum += row.priceUsdc;
  }
  if (
    sessionFillPoint == null ||
    !Number.isFinite(sessionFillPoint.v) ||
    sessionFillPoint.v <= 0 ||
    sessionFillPoint.t < cutoff
  ) {
    return sum;
  }
  const alreadyCounted = trades.some(
    (row) =>
      row.source !== "cardhedger" &&
      Math.abs(row.priceUsdc - sessionFillPoint.v) < 1e-4 &&
      Math.abs(row.t - sessionFillPoint.t) <= dedupSec,
  );
  return alreadyCounted ? sum : sum + sessionFillPoint.v;
}

/** Optimistic session fill at top of tape (no period cap). */
export function prependSessionFillToTape(
  fills: CollectionPlatformTapeFill[],
  sessionFillPoint: { t: number; v: number } | null | undefined,
  dedupSec: number,
): CollectionPlatformTapeFill[] {
  if (
    sessionFillPoint == null ||
    !Number.isFinite(sessionFillPoint.v) ||
    sessionFillPoint.v <= 0
  ) {
    return fills;
  }

  const alreadyCounted = fills.some(
    (row) =>
      row.source !== "cardhedger" &&
      Math.abs(row.priceUsdc - sessionFillPoint.v) < 1e-4 &&
      Math.abs(row.t - sessionFillPoint.t) <= dedupSec,
  );
  if (alreadyCounted) return fills;

  const row: CollectionPlatformTapeFill = {
    t: sessionFillPoint.t,
    priceUsdc: sessionFillPoint.v,
    tokenId: "—",
    orderHash: `session-fill:${sessionFillPoint.t}:${sessionFillPoint.v}`,
    tapeAggressor: "buy",
    source: "platform",
  };
  return [row, ...fills];
}
