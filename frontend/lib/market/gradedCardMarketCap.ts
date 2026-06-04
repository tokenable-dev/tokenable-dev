import type {
  CollectionGradePrices,
  CollectionMarketPreview,
} from "@/lib/core";
import { marketHistoryTierFromComponents } from "@/lib/market";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";

/**
 * PSA 슬랩만 취급할 때의 "시가총액" 참고치.
 * - 공급: PSA가 공개한 해당 등급(또는 cert 라인) 인구 `totalPopulation`
 * - 단가: PokeTrace NM 밴드(또는 상한)로 **대표 단가**를 잡고, 등급에 따라 가중(선택)
 *
 * 주의: NM 시세와 PSA10 슬랩 시세는 다를 수 있음. `gradeMultiplier`로 제품 정책만 조정.
 */

export type MarketCapConfidence = "high" | "medium" | "low";

export interface MarketCapComputation {
  /** null 이면 표시하지 않음 */
  usd: number | null;
  confidence: MarketCapConfidence;
  /** UI에 작게 넣을 때용 */
  methodLabel: string;
  unitUsd: number | null;
  population: number | null;
}

const DEFAULT_GRADE_MULTIPLIER: Record<number, number> = {
  10: 1,
  9: 0.92,
  8: 0.75,
};

function pickAvgFromBand(band: { avg: number | null; low: number | null; high: number | null } | null): number | null {
  if (!band) return null;
  if (band.avg != null && Number.isFinite(band.avg)) return band.avg;
  if (band.low != null && band.high != null && Number.isFinite(band.low) && Number.isFinite(band.high)) {
    return (band.low + band.high) / 2;
  }
  return null;
}

/** eBay / TCGPlayer NM에서 대표 단가(USD) */
export function blendNearMintUnitUsd(
  card: NonNullable<CollectionMarketPreview["card"]>
): { unitUsd: number | null; confidence: MarketCapConfidence; source: string } {
  const e = pickAvgFromBand(card.ebayNearMint);
  const t = pickAvgFromBand(card.tcgplayerNearMint);

  if (e != null && t != null) {
    const blended = (e + t) / 2;
    return {
      unitUsd: blended,
      confidence: "high",
      source: "eBay+TCGPlayer NM",
    };
  }
  if (e != null) return { unitUsd: e, confidence: "medium", source: "eBay NM" };
  if (t != null) return { unitUsd: t, confidence: "medium", source: "TCGPlayer NM" };

  if (card.topPrice != null && Number.isFinite(card.topPrice) && card.topPrice > 0) {
    return {
      unitUsd: card.topPrice,
      confidence: "low",
      source: "catalog top (fallback)",
    };
  }

  return { unitUsd: null, confidence: "low", source: "none" };
}

/** NM blended spot USD — same weights as PSA market-cap unit; for strip / portfolio / failover. */
export function nmSpotUsdFromMarketPreview(
  preview: CollectionMarketPreview | null | undefined,
): number | null {
  if (!preview?.matched || !preview.card) return null;
  return blendNearMintUnitUsd(preview.card).unitUsd;
}

/** PSA tier eBay band when Pro exposes it; else NM blend (matches server `blendCatalogSpotUsdFromPreview`). */
export function catalogSpotUsdFromMarketPreview(
  preview: CollectionMarketPreview | null | undefined,
  historyTier: string,
): number | null {
  if (!preview?.matched || !preview.card) return null;
  const c = preview.card;
  const tier = String(historyTier ?? "").trim();
  const map = c.ebayPsaTiers;
  if (map && tier.startsWith("PSA_")) {
    const v = pickAvgFromBand(map[tier] ?? null);
    if (v != null) return v;
  }
  if (historyTier === "PSA_10") {
    const v = pickAvgFromBand(c.ebayPsa10 ?? null);
    if (v != null) return v;
  }
  if (historyTier === "PSA_AUTH") {
    const v = pickAvgFromBand(c.ebayPsaTiers?.PSA_AUTH ?? null);
    if (v != null) return v;
    if (c.topPrice != null && Number.isFinite(c.topPrice) && c.topPrice > 0) {
      return c.topPrice;
    }
  }
  if (historyTier === "PSA_9") {
    const v = pickAvgFromBand(c.ebayPsa9 ?? null);
    if (v != null) return v;
  }
  return nmSpotUsdFromMarketPreview(preview);
}

function gradeMultiplier(gradeScore: number | undefined): number {
  if (gradeScore == null || !Number.isFinite(gradeScore)) return 1;
  const g = Math.round(gradeScore);
  return DEFAULT_GRADE_MULTIPLIER[g] ?? 1;
}

/**
 * @param totalPopulation — metadata.psa.totalPopulation (해당 PSA 라인 인구)
 * @param gradeScore — metadata.psa.gradeScore (10, 9, …)
 * @param card — PokeTrace 매칭 카드; null 이면 계산 불가
 */
export function computePsaMarketCapUsd(params: {
  totalPopulation: number | undefined | null;
  gradeScore: number | undefined | null;
  card: CollectionMarketPreview["card"];
}): MarketCapComputation {
  const popRaw = params.totalPopulation;
  const population =
    popRaw != null && Number.isFinite(popRaw) && popRaw > 0 ? Math.floor(popRaw) : null;

  if (!params.card || population == null) {
    return {
      usd: null,
      confidence: "low",
      methodLabel: "가격 또는 PSA 인구 없음",
      unitUsd: null,
      population: null,
    };
  }

  const { unitUsd: baseUnit, confidence: priceConf, source } = blendNearMintUnitUsd(params.card);
  if (baseUnit == null) {
    return {
      usd: null,
      confidence: "low",
      methodLabel: "대표 단가 없음",
      unitUsd: null,
      population,
    };
  }

  const m = gradeMultiplier(params.gradeScore ?? undefined);
  const unitUsd = baseUnit * m;

  const conf: MarketCapConfidence =
    priceConf === "high" && m === 1 ? "high" : priceConf === "low" ? "low" : "medium";

  const usd = unitUsd * population;

  return {
    usd,
    confidence: conf,
    methodLabel: `PSA 인구 ${population.toLocaleString()} × ${source}${m !== 1 ? ` × 등급계수 ${m}` : ""}`,
    unitUsd,
    population,
  };
}

export function parsePsaTotalPopulation(components: CollectionComponents): number | null {
  const v = components.psaTotalPopulation;
  if (typeof v === "number" && Number.isFinite(v) && v > 0) return Math.floor(v);
  return null;
}

export interface PsaPopulationMetrics {
  psa10Pop: number | null;
  totalPsaPop: number | null;
}

function finitePositivePop(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) return null;
  return Math.floor(v);
}

/** PSA 10 pop + total PSA pop for collection detail metrics. */
export function resolvePsaPopulationMetrics(
  components: CollectionComponents,
): PsaPopulationMetrics {
  const grade10 =
    finitePositivePop(components.psaGrade10Population) ??
    (parseGradeScoreNumber(components.gradeScore) === 10
      ? parsePsaTotalPopulation(components)
      : null);
  const totalPsaPop = finitePositivePop(components.psaSpecTotalPopulation);
  return { psa10Pop: grade10, totalPsaPop };
}

export function formatPsaPopulationCount(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  return n.toLocaleString("en-US");
}

/** PSA 10 pop / total pop for metric tiles (e.g. `48.4k / 111.1k`; full values in `title`). */
export function formatPsaPopulationPair(
  psa10Pop: number | null | undefined,
  totalPsaPop: number | null | undefined,
): string {
  return `${formatPsaPopulationCompact(psa10Pop)} / ${formatPsaPopulationCompact(totalPsaPop)}`;
}

/** Compact pop for narrow cells — e.g. `48k`, `1.2M`; full value via `title` when needed. */
export function formatPsaPopulationCompact(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return "—";
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1)}M`;
  }
  if (n >= 10_000) {
    return `${Math.round(n / 1_000).toLocaleString("en-US")}k`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return `${k >= 10 ? Math.round(k) : k.toFixed(1)}k`;
  }
  return n.toLocaleString("en-US");
}

export function parseGradeScoreNumber(gradeScoreStr: string | undefined | null): number | null {
  if (gradeScoreStr == null || gradeScoreStr === "") return null;
  const n = parseFloat(String(gradeScoreStr).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function unitUsdFromGradePrices(
  gradePrices: CollectionGradePrices,
  gradeScore: number
): number | null {
  const r = Math.round(gradeScore);
  if (r >= 10) return gradePrices.psa10;
  if (r === 9) return gradePrices.psa9;
  return gradePrices.raw;
}

/**
 * 컬렉션 버킷 단위 시가총액 (PSA 인구 × 단가).
 * - 상세: PokeTrace 카드가 있으면 NM 블렌드 + 등급계수 (`computePsaMarketCapUsd`)
 * - 목록 등: 스냅샷의 PokeTrace NM 스트립(`gradePrices`) × 인구
 */
export function computeCollectionMarketCapUsd(params: {
  components: CollectionComponents;
  gradeScoreStr: string | undefined | null;
  marketCard: CollectionMarketPreview["card"];
  /** When preview is approximate-match, skip catalog $ path (same as primary price policy). */
  marketMatchConfidence?: CollectionMarketPreview["matchConfidence"];
  gradePrices: CollectionGradePrices | null | undefined;
  /** Full preview when available — used for slab tier spot (PSA_9, PSA_8, …). */
  marketPreview?: CollectionMarketPreview | null;
}): MarketCapComputation {
  const population = parsePsaTotalPopulation(params.components);
  const gradeNum = parseGradeScoreNumber(params.gradeScoreStr);
  const historyTier = marketHistoryTierFromComponents(params.components);

  if (population == null) {
    return {
      usd: null,
      confidence: "low",
      methodLabel: "PSA 인구 없음",
      unitUsd: null,
      population: null,
    };
  }

  if (
    params.marketMatchConfidence !== "approximate" &&
    params.marketCard &&
    historyTier !== "NEAR_MINT"
  ) {
    const previewForSpot: CollectionMarketPreview =
      params.marketPreview ??
      ({
        enabled: true,
        matched: true,
        searchQuery: "",
        card: params.marketCard,
      } as CollectionMarketPreview);
    const spot = catalogSpotUsdFromMarketPreview(previewForSpot, historyTier);
    if (spot != null && Number.isFinite(spot) && spot > 0) {
      return {
        usd: spot * population,
        confidence: "high",
        methodLabel: `PSA 인구 ${population.toLocaleString()} × PokeTrace ${historyTier}`,
        unitUsd: spot,
        population,
      };
    }
  }

  if (params.marketMatchConfidence !== "approximate" && params.marketCard) {
    const fromPt = computePsaMarketCapUsd({
      totalPopulation: population,
      gradeScore: gradeNum,
      card: params.marketCard,
    });
    if (fromPt.usd != null) return fromPt;
  }

  if (params.gradePrices && gradeNum != null) {
    const unit = unitUsdFromGradePrices(params.gradePrices, gradeNum);
    if (unit != null && Number.isFinite(unit) && unit > 0) {
      return {
        usd: unit * population,
        confidence: "medium",
        methodLabel: `PSA 인구 × PokeTrace NM (ref)`,
        unitUsd: unit,
        population,
      };
    }
  }

  return {
    usd: null,
    confidence: "low",
    methodLabel: "단가 없음",
    unitUsd: null,
    population,
  };
}

export function formatMarketCapUsd(usd: number | null): string {
  if (usd == null || !Number.isFinite(usd)) return "—";
  if (usd >= 1_000_000_000) return `$${(usd / 1_000_000_000).toFixed(2)}B`;
  if (usd >= 1_000_000) return `$${(usd / 1_000_000).toFixed(2)}M`;
  if (usd >= 10_000) return `$${(usd / 1_000).toFixed(1)}K`;
  return `$${usd.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
