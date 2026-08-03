"use client";

import { formatUsdCompact } from "@/lib/market";
import { RWA_DETAIL_SHOW_MARKET_CONTEXT, rwaDetailRightFont } from "../theme";

export function RwaDetailMarketContextStrip({
  externalRefUsd,
  marketChangePct,
  changePeriodLabel,
  changeCoverageHint,
  variant = "card",
}: {
  externalRefUsd: number | null;
  marketChangePct: number | null;
  changePeriodLabel: string;
  changeCoverageHint?: string;
  /** `flat` — no border/background (mobile card details). */
  variant?: "card" | "flat";
}) {
  if (!RWA_DETAIL_SHOW_MARKET_CONTEXT) return null;
  if (externalRefUsd == null && marketChangePct == null) return null;
  const changeUp = marketChangePct != null && marketChangePct > 0;
  const changeDown = marketChangePct != null && marketChangePct < 0;
  const showRef = externalRefUsd != null;
  const showChange = marketChangePct != null && Number.isFinite(marketChangePct);

  const isFlat = variant === "flat";
  const shellClass = isFlat
    ? "grid gap-3 bg-transparent"
    : "grid gap-3 rounded-xl border border-zinc-700/55 bg-gradient-to-br from-zinc-900/80 to-[#0a0c0f] p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_8px_24px_-16px_rgba(0,0,0,0.65)] sm:gap-4 sm:p-4";
  const labelClass = isFlat
    ? "text-xs font-medium leading-tight text-zinc-500"
    : "text-[10px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:text-xs";
  const changeLabel = isFlat
    ? `${changePeriodLabel} change`.toLowerCase()
    : `${changePeriodLabel} change`;

  return (
    <div
      className={`${shellClass} ${
        showRef && showChange ? "grid-cols-2" : "grid-cols-1"
      }`}
    >
      {showRef ? (
        <div className="min-w-0">
          <p className={labelClass}>
            {isFlat ? "ebay reference" : "eBay reference"}
          </p>
          <p
            className={`${rwaDetailRightFont.className} mt-2 text-[1.35rem] font-bold leading-none tabular-nums text-[#87FF48] sm:mt-2.5 sm:text-2xl`}
          >
            {formatUsdCompact(externalRefUsd)}
          </p>
        </div>
      ) : null}
      {showChange ? (
        <div
          className={`min-w-0 ${showRef && !isFlat ? "border-l border-zinc-700/60 pl-3 sm:pl-4" : ""}`}
        >
          <p className={labelClass}>{changeLabel}</p>
          <p
            title={changeCoverageHint}
            className={`${rwaDetailRightFont.className} mt-2 text-[1.35rem] font-bold leading-none tabular-nums sm:mt-2.5 sm:text-2xl ${
              changeUp ? "text-mint" : changeDown ? "text-rose-400" : "text-zinc-200"
            }`}
          >
            {marketChangePct! > 0 ? "+" : ""}
            {marketChangePct!.toFixed(1)}%
          </p>
        </div>
      ) : null}
    </div>
  );
}
