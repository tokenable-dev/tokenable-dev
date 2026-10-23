"use client";

import { formatUsdCompact } from "@/lib/market";
import { ADMIN_TEXT_BODY, ADMIN_TEXT_META } from "./adminUi";

const CHIP =
  "rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2";

export function AdminMarketPriceStrip({
  askUsd,
  refUsd,
  floorUsd,
  compact,
}: {
  askUsd?: number | null;
  refUsd?: number | null;
  floorUsd?: number | null;
  compact?: boolean;
}) {
  const chips = [
    askUsd !== undefined ? { label: "Ask", value: askUsd } : null,
    { label: "Ref", value: refUsd },
    { label: "Floor", value: floorUsd },
  ].filter((c): c is { label: string; value: number | null | undefined } => c != null);

  if (compact) {
    return (
      <div className="flex flex-wrap gap-2">
        {chips.map(({ label, value }) => (
          <div key={label} className={CHIP}>
            <span className={`text-[10px] font-medium ${ADMIN_TEXT_META}`}>{label}</span>
            <p className={`text-sm font-semibold ${ADMIN_TEXT_BODY}`}>{formatUsdCompact(value)}</p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2 sm:gap-3">
      {chips.map(({ label, value }) => (
        <div key={label} className={`min-w-[5rem] ${CHIP} sm:min-w-[5.5rem] sm:px-4 sm:py-3`}>
          <span className={`text-xs font-medium ${ADMIN_TEXT_META}`}>{label}</span>
          <p className={`mt-0.5 text-base font-semibold sm:text-lg ${ADMIN_TEXT_BODY}`}>
            {formatUsdCompact(value)}
          </p>
        </div>
      ))}
    </div>
  );
}
