/**
 * Sample sealed-box trades CSV (~1y eBay Buy It Now).
 * Prices follow the same loose curve as the sample history CSV.
 * For admin upload into pricecharting_trade_history — not live market data.
 */

import { buildSampleHistoryDailyPoints } from "./pricechartingSampleHistoryCsv";

const MS_DAY = 86_400_000;

/** Default demo product — Scarlet & Violet 151 Booster Box. */
export const SAMPLE_TRADES_DEFAULT_PRODUCT_ID = "5490667";

function formatUtcDay(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseUtcDay(iso: string): number {
  const t = Date.parse(`${iso}T12:00:00Z`);
  if (!Number.isFinite(t)) throw new Error(`bad sample date ${iso}`);
  return t;
}

/**
 * Deterministic pseudo-noise in [-1, 1] from date + salt (no Math.random).
 */
function noiseUnit(dayIso: string, salt: number): number {
  let h = salt * 374761393;
  for (let i = 0; i < dayIso.length; i++) {
    h = (h * 31 + dayIso.charCodeAt(i)) | 0;
  }
  const u = ((h >>> 0) % 10_000) / 10_000;
  return u * 2 - 1;
}

export function normalizeSampleTradesProductId(
  productId: string,
): string | null {
  const id = productId.trim();
  return /^\d+$/.test(id) ? id : null;
}

/**
 * ~1 year ending today (UTC): one Buy It Now every ~1–2 days with light
 * price noise around the history curve. ~200–250 rows.
 */
export function buildSampleTradesRows(productId: string): Array<{
  productId: string;
  tradedOn: string;
  priceUsd: number;
  source: string;
  saleType: string;
}> {
  const id = normalizeSampleTradesProductId(productId);
  if (!id) {
    throw new Error("product_id must be a numeric PriceCharting id");
  }

  const history = buildSampleHistoryDailyPoints();
  const byDay = new Map(history.map((p) => [p.observedOn, p.loosePriceUsd]));

  const endMs = Date.parse(
    `${formatUtcDay(Date.now())}T12:00:00Z`,
  );
  const startMs = endMs - 365 * MS_DAY;

  const rows: Array<{
    productId: string;
    tradedOn: string;
    priceUsd: number;
    source: string;
    saleType: string;
  }> = [];

  let cursor = startMs;
  while (cursor <= endMs) {
    const tradedOn = formatUtcDay(cursor);
    let base = byDay.get(tradedOn);
    if (base == null) {
      // Fall back to nearest history day if outside the history span.
      let best: string | null = null;
      let bestDist = Number.POSITIVE_INFINITY;
      for (const day of byDay.keys()) {
        const dist = Math.abs(parseUtcDay(day) - cursor);
        if (dist < bestDist) {
          bestDist = dist;
          best = day;
        }
      }
      base = best != null ? byDay.get(best)! : 200;
    }

    const n = noiseUnit(tradedOn, 7);
    const pct = 0.012 + Math.abs(noiseUnit(tradedOn, 11)) * 0.03;
    const priceUsd =
      Math.round((base * (1 + n * pct) + n * 1.5) * 100) / 100;
    rows.push({
      productId: id,
      tradedOn,
      priceUsd: Math.max(1, priceUsd),
      source: "eBay",
      saleType: "Buy It Now",
    });

    // Mostly every other day; occasional same-week double via shorter step.
    const stepDays =
      noiseUnit(tradedOn, 19) > 0.55 ? 1 : noiseUnit(tradedOn, 23) > 0.2 ? 2 : 3;
    cursor += stepDays * MS_DAY;
  }

  return rows;
}

export function buildPricechartingSampleTradesCsv(productId: string): string {
  const id = normalizeSampleTradesProductId(productId);
  if (!id) {
    throw new Error("product_id must be a numeric PriceCharting id");
  }
  const lines = ["product_id,traded_on,price,source,sale_type"];
  for (const row of buildSampleTradesRows(id)) {
    lines.push(
      `${row.productId},${row.tradedOn},${row.priceUsd.toFixed(2)},${row.source},${row.saleType}`,
    );
  }
  return `${lines.join("\n")}\n`;
}

export function downloadPricechartingSampleTradesCsv(productId: string): void {
  const id = normalizeSampleTradesProductId(productId);
  if (!id) {
    throw new Error("product_id must be a numeric PriceCharting id");
  }
  const csv = buildPricechartingSampleTradesCsv(id);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pricecharting-sample-trades-${id}.csv`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
