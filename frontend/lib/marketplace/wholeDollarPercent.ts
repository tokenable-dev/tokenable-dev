/**
 * Whole dollars only. $100 and below steps by $1 — 1% rounds away with no
 * decimals. Above $100, step by 1%.
 */
export function bumpWholeDollarByOnePercent(
  current: number,
  direction: 1 | -1,
): number {
  const base = Math.max(0, Math.round(Number.isFinite(current) ? current : 0));
  if (base <= 100) return Math.max(0, base + direction);
  const next = Math.round(base * (1 + direction * 0.01));
  if (next === base) return Math.max(0, base + direction);
  return Math.max(0, next);
}
