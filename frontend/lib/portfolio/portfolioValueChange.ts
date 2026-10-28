import { formatDisplayMoney } from "@/lib/market/displayMoney";

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
  return formatDisplayMoney(Math.abs(usd));
}

function formatChangePctAbs(pct: number): string {
  return String(Math.abs(Math.round(pct)));
}

/** Portfolio value — change states.html */
export function formatPortfolioValueChangeLabel(
  state: PortfolioValueChangeState,
  pnlUsd: number,
  pnlPct: number,
): { arrow: string; usd: string; pct: string } | null {
  if (state === "nodata") return null;

  if (state === "flat") {
    return { arrow: "–", usd: formatDisplayMoney(0), pct: "0%" };
  }

  if (state === "up") {
    return {
      arrow: "▲",
      usd: `+${formatChangeUsdAbs(pnlUsd)}`,
      pct: `+${formatChangePctAbs(pnlPct)}%`,
    };
  }

  return {
    arrow: "▼",
    usd: `−${formatChangeUsdAbs(pnlUsd)}`,
    pct: `−${formatChangePctAbs(pnlPct)}%`,
  };
}
