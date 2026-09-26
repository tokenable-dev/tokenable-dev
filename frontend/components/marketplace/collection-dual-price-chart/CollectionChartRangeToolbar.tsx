"use client";

import type { ChartRangeOption } from "@/lib/marketplace/collection-dual-price-chart";

export function CollectionChartRangeToolbar({
  options,
  value,
  onChange,
  className = "",
}: {
  options: readonly ChartRangeOption[];
  value: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Chart time range"
      className={[
        "inline-flex max-w-full items-center gap-0.5 rounded-md bg-white/[0.04] p-0.5",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            aria-pressed={active}
            className={`touch-manipulation rounded-md px-2 py-1 text-[10px] font-semibold tracking-wide transition-colors sm:px-2.5 sm:text-xs ${
              active
                ? "bg-mint/15 text-mint shadow-[inset_0_0_0_1px_rgba(16,211,51,0.35)]"
                : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
