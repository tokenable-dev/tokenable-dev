export type PortfolioValueChangeState = "up" | "down" | "flat" | "nodata";

export function resolvePortfolioValueChangeState(
  pnlUsd: number | null | undefined,
  pnlPct: number | null | undefined,
): PortfolioValueChangeState {
  const usdOk = pnlUsd != null && Number.isFinite(pnlUsd);
  const pctOk = pnlPct != null && Number.isFinite(pnlPct);
  if (!usdOk || !pctOk) return "nodata";

  if (pnlUsd === 0 && pnlPct === 0) return "flat";
  if (pnlUsd < 0 || pnlPct < 0) return "down";
  if (pnlUsd > 0 || pnlPct > 0) return "up";
  return "flat";
}

function formatChangeUsdAbs(usd: number): string {
  return Math.abs(usd).toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function formatChangePctAbs(pct: number): string {
  const abs = Math.abs(pct);
  return Number.isInteger(abs) ? String(abs) : abs.toFixed(1);
}

/** Portfolio value — change states.html */
export function formatPortfolioValueChangeLabel(
  state: PortfolioValueChangeState,
  pnlUsd: number,
  pnlPct: number,
): { arrow: string; usd: string; pct: string } | null {
  if (state === "nodata") return null;

  if (state === "flat") {
    return { arrow: "–", usd: "$0", pct: "0.0%" };
  }

  if (state === "up") {
    return {
      arrow: "▲",
      usd: `+$${formatChangeUsdAbs(pnlUsd)}`,
      pct: `+${formatChangePctAbs(pnlPct)}%`,
    };
  }

  return {
    arrow: "▼",
    usd: `−$${formatChangeUsdAbs(pnlUsd)}`,
    pct: `−${formatChangePctAbs(pnlPct)}%`,
  };
}
