import { formatDisplayMoney } from "@/lib/market/displayMoney";
import { portfolioCostBasisUnit } from "@/lib/portfolio/portfolioTableHelpers";
import type { PortfolioCostBasisSource } from "@/lib/core/api/portfolio";
import { resolveReferencePercentChangeDisplay } from "@/lib/market/priceChangePeriod";

export function formatPortfolioPassportId(tokenId: number): string {
  const n = Math.max(0, Math.floor(tokenId));
  return `TKB-${String(n).padStart(8, "0")}`;
}

export function formatWalletShort(address: string | null | undefined): string {
  const a = (address ?? "").trim();
  if (a.length < 10) return a || "—";
  return `${a.slice(0, 4)}…${a.slice(-3)}`;
}

export function formatCertDate(iso: string | null | undefined, locale = "en-US"): string {
  if (!iso?.trim()) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatCertDateShort(iso: string | null | undefined): string | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yy = String(d.getFullYear()).slice(-2);
  return `${mm}/${dd}/${yy}`;
}

export function formatExplorerAddr(addr: string): string {
  const a = addr.trim();
  if (a.length < 12) return a;
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function formatMarketChangePct(pct: number | null | undefined): {
  arrow: "" | "▲" | "▼";
  label: string;
  positive: boolean;
  muted: boolean;
} | null {
  if (pct == null || !Number.isFinite(pct)) return null;
  const display = resolveReferencePercentChangeDisplay(pct);
  if (!display.showGlyph) {
    return {
      arrow: "",
      label: display.pctLabel,
      positive: true,
      muted: true,
    };
  }
  return {
    arrow: display.tone === "down" ? "▼" : "▲",
    label: display.pctLabel,
    positive: display.tone === "up",
    muted: false,
  };
}

const CERT_DAY_SEC = 86_400;

export type CertRecentSale = {
  id: string;
  atSec: number;
  priceUsd: number;
};

/** PortfolioAsset.html Pricing tab — derived from the 365d series and the trade tape. */
export type CertPricing = {
  lastSaleUsd: number | null;
  change30Pct: number | null;
  change90Pct: number | null;
  change365Pct: number | null;
  rangeLowUsd: number | null;
  rangeHighUsd: number | null;
  sales12mo: number | null;
  recentSales: CertRecentSale[];
};

type CertPoint = { t: number; v: number };
type CertSale = { t: number; priceUsdc: number; orderHash?: string };

function refAtOrBefore(points: CertPoint[], targetSec: number): number | null {
  if (points.length === 0 || points[0].t > targetSec + 3 * CERT_DAY_SEC) return null;
  let value: number | null = null;
  for (const point of points) {
    if (point.t <= targetSec && point.v > 0) value = point.v;
  }
  return value;
}

function pctFrom(now: number | null, then: number | null): number | null {
  if (now == null || then == null || then <= 0 || now <= 0) return null;
  return ((now - then) / then) * 100;
}

export function buildCertPricing(input: {
  nowSec: number;
  marketUsd: number | null;
  fallback30Pct: number | null;
  points: CertPoint[];
  sales: CertSale[];
}): CertPricing {
  const points = input.points
    .filter((point) => point.v > 0 && Number.isFinite(point.t))
    .sort((a, b) => a.t - b.t);
  const now =
    input.marketUsd != null && input.marketUsd > 0
      ? input.marketUsd
      : points.length
        ? points[points.length - 1].v
        : null;
  const yearStart = input.nowSec - 365 * CERT_DAY_SEC;
  const ranged = points.filter((point) => point.t >= yearStart);
  const rangePts = ranged.length >= 2 ? ranged : points.length >= 2 ? points : [];
  let rangeLowUsd: number | null = null;
  let rangeHighUsd: number | null = null;
  for (const point of rangePts) {
    rangeLowUsd = rangeLowUsd == null ? point.v : Math.min(rangeLowUsd, point.v);
    rangeHighUsd = rangeHighUsd == null ? point.v : Math.max(rangeHighUsd, point.v);
  }
  const sales = input.sales
    .filter((sale) => sale.priceUsdc > 0 && Number.isFinite(sale.t))
    .sort((a, b) => b.t - a.t);
  const yearSales = sales.filter((sale) => sale.t >= yearStart);
  return {
    lastSaleUsd: sales[0]?.priceUsdc ?? null,
    change30Pct:
      pctFrom(now, refAtOrBefore(points, input.nowSec - 30 * CERT_DAY_SEC)) ??
      input.fallback30Pct,
    change90Pct: pctFrom(now, refAtOrBefore(points, input.nowSec - 90 * CERT_DAY_SEC)),
    change365Pct: pctFrom(now, refAtOrBefore(points, yearStart)),
    rangeLowUsd,
    rangeHighUsd,
    sales12mo: yearSales.length > 0 ? yearSales.length : null,
    recentSales: sales.slice(0, 4).map((sale, index) => ({
      id: sale.orderHash?.trim() || `${sale.t}-${index}`,
      atSec: sale.t,
      priceUsd: sale.priceUsdc,
    })),
  };
}

/**
 * Value change is a USD-mark difference. A marketplace USDC fill is not
 * subtracted from the CardHedger mark.
 */
export function formatCertValueChange(
  marketUsd: number | null,
  paid: number | null,
  source?: PortfolioCostBasisSource | null,
): { usdLabel: string; pctLabel: string; tone: "pos" | "neg" | "flat" } | null {
  if (marketUsd == null || paid == null || !(paid > 0)) return null;
  if (portfolioCostBasisUnit(source) !== "usd_reference") return null;
  const delta = marketUsd - paid;
  const pct = (delta / paid) * 100;
  const rounded = Math.round(delta);
  const absLabel = formatDisplayMoney(Math.abs(rounded));
  const usdLabel = rounded > 0 ? `+${absLabel}` : rounded < 0 ? `−${absLabel}` : absLabel;
  const absPct = Math.abs(pct);
  const pctBody =
    absPct === 0 || absPct >= 10 ? String(Math.round(absPct)) : absPct.toFixed(1);
  const pctLabel = pct > 0 ? `+${pctBody}%` : pct < 0 ? `−${pctBody}%` : "0%";
  const tone = rounded > 0 || pct > 0.05 ? "pos" : rounded < 0 || pct < -0.05 ? "neg" : "flat";
  return { usdLabel, pctLabel, tone };
}

