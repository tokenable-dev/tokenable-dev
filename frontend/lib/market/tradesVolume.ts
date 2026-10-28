import type { CollectionPlatformTapeFill } from "@/lib/core";

/** Cardhedger daily close backfill — excluded from tape/volume when present. */
export const CARDHEDGER_REFERENCE_DAILY_SALE_TYPE = "Daily reference";

/** Product-wide trade volume windows (comps + platform fills). */
export const TRADE_VOLUME_30D_SEC = 30 * 86_400;
export const TRADE_VOLUME_90D_SEC = 90 * 86_400;
export const TRADE_VOLUME_180D_SEC = 180 * 86_400;
export const TRADE_VOLUME_365D_SEC = 365 * 86_400;

/**
 * Hero volume windows (longest coverable wins: 12M → 6M → 3M → 1M).
 * UI always shows normalized 1Y Volume + Velocity 1Y. Each source is annualized
 * on its own (12M×1, 6M×2, 3M×4, 1M×12). Market cap never scaled.
 * Velocity uses CardHedger USD only.
 */
export const HERO_VELOCITY_PERIOD_WINDOWS = [
  { label: "12M", sec: TRADE_VOLUME_365D_SEC, annualizeTo1y: 1 },
  { label: "6M", sec: TRADE_VOLUME_180D_SEC, annualizeTo1y: 2 },
  { label: "3M", sec: TRADE_VOLUME_90D_SEC, annualizeTo1y: 4 },
  { label: "1M", sec: TRADE_VOLUME_30D_SEC, annualizeTo1y: 12 },
] as const;

export type HeroVelocityPeriodLabel =
  (typeof HERO_VELOCITY_PERIOD_WINDOWS)[number]["label"];

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

function sessionFillInWindow(
  sessionFillPoint: { t: number; v: number } | null | undefined,
  cutoff: number,
): boolean {
  return (
    sessionFillPoint != null &&
    Number.isFinite(sessionFillPoint.v) &&
    sessionFillPoint.v > 0 &&
    sessionFillPoint.t >= cutoff
  );
}

function sessionFillAlreadyInTape(
  trades: CollectionPlatformTapeFill[],
  sessionFillPoint: { t: number; v: number },
  dedupSec: number,
): boolean {
  return trades.some(
    (row) =>
      row.source !== "cardhedger" &&
      Math.abs(row.priceUsdc - sessionFillPoint.v) < 1e-4 &&
      Math.abs(row.t - sessionFillPoint.t) <= dedupSec,
  );
}

function medianUsd(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]!
    : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function tapePricesInWindow(
  trades: CollectionPlatformTapeFill[],
  windowSec: number,
  sessionFillPoint: { t: number; v: number } | null | undefined,
  dedupSec: number,
  sourceFilter?: CollectionPlatformTapeFill["source"][],
  nowSec = Math.floor(Date.now() / 1000),
): number[] {
  const cutoff = nowSec - windowSec;
  let rows = countableTapeFills(trades).filter((row) => row.t >= cutoff);
  if (sourceFilter?.length) {
    rows = rows.filter((row) => sourceFilter.includes(row.source));
  }
  const prices = rows.map((row) => row.priceUsdc);
  if (
    sessionFillInWindow(sessionFillPoint, cutoff) &&
    sessionFillPoint != null &&
    !sessionFillAlreadyInTape(trades, sessionFillPoint, dedupSec) &&
    (!sourceFilter?.length || sourceFilter.includes("platform"))
  ) {
    prices.push(sessionFillPoint.v);
  }
  return prices;
}

export type TapeNotionalBySource = {
  /** Tokenable fills. USDC. */
  platformUsdc: number;
  /** CardHedger comps. USD reference prices, not USDC. */
  externalUsd: number;
};

/**
 * Platform fills and CardHedger comps share a tape field named `priceUsdc`,
 * but they are different units. Callers that display a volume must keep them apart.
 */
export function computeTapeNotionalBySource(
  trades: CollectionPlatformTapeFill[],
  windowSec: number,
  sessionFillPoint: { t: number; v: number } | null | undefined,
  dedupSec: number,
  nowSec = Math.floor(Date.now() / 1000),
): TapeNotionalBySource {
  const cutoff = nowSec - windowSec;
  let platformUsdc = 0;
  let externalUsd = 0;
  for (const row of countableTapeFills(trades)) {
    if (row.t < cutoff) continue;
    if (row.source === "cardhedger") externalUsd += row.priceUsdc;
    else platformUsdc += row.priceUsdc;
  }
  if (
    sessionFillInWindow(sessionFillPoint, cutoff) &&
    sessionFillPoint != null &&
    !sessionFillAlreadyInTape(trades, sessionFillPoint, dedupSec)
  ) {
    platformUsdc += sessionFillPoint.v;
  }
  return { platformUsdc, externalUsd };
}

/**
 * Sum of both sources. Not a display amount: USDC and USD are not added for the hero.
 */
export function computeTradeVolumeUsdcInWindow(
  trades: CollectionPlatformTapeFill[],
  windowSec: number,
  sessionFillPoint: { t: number; v: number } | null | undefined,
  dedupSec: number,
  nowSec = Math.floor(Date.now() / 1000),
): number {
  const parts = computeTapeNotionalBySource(
    trades,
    windowSec,
    sessionFillPoint,
    dedupSec,
    nowSec,
  );
  return parts.platformUsdc + parts.externalUsd;
}

/** Sum notional over trades in the last 30 calendar days. */
export function computeTradeVolume30dUsdc(
  trades: CollectionPlatformTapeFill[],
  sessionFillPoint: { t: number; v: number } | null | undefined,
  dedupSec: number,
  nowSec = Math.floor(Date.now() / 1000),
): number {
  return computeTradeVolumeUsdcInWindow(
    trades,
    TRADE_VOLUME_30D_SEC,
    sessionFillPoint,
    dedupSec,
    nowSec,
  );
}

/**
 * Rolling history span: now − oldest countable fill (includes optimistic session fill).
 * Cardhedger comps cap (~100 rows) may cover far less than 365d — drives period pick.
 */
export function computeTapeCoverageSec(
  trades: CollectionPlatformTapeFill[],
  sessionFillPoint: { t: number; v: number } | null | undefined,
  dedupSec: number,
  nowSec = Math.floor(Date.now() / 1000),
): number {
  const rows = countableTapeFills(trades);
  if (rows.length === 0 && sessionFillPoint == null) return 0;

  let oldest = nowSec;
  for (const row of rows) {
    if (row.t < oldest) oldest = row.t;
  }
  if (
    sessionFillPoint != null &&
    Number.isFinite(sessionFillPoint.t) &&
    sessionFillPoint.t < oldest &&
    Number.isFinite(sessionFillPoint.v) &&
    sessionFillPoint.v > 0 &&
    !sessionFillAlreadyInTape(trades, sessionFillPoint, dedupSec)
  ) {
    oldest = sessionFillPoint.t;
  }
  if (rows.length === 0 && sessionFillPoint == null) return 0;
  return Math.max(0, nowSec - oldest);
}

/** Longest 1M / 3M / 6M / 12M window the tape history actually spans. */
export function selectHeroVelocityWindowSec(
  coverageSec: number,
): number | null {
  if (!Number.isFinite(coverageSec) || coverageSec <= 0) return null;
  for (const w of HERO_VELOCITY_PERIOD_WINDOWS) {
    if (coverageSec >= w.sec) return w.sec;
  }
  return null;
}

export function formatHeroVelocityPeriodLabel(
  windowSec: number | null | undefined,
): HeroVelocityPeriodLabel | null {
  if (windowSec == null || !Number.isFinite(windowSec)) return null;
  const match = HERO_VELOCITY_PERIOD_WINDOWS.find((w) => w.sec === windowSec);
  return match?.label ?? null;
}

export type HeroTapeActivityStats = {
  coverageSec: number;
  windowSec: number | null;
  /** Internal — longest coverable window (1M / 3M / 6M / 12M). Not shown in UI. */
  periodLabel: HeroVelocityPeriodLabel | null;
  /** Annualized Tokenable fill notional. USDC. Null when the tape has no window. */
  volume1yPlatformUsdc: number | null;
  /** Annualized CardHedger comp notional. USD. Null when the tape has no window. */
  volume1yExternalUsd: number | null;
  /**
   * External USD volume ÷ USD market cap. Null when the only volume is
   * platform USDC, because that ratio would mix units.
   */
  velocityPct: number | null;
};

/** Longest coverable window → raw volume + 1Y-normalized volume/velocity. */
export function computeHeroTapeActivityStats(
  trades: CollectionPlatformTapeFill[],
  sessionFillPoint: { t: number; v: number } | null | undefined,
  dedupSec: number,
  marketCapUsd: number | null | undefined,
  nowSec = Math.floor(Date.now() / 1000),
): HeroTapeActivityStats {
  const coverageSec = computeTapeCoverageSec(
    trades,
    sessionFillPoint,
    dedupSec,
    nowSec,
  );
  const windowSec = selectHeroVelocityWindowSec(coverageSec);
  const periodLabel = formatHeroVelocityPeriodLabel(windowSec);

  if (windowSec == null) {
    return {
      coverageSec,
      windowSec: null,
      periodLabel: null,
      volume1yPlatformUsdc: null,
      volume1yExternalUsd: null,
      velocityPct: null,
    };
  }

  const parts = computeTapeNotionalBySource(
    trades,
    windowSec,
    sessionFillPoint,
    dedupSec,
    nowSec,
  );
  const volume1yPlatformUsdc = estimate1yVolumeUsdc(parts.platformUsdc, windowSec);
  const volume1yExternalUsd = estimate1yVolumeUsdc(parts.externalUsd, windowSec);
  const velocityPct =
    parts.externalUsd > 0
      ? computeMarketVelocityPct(parts.externalUsd, marketCapUsd, { windowSec })
      : parts.platformUsdc > 0
        ? null
        : computeMarketVelocityPct(parts.externalUsd, marketCapUsd, { windowSec });

  return {
    coverageSec,
    windowSec,
    periodLabel,
    volume1yPlatformUsdc,
    volume1yExternalUsd,
    velocityPct,
  };
}

/**
 * Hero Vol 1Yr. One source renders as its own unit. Both sources stay
 * labeled and are not added. External USD uses the display-currency formatter.
 * Platform USDC uses the `$` presentation formatter.
 */
export function formatSplitHeroVolume(input: {
  platformUsdc: number | null;
  externalUsd: number | null;
  formatPlatform: (n: number) => string;
  formatExternal: (n: number) => string;
  platformLabel: string;
  externalLabel: string;
}): string {
  const platform =
    input.platformUsdc != null &&
    Number.isFinite(input.platformUsdc) &&
    input.platformUsdc > 0
      ? input.platformUsdc
      : null;
  const external =
    input.externalUsd != null &&
    Number.isFinite(input.externalUsd) &&
    input.externalUsd > 0
      ? input.externalUsd
      : null;
  if (platform != null && external != null) {
    return `${input.externalLabel} ${input.formatExternal(external)} · ${input.platformLabel} ${input.formatPlatform(platform)}`;
  }
  if (external != null) return input.formatExternal(external);
  if (platform != null) {
    return `${input.platformLabel} ${input.formatPlatform(platform)}`;
  }
  return "—";
}


/** Sum notional over trades in the last 365 calendar days. */
export function computeTradeVolume1yUsdc(
  trades: CollectionPlatformTapeFill[],
  sessionFillPoint: { t: number; v: number } | null | undefined,
  dedupSec: number,
  nowSec = Math.floor(Date.now() / 1000),
): number {
  return computeTradeVolumeUsdcInWindow(
    trades,
    TRADE_VOLUME_365D_SEC,
    sessionFillPoint,
    dedupSec,
    nowSec,
  );
}

/**
 * Card.html 30D Median — median sale USD, preferring the last 30 days.
 * If that window is empty (sparse comps, or tape shorter than 30d), expand
 * 60d → 90d → 180d → 365d → all tape so a single nearby sale still fills the metric.
 */
export function computeMedianSaleUsd30d(
  trades: CollectionPlatformTapeFill[],
  sessionFillPoint: { t: number; v: number } | null | undefined,
  dedupSec: number,
  nowSec = Math.floor(Date.now() / 1000),
): number | null {
  const windows = [
    TRADE_VOLUME_30D_SEC,
    TRADE_VOLUME_30D_SEC * 2,
    TRADE_VOLUME_90D_SEC,
    TRADE_VOLUME_180D_SEC,
    TRADE_VOLUME_365D_SEC,
    Number.MAX_SAFE_INTEGER,
  ];
  for (const windowSec of windows) {
    const cardhedger = medianUsd(
      tapePricesInWindow(
        trades,
        windowSec,
        sessionFillPoint,
        dedupSec,
        ["cardhedger"],
        nowSec,
      ),
    );
    if (cardhedger != null) return cardhedger;
    const all = medianUsd(
      tapePricesInWindow(
        trades,
        windowSec,
        sessionFillPoint,
        dedupSec,
        undefined,
        nowSec,
      ),
    );
    if (all != null) return all;
  }
  return null;
}

export function heroVelocityWindowForSec(
  windowSec: number | null | undefined,
): (typeof HERO_VELOCITY_PERIOD_WINDOWS)[number] | null {
  if (windowSec == null || !Number.isFinite(windowSec)) return null;
  return HERO_VELOCITY_PERIOD_WINDOWS.find((w) => w.sec === windowSec) ?? null;
}

/**
 * Estimate 1Y volume from the longest available shorter window.
 * 12M → ×1, 6M → ×2, 3M → ×4, 1M → ×12. Returns null when volume/window invalid.
 */
export function estimate1yVolumeUsdc(
  periodVolumeUsdc: number | null | undefined,
  windowSec: number | null | undefined,
): number | null {
  if (periodVolumeUsdc == null || !Number.isFinite(periodVolumeUsdc)) return null;
  if (periodVolumeUsdc < 0) return null;
  const window = heroVelocityWindowForSec(windowSec);
  if (!window) return null;
  return periodVolumeUsdc * window.annualizeTo1y;
}

/**
 * Gem Velocity (%) = estimated 1Y USD volume ÷ USD market cap × 100.
 * Pass CardHedger comps only. Platform USDC is not a USD amount.
 * Annualizes the period volume only — market cap is never divided or scaled.
 */
export function computeMarketVelocityPct(
  periodVolumeUsdc: number | null | undefined,
  marketCapUsd: number | null | undefined,
  opts?: { windowSec?: number | null },
): number | null {
  if (marketCapUsd == null || !Number.isFinite(marketCapUsd) || marketCapUsd <= 0) {
    return null;
  }
  const estimated1y = estimate1yVolumeUsdc(periodVolumeUsdc, opts?.windowSec);
  if (estimated1y == null) return null;
  if (estimated1y === 0) return 0;
  return (estimated1y / marketCapUsd) * 100;
}

/** @deprecated Use {@link computeMarketVelocityPct} with a 12M windowSec. */
export function computeMarketVelocity1yPct(
  volume1yUsd: number | null | undefined,
  marketCapUsd: number | null | undefined,
): number | null {
  return computeMarketVelocityPct(volume1yUsd, marketCapUsd, {
    windowSec: TRADE_VOLUME_365D_SEC,
  });
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

  if (sessionFillAlreadyInTape(fills, sessionFillPoint, dedupSec)) {
    return fills;
  }

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
