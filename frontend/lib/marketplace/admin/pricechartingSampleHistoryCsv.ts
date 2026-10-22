/**
 * Approximate Ungraded (loose) price series traced from a PriceCharting chart
 * (Sep 2023 → Oct 2026). For admin CSV upload dry-runs — not live market data.
 *
 * Columns match `parseManualHistoryCsv`: product_id, observed_on, loose_price (USD).
 */

/** Sparse curve anchors (chart eye-trace). Expanded to daily rows below. */
const SAMPLE_HISTORY_ANCHORS: ReadonlyArray<{
  observedOn: string;
  loosePriceUsd: number;
}> = [
  { observedOn: "2023-09-01", loosePriceUsd: 200 },
  { observedOn: "2023-10-01", loosePriceUsd: 185 },
  { observedOn: "2023-11-01", loosePriceUsd: 168 },
  { observedOn: "2023-12-01", loosePriceUsd: 195 },
  { observedOn: "2024-01-01", loosePriceUsd: 225 },
  { observedOn: "2024-02-01", loosePriceUsd: 188 },
  { observedOn: "2024-03-01", loosePriceUsd: 148 },
  { observedOn: "2024-04-01", loosePriceUsd: 108 },
  { observedOn: "2024-05-01", loosePriceUsd: 72 },
  { observedOn: "2024-06-01", loosePriceUsd: 78 },
  { observedOn: "2024-07-01", loosePriceUsd: 88 },
  { observedOn: "2024-08-01", loosePriceUsd: 96 },
  { observedOn: "2024-09-01", loosePriceUsd: 105 },
  { observedOn: "2024-10-01", loosePriceUsd: 114 },
  { observedOn: "2024-11-01", loosePriceUsd: 122 },
  { observedOn: "2024-12-01", loosePriceUsd: 128 },
  { observedOn: "2025-01-01", loosePriceUsd: 132 },
  { observedOn: "2025-02-01", loosePriceUsd: 136 },
  { observedOn: "2025-03-01", loosePriceUsd: 140 },
  { observedOn: "2025-04-01", loosePriceUsd: 142 },
  { observedOn: "2025-05-01", loosePriceUsd: 144 },
  { observedOn: "2025-06-01", loosePriceUsd: 146 },
  { observedOn: "2025-07-01", loosePriceUsd: 150 },
  { observedOn: "2025-08-01", loosePriceUsd: 158 },
  { observedOn: "2025-09-01", loosePriceUsd: 178 },
  { observedOn: "2025-10-01", loosePriceUsd: 160 },
  { observedOn: "2025-11-01", loosePriceUsd: 172 },
  { observedOn: "2025-12-01", loosePriceUsd: 188 },
  { observedOn: "2026-01-01", loosePriceUsd: 208 },
  { observedOn: "2026-02-01", loosePriceUsd: 232 },
  { observedOn: "2026-03-01", loosePriceUsd: 255 },
  // Apr–Oct 2026 — eye-traced from PriceCharting zoom; Oct 22 spot = $261.
  { observedOn: "2026-04-01", loosePriceUsd: 265 },
  { observedOn: "2026-04-18", loosePriceUsd: 295 },
  { observedOn: "2026-05-05", loosePriceUsd: 348 },
  { observedOn: "2026-05-22", loosePriceUsd: 318 },
  { observedOn: "2026-06-10", loosePriceUsd: 298 },
  { observedOn: "2026-06-28", loosePriceUsd: 288 },
  { observedOn: "2026-07-15", loosePriceUsd: 284 },
  { observedOn: "2026-08-05", loosePriceUsd: 280 },
  { observedOn: "2026-08-25", loosePriceUsd: 272 },
  { observedOn: "2026-09-12", loosePriceUsd: 268 },
  { observedOn: "2026-09-28", loosePriceUsd: 265 },
  { observedOn: "2026-10-10", loosePriceUsd: 263 },
  { observedOn: "2026-10-22", loosePriceUsd: 261 },
];

const MS_DAY = 86_400_000;

function parseUtcDay(iso: string): number {
  const t = Date.parse(`${iso}T12:00:00Z`);
  if (!Number.isFinite(t)) throw new Error(`bad sample date ${iso}`);
  return t;
}

function formatUtcDay(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Daily points via linear interpolation between anchors (~3 years ≈ 1,100 rows).
 * Under the bulk upload 5,000-row cap.
 */
export function buildSampleHistoryDailyPoints(): Array<{
  observedOn: string;
  loosePriceUsd: number;
}> {
  const out: Array<{ observedOn: string; loosePriceUsd: number }> = [];
  for (let i = 0; i < SAMPLE_HISTORY_ANCHORS.length - 1; i++) {
    const a = SAMPLE_HISTORY_ANCHORS[i]!;
    const b = SAMPLE_HISTORY_ANCHORS[i + 1]!;
    const t0 = parseUtcDay(a.observedOn);
    const t1 = parseUtcDay(b.observedOn);
    const days = Math.round((t1 - t0) / MS_DAY);
    if (days <= 0) continue;
    for (let d = 0; d < days; d++) {
      const frac = d / days;
      const usd = a.loosePriceUsd + (b.loosePriceUsd - a.loosePriceUsd) * frac;
      out.push({
        observedOn: formatUtcDay(t0 + d * MS_DAY),
        loosePriceUsd: Math.round(usd * 100) / 100,
      });
    }
  }
  const last = SAMPLE_HISTORY_ANCHORS[SAMPLE_HISTORY_ANCHORS.length - 1]!;
  out.push({
    observedOn: last.observedOn,
    loosePriceUsd: last.loosePriceUsd,
  });
  return out;
}

/** Upload API requires a numeric PriceCharting product id. */
export function normalizeSampleHistoryProductId(
  productId: string,
): string | null {
  const id = productId.trim();
  return /^\d+$/.test(id) ? id : null;
}

export function buildPricechartingSampleHistoryCsv(productId: string): string {
  const id = normalizeSampleHistoryProductId(productId);
  if (!id) {
    throw new Error("product_id must be a numeric PriceCharting id");
  }
  const lines = ["product_id,observed_on,loose_price"];
  for (const row of buildSampleHistoryDailyPoints()) {
    lines.push(`${id},${row.observedOn},${row.loosePriceUsd.toFixed(2)}`);
  }
  return `${lines.join("\n")}\n`;
}

export function downloadPricechartingSampleHistoryCsv(productId: string): void {
  const id = normalizeSampleHistoryProductId(productId);
  if (!id) {
    throw new Error("product_id must be a numeric PriceCharting id");
  }
  const csv = buildPricechartingSampleHistoryCsv(id);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pricecharting-sample-history-${id}.csv`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
