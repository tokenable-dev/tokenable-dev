/**
 * Persists the first-seen PokeTrace NM blended USD per token (per wallet) in
 * localStorage so My Assets P&amp;L can show change vs that snapshot (NM market
 * movement), not acquisition cost.
 */

const STORAGE_PREFIX = "tokenable.portfolio.marketNmBaseline.";

export type NmBaselineEntry = { v: number; t: number };

export function loadNmBaselineMap(walletAddress: string): Record<number, NmBaselineEntry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + walletAddress.toLowerCase());
    if (!raw) return {};
    const p = JSON.parse(raw) as Record<string, NmBaselineEntry>;
    const out: Record<number, NmBaselineEntry> = {};
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

export function saveNmBaselineMap(
  walletAddress: string,
  map: Record<number, NmBaselineEntry>,
): void {
  if (typeof window === "undefined") return;
  const flat: Record<string, NmBaselineEntry> = {};
  for (const [k, v] of Object.entries(map)) {
    flat[String(k)] = v;
  }
  localStorage.setItem(STORAGE_PREFIX + walletAddress.toLowerCase(), JSON.stringify(flat));
}
