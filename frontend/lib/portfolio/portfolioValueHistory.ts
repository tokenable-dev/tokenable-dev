/**
 * Time series of portfolio total USD (sum of per-card current value) for the My Assets chart.
 * Snapshots are stored per wallet in localStorage — no server history API.
 */

const STORAGE_PREFIX = "tokenable.portfolio.valueHistory.";
const MAX_ENTRIES = 6000;
const MAX_AGE_MS = 120 * 86400_000; // 120d

export type PortfolioValueSnapshot = { t: number; v: number };

function storageKey(wallet: string): string {
  return STORAGE_PREFIX + wallet.toLowerCase();
}

export function loadPortfolioValueHistory(walletAddress: string): PortfolioValueSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(walletAddress));
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    const out: PortfolioValueSnapshot[] = [];
    for (const x of arr) {
      if (
        x &&
        typeof x === "object" &&
        typeof (x as PortfolioValueSnapshot).t === "number" &&
        typeof (x as PortfolioValueSnapshot).v === "number" &&
        Number.isFinite((x as PortfolioValueSnapshot).v)
      ) {
        out.push({ t: (x as PortfolioValueSnapshot).t, v: (x as PortfolioValueSnapshot).v });
      }
    }
    return out.sort((a, b) => a.t - b.t);
  } catch {
    return [];
  }
}

function saveHistory(walletAddress: string, list: PortfolioValueSnapshot[]): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  const trimmed = list
    .filter((s) => now - s.t <= MAX_AGE_MS)
    .slice(-MAX_ENTRIES);
  localStorage.setItem(storageKey(walletAddress), JSON.stringify(trimmed));
}

/**
 * Append a snapshot if throttle allows. Returns true when storage was updated.
 */
export function appendPortfolioValueSnapshot(
  walletAddress: string,
  totalValueUsd: number,
): boolean {
  if (typeof window === "undefined" || !Number.isFinite(totalValueUsd)) return false;
  const list = loadPortfolioValueHistory(walletAddress);
  const now = Date.now();
  const last = list[list.length - 1];
  if (last) {
    const sameValue = Math.abs(last.v - totalValueUsd) < 1e-6;
    if (sameValue && now - last.t < 120_000) return false;
    if (now - last.t < 30_000) return false;
  }
  list.push({ t: now, v: totalValueUsd });
  saveHistory(walletAddress, list);
  return true;
}
