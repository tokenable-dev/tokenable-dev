/** Ask vs market — % distance from market (rounded whole %). */
export function computeAskVsMarketPct(
  askUsd: number,
  marketUsd: number,
): { pct: number; direction: "up" | "down" | "flat" } | null {
  if (
    !Number.isFinite(askUsd) ||
    !Number.isFinite(marketUsd) ||
    askUsd <= 0 ||
    marketUsd <= 0
  ) {
    return null;
  }
  const deltaPct = ((askUsd - marketUsd) / marketUsd) * 100;
  if (Math.abs(deltaPct) < 0.5) {
    return { pct: 0, direction: "flat" };
  }
  return {
    pct: Math.round(Math.abs(deltaPct)),
    direction: deltaPct > 0 ? "up" : "down",
  };
}
