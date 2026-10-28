import type {
  CollectionMarketSeries,
  CollectionUsdPoint,
  RwaMetadata,
} from "@/lib/core";
import { filterMergedChartPointsForWindow } from "@/lib/market/collectionChartHistory";
import { formatDisplayMoney, formatUsdcAmount } from "@/lib/market/displayMoney";
import type { PortfolioCostBasisSource } from "@/lib/core/api/portfolio";
import type { AssetRow } from "@/lib/portfolio/portfolioTypes";
import {
  buildRwaAssetDetailHeadlineParts,
  cardDisplayPartsFromAssetDetail,
  formatCardDisplayHoverTitle,
  formatCardDisplayLine1,
  formatCardDisplayMeta,
  resolveRwaHeadlineGrade,
  type AssetDetailHeadlineParts,
} from "@/lib/marketplace/assetDetailHeadline";
import {
  sealedBoxHeroSetTitle,
  sealedBoxProductTypeLabel,
} from "@/lib/marketplace/buildCollectionMarketDetailCards";
import { localizeCatalogPhrase } from "@/lib/marketplace/catalogNameTranslation";
import { resolveCardDisplayLine1Collisions } from "@/lib/marketplace/cardDisplayName";
import { formatPortfolioGradeLabel } from "@/lib/portfolio/portfolioAssetMeta";

export { formatPortfolioGradeLabel, formatPortfolioGradeSubtitle } from "@/lib/portfolio/portfolioAssetMeta";

/** Redeem lists — Line 1 `{Name} · {Number} · {Grade}` (grade is never stripped). */
export function formatRedeemCardLine1FromMetadata(
  meta: RwaMetadata | null | undefined,
  fallbackName: string,
  gradeOverride?: string | null,
): string {
  if (isSealedBoxMetadata(meta)) {
    const sealed = sealedBoxHeadlineFromMetadata(meta, fallbackName);
    return sealed.line1;
  }
  const parts = buildRwaAssetDetailHeadlineParts(meta, fallbackName);
  const grade =
    gradeOverride?.trim() ||
    formatPortfolioGradeLabel(meta ?? null) ||
    resolveRwaHeadlineGrade(meta);
  return (
    formatCardDisplayLine1(cardDisplayPartsFromAssetDetail(parts, grade)) ||
    fallbackName
  );
}

export function formatRedeemCardLine1FromDraft(card: {
  name: string;
  grade: string | null;
}): string {
  const grade = card.grade?.trim() || null;
  const name = card.name.trim();
  if (grade && name.includes(grade)) return name;
  return formatCardDisplayLine1(
    cardDisplayPartsFromAssetDetail({ cardName: name }, grade),
  );
}

export type PortfolioHoldingsHeadline = {
  parts: AssetDetailHeadlineParts;
  grade: string;
  /** Table / single-line title — `{Name} · {Number} · {Grade}`. */
  line1: string;
  /** Grade-omitted title kept for collision diffs. Gallery renders `line1`. */
  nameLine: string;
  /** Year · set · variant — shown under Line 1 on table-row hover. */
  line2: string;
  hover: string;
};

function isSealedBoxMetadata(
  meta: RwaMetadata | null | undefined,
): boolean {
  return meta?.properties?.assetKind === "sealed_box";
}

function sealedBoxFieldsFromMetadata(
  meta: RwaMetadata | null | undefined,
  fallbackName: string,
): { productName: string; consoleName: string } {
  const props = (meta?.properties ?? {}) as Record<string, unknown>;
  const productFromProps =
    typeof props.productName === "string" ? props.productName.trim() : "";
  const productName =
    productFromProps ||
    (typeof meta?.name === "string" ? meta.name.trim() : "") ||
    fallbackName;
  let consoleName =
    typeof props.consoleName === "string" ? props.consoleName.trim() : "";
  if (!consoleName && meta?.attributes?.length) {
    for (const a of meta.attributes) {
      if ((a.trait_type ?? "").trim().toLowerCase() === "set") {
        const v = String(a.value ?? "").trim();
        if (v) {
          consoleName = v;
          break;
        }
      }
    }
  }
  return { productName, consoleName };
}

/** Gallery: line1 set name, grade row = product type (Booster Box). */
function sealedBoxHeadlineFromMetadata(
  meta: RwaMetadata | null | undefined,
  fallbackName: string,
): PortfolioHoldingsHeadline {
  const fields = sealedBoxFieldsFromMetadata(meta, fallbackName);
  const setTitle = localizeCatalogPhrase(sealedBoxHeroSetTitle(fields));
  const typeLabel = localizeCatalogPhrase(sealedBoxProductTypeLabel(fields));
  const parts: AssetDetailHeadlineParts = {
    year: null,
    setName: null,
    cardNumber: null,
    cardName: setTitle,
    variety: typeLabel,
    language: null,
  };
  const line1 = [setTitle, typeLabel].filter(Boolean).join(" · ") || setTitle;
  return {
    parts,
    grade: typeLabel,
    line1,
    nameLine: setTitle,
    line2: "",
    hover: line1,
  };
}

/** Set / Edit price sheet identity — name, number, grade (SSOT Line 1 parts). */
export function listPriceSheetIdentity(
  meta: RwaMetadata | null | undefined,
  tokenId: number,
  fallbackName?: string | null,
): PortfolioHoldingsHeadline {
  const fallback = fallbackName?.trim() || `RWA #${tokenId}`;
  if (isSealedBoxMetadata(meta)) {
    return sealedBoxHeadlineFromMetadata(meta, fallback);
  }
  const parts = buildRwaAssetDetailHeadlineParts(meta ?? null, fallback);
  const grade =
    formatPortfolioGradeLabel(meta ?? null) || resolveRwaHeadlineGrade(meta);
  const displayParts = cardDisplayPartsFromAssetDetail(parts, grade || null);
  const line1 = formatCardDisplayLine1(displayParts) || fallback;
  const nameLine =
    formatCardDisplayLine1(displayParts, { omitGrade: true }) || line1;
  const hover = formatCardDisplayHoverTitle(parts, { grade });
  const line2 = formatCardDisplayMeta(parts);
  return {
    parts,
    grade,
    line1,
    nameLine,
    line2,
    hover: hover || line1,
  };
}

/** Portfolio holdings — SSOT Line 1 parts + formatted strings. */
export function resolvePortfolioHoldingsHeadlines(
  rows: AssetRow[],
  metadataByTokenId: Map<number, RwaMetadata | null>,
): Map<number, PortfolioHoldingsHeadline> {
  const out = new Map<number, PortfolioHoldingsHeadline>();
  const collisionItems: Array<{
    id: string;
    parts: ReturnType<typeof cardDisplayPartsFromAssetDetail>;
  }> = [];

  for (const row of rows) {
    const meta = metadataByTokenId.get(row.tokenId) ?? null;
    const identity = listPriceSheetIdentity(meta, row.tokenId, row.name);
    collisionItems.push({
      id: String(row.tokenId),
      parts: cardDisplayPartsFromAssetDetail(identity.parts, identity.grade),
    });
    out.set(row.tokenId, {
      ...identity,
      line1: identity.line1 || row.name,
      hover: identity.hover || identity.line1 || row.name,
    });
  }

  const collided = resolveCardDisplayLine1Collisions(collisionItems);
  const nameCollided = resolveCardDisplayLine1Collisions(collisionItems, {
    omitGrade: true,
  });
  for (const row of rows) {
    const next = collided.get(String(row.tokenId));
    const nameNext = nameCollided.get(String(row.tokenId));
    const cur = out.get(row.tokenId);
    if (!cur) continue;
    if (next || nameNext) {
      out.set(row.tokenId, {
        ...cur,
        line1: next || cur.line1,
        nameLine: nameNext || cur.nameLine,
      });
    }
  }
  return out;
}

/** Portfolio holdings — Line 1 titles (`{Name} · {Number} · {Grade}`). */
export function resolvePortfolioHoldingsDisplayNames(
  rows: AssetRow[],
  metadataByTokenId: Map<number, RwaMetadata | null>,
): Map<number, string> {
  const headlines = resolvePortfolioHoldingsHeadlines(rows, metadataByTokenId);
  const out = new Map<number, string>();
  for (const row of rows) {
    out.set(row.tokenId, headlines.get(row.tokenId)?.line1 ?? row.name);
  }
  return out;
}

/** Trade, fee, or amount paid. These are USDC settlements and are not converted. */
export function formatPortfolioUsd(
  value: number | null | undefined,
  _opts?: { compact?: boolean },
): string {
  return formatUsdcAmount(value);
}

/**
 * `marketplace_buy` stores the USDC fill. `vault_delivery` and legacy `manual`
 * store a USD mark. The column name is shared; the source says which unit it is.
 */
export function portfolioCostBasisUnit(
  source: PortfolioCostBasisSource | null | undefined,
): "usdc_paid" | "usd_reference" | null {
  if (source === "marketplace_buy") return "usdc_paid";
  if (source === "vault_delivery" || source === "manual") return "usd_reference";
  return null;
}

/** Paid amount in its own unit. Unknown source is not labeled as USD or USDC. */
export function formatPortfolioCostBasis(
  amount: number | null | undefined,
  source: PortfolioCostBasisSource | null | undefined,
): string {
  if (amount == null || !Number.isFinite(amount)) return "—";
  const unit = portfolioCostBasisUnit(source);
  if (unit === "usdc_paid") return formatUsdcAmount(amount);
  if (unit === "usd_reference") return formatDisplayMoney(amount);
  return "—";
}

export type PortfolioProfitReturn = {
  profit: string;
  returnPct: string;
  positive: boolean;
  /** Flat or whole-% rounds to 0 — show `—`, no ↗↘. */
  muted: boolean;
};

function portfolioReturnIsFlat(delta: number, pct: number): boolean {
  if (!Number.isFinite(delta) || !Number.isFinite(pct)) return true;
  if (Math.abs(delta) < 0.005) return true;
  if (Math.abs(pct) < 0.05) return true;
  return Math.round(pct) === 0;
}

export function formatPortfolioProfitReturn(
  costBasis: number | null | undefined,
  currentValue: number | null | undefined,
  source?: PortfolioCostBasisSource | null,
): PortfolioProfitReturn | null {
  if (
    costBasis == null ||
    currentValue == null ||
    !Number.isFinite(costBasis) ||
    !Number.isFinite(currentValue) ||
    costBasis <= 0
  ) {
    return null;
  }
  // A USDC fill is not a USD market value, so it is not subtracted from the mark.
  if (portfolioCostBasisUnit(source) !== "usd_reference") return null;
  const delta = currentValue - costBasis;
  const pct = (delta / costBasis) * 100;
  const sign = delta >= 0 ? "+" : "-";
  const muted = portfolioReturnIsFlat(delta, pct);
  return {
    profit: `${sign}${formatDisplayMoney(Math.abs(delta))}`,
    returnPct: muted ? "—" : `${pct >= 0 ? "+" : ""}${Math.round(pct)}%`,
    positive: delta >= 0,
    muted,
  };
}

/** Gallery / table: ↗ up, ↘ down (vs cost). */
export function portfolioPriceChangeArrow(up: boolean): "↗" | "↘" {
  return up ? "↗" : "↘";
}

function downsampleSparklineValues(values: number[], maxPoints: number): number[] {
  if (values.length < 2) return [];
  if (values.length <= maxPoints) return values;
  const step = (values.length - 1) / (maxPoints - 1);
  const out: number[] = [];
  for (let i = 0; i < maxPoints; i++) {
    out.push(values[Math.round(i * step)]!);
  }
  return out;
}

export function extractSparklineValues(
  series: CollectionMarketSeries | null | undefined,
  maxPoints = 14,
): number[] {
  const values = (series?.externalUsd ?? [])
    .map((p) => p.v)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return downsampleSparklineValues(values, maxPoints);
}

/** Portfolio gallery spark — last ~365d of comps-merged external USD. */
export function extractSparklineValues1y(
  series: CollectionMarketSeries | null | undefined,
  maxPoints = 14,
): number[] {
  const windowed: CollectionUsdPoint[] = filterMergedChartPointsForWindow(
    series?.externalUsd,
    "365d",
  );
  const values = windowed
    .map((p) => p.v)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v) && v > 0);
  return downsampleSparklineValues(values, maxPoints);
}

export function compareSortText(a: string, b: string, dir: "asc" | "desc"): number {
  const cmp = a.localeCompare(b, undefined, { sensitivity: "base" });
  return dir === "asc" ? cmp : -cmp;
}

export function compareSortNum(
  a: number | null | undefined,
  b: number | null | undefined,
  dir: "asc" | "desc",
): number {
  const na = a != null && Number.isFinite(a) ? a : Number.NEGATIVE_INFINITY;
  const nb = b != null && Number.isFinite(b) ? b : Number.NEGATIVE_INFINITY;
  if (na !== nb) return dir === "asc" ? na - nb : nb - na;
  return 0;
}
