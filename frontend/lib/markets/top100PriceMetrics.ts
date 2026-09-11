import type { CardHedgerPricePoint } from "@/lib/core/api/cardhedger";
import { formatUsdCompact } from "@/lib/market/collectionMarketPricing";
import { parseTop100Price } from "./top100CardDisplay";

export type Top100PriceSeries = {
  points: number[];
  xLabels: string[];
};

export type Top100PriceMetrics = {
  currentPrice: number;
  avgPrice: number;
  changePct: number | null;
  minPrice: number;
  maxPrice: number;
};

export function normalizePriceHistory(
  prices: CardHedgerPricePoint[],
): Top100PriceSeries {
  const sorted = [...prices].sort(
    (a, b) => new Date(a.closing_date).getTime() - new Date(b.closing_date).getTime(),
  );

  const points: number[] = [];
  const xLabels: string[] = [];

  for (const row of sorted) {
    const n = parseTop100Price(row.price);
    if (n == null) continue;
    points.push(n);
    const d = new Date(row.closing_date);
    xLabels.push(
      Number.isNaN(d.getTime())
        ? row.closing_date
        : d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    );
  }

  return { points, xLabels };
}

export function computePriceMetrics(points: number[]): Top100PriceMetrics | null {
  if (points.length === 0) return null;

  const first = points[0];
  const last = points[points.length - 1];
  const sum = points.reduce((acc, v) => acc + v, 0);
  const avg = sum / points.length;

  return {
    currentPrice: last,
    avgPrice: avg,
    changePct: first > 0 ? ((last - first) / first) * 100 : null,
    minPrice: Math.min(...points),
    maxPrice: Math.max(...points),
  };
}

export type MarketInsightBullet = {
  title: string;
  text: string;
};

export function buildMarketInsights(
  metrics: Top100PriceMetrics | null,
  sales30: number | null,
): MarketInsightBullet[] {
  if (!metrics) return [];

  const bullets: MarketInsightBullet[] = [];

  bullets.push({
    title: "Price band",
    text: `Over the selected window, prices ranged from ${fmt(metrics.minPrice)} to ${fmt(metrics.maxPrice)} for this grade.`,
  });

  if (metrics.changePct != null) {
    const dir =
      metrics.changePct > 2
        ? "upward"
        : metrics.changePct < -2
          ? "downward"
          : "relatively stable";
    bullets.push({
      title: "Recent price trend",
      text: `The series moved ${dir} (${formatSignedPct(metrics.changePct)}) from the start of the window to the latest close.`,
    });
  }

  if (sales30 != null) {
    bullets.push({
      title: "Market activity",
      text: `${sales30.toLocaleString()} sales recorded in the last 30 days — ${sales30 >= 20 ? "healthy liquidity" : "lighter turnover"} for this card.`,
    });
  }

  const spread = metrics.maxPrice - metrics.minPrice;
  const spreadPct = metrics.avgPrice > 0 ? (spread / metrics.avgPrice) * 100 : 0;
  bullets.push({
    title: "Volatility",
    text:
      spreadPct >= 15
        ? "Price swings are elevated — watch for short-term noise around comps."
        : "Price action looks comparatively steady across the window.",
  });

  return bullets;
}

function fmt(n: number): string {
  return formatUsdCompact(n);
}

function formatSignedPct(pct: number): string {
  const sign = pct >= 0 ? "+" : "−";
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}
