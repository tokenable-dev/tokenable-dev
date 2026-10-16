/** Home / ticker strip sizes — match frontend `HOME_*_LIMIT`. */
export const HOME_TOP_MOVERS_LIMIT = 10;
export const HOME_JUST_VAULTED_LIMIT = 10;
export const HOME_TICKER_LIMIT = 8;
export const HOME_MOVERS_LAG_90D_SEC = 90 * 86_400;

export function pickHomeTopMoverKeys(
  items: Array<{ collectionKey: string; pct90d: number | null }>,
  limit = HOME_TOP_MOVERS_LIMIT,
): string[] {
  return items
    .filter(
      (r) =>
        r.pct90d != null && Number.isFinite(r.pct90d) && (r.pct90d as number) > 0,
    )
    .sort((a, b) => (b.pct90d ?? 0) - (a.pct90d ?? 0))
    .slice(0, limit)
    .map((r) => r.collectionKey);
}

export function pickHomeTickerKeys(
  items: Array<{ collectionKey: string; changePct: number | null }>,
  limit = HOME_TICKER_LIMIT,
): string[] {
  return items
    .filter((r) => r.changePct != null && Number.isFinite(r.changePct))
    .sort(
      (a, b) => Math.abs(b.changePct ?? 0) - Math.abs(a.changePct ?? 0),
    )
    .slice(0, limit)
    .map((r) => r.collectionKey);
}

export function pickJustVaultedKeys(
  items: Array<{ collectionKey: string; createdAtMs: number }>,
  limit = HOME_JUST_VAULTED_LIMIT,
): string[] {
  return [...items]
    .sort(
      (a, b) =>
        b.createdAtMs - a.createdAtMs ||
        a.collectionKey.localeCompare(b.collectionKey),
    )
    .slice(0, limit)
    .map((r) => r.collectionKey);
}

export function uniqueKeysInOrder(groups: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    for (const raw of group) {
      const k = raw.toLowerCase();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}
