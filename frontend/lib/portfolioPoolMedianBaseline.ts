/**
 * First-seen listing-pool median (per token, per wallet) for My Assets P&amp;L vs pool snapshot.
 */

const STORAGE_PREFIX = "tokenable.portfolio.poolMedianBaseline.";

export type PoolMedianBaselineEntry = { v: number; t: number };

export function loadPoolMedianBaselineMap(
  walletAddress: string,
): Record<number, PoolMedianBaselineEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + walletAddress.toLowerCase());
    if (!raw) return {};
    const p = JSON.parse(raw) as Record<string, PoolMedianBaselineEntry>;
    const out: Record<number, PoolMedianBaselineEntry> = {};
    for (const [k, v] of Object.entries(p)) {
      const id = Number(k);
      if (!Number.isFinite(id) || !v || typeof v.v !== "number" || !Number.isFinite(v.v)) continue;
      out[id] = { v: v.v, t: typeof v.t === "number" ? v.t : 0 };
    }
    return out;
  } catch {
    return {};
  }
}

export function savePoolMedianBaselineMap(
  walletAddress: string,
  map: Record<number, PoolMedianBaselineEntry>,
): void {
  if (typeof window === "undefined") return;
  const flat: Record<string, PoolMedianBaselineEntry> = {};
  for (const [k, v] of Object.entries(map)) {
    flat[String(k)] = v;
  }
  localStorage.setItem(STORAGE_PREFIX + walletAddress.toLowerCase(), JSON.stringify(flat));
}
