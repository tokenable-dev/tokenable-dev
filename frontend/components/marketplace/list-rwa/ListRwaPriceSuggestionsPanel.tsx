"use client";

import type { CollectionPlatformTapeFill } from "@/lib/core";
import { useListRwaPriceSuggestions } from "@/hooks/list-rwa/useListRwaPriceSuggestions";
import { formatUsdCompact } from "@/lib/market";
import {
  formatTapeDate,
  formatTapeTimeFull,
  formatTradesTapePriceUsdc,
  tapeSideDisplay,
  tapeSourceDisplay,
} from "@/lib/marketplace/unified-order-book";
import { TradeSourceMark } from "@/components/marketplace/unified-order-book/TradeSourceMark";

function SuggestionRow({
  label,
  valueUsd,
  onUse,
  disabled,
}: {
  label: string;
  valueUsd: number;
  onUse?: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          {label}
        </p>
        <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-[#87FF48]">
          {formatUsdCompact(valueUsd)}
        </p>
      </div>
      {onUse ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onUse(valueUsd.toFixed(2))}
          className="shrink-0 rounded-lg border border-mint/35 bg-mint/[0.08] px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-mint transition-colors hover:bg-mint/[0.14] disabled:opacity-50"
        >
          Use
        </button>
      ) : null}
    </div>
  );
}

function CompactTradeRow({ row }: { row: CollectionPlatformTapeFill }) {
  const side = tapeSideDisplay(row);
  const source = tapeSourceDisplay(row);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 border-b border-zinc-800/50 py-2 text-[11px] last:border-b-0">
      <span className="min-w-0 truncate font-mono tabular-nums text-zinc-100">
        {formatTradesTapePriceUsdc(row.priceUsdc)}
      </span>
      <span className="truncate text-zinc-500">{side.label}</span>
      <span className="flex min-w-0 items-center justify-center gap-1.5 truncate text-zinc-500">
        <TradeSourceMark source={source} compact />
        <span className="truncate" title={formatTapeTimeFull(row.t)}>
          {formatTapeDate(row.t)}
        </span>
      </span>
    </div>
  );
}

export function ListRwaPriceSuggestionsPanel({
  tokenId,
  collectionKey,
  onApplyPrice,
  disabled,
}: {
  tokenId: number;
  collectionKey?: string | null;
  onApplyPrice: (value: string) => void;
  disabled?: boolean;
}) {
  const suggestions = useListRwaPriceSuggestions({
    tokenId,
    collectionKey,
    enabled: true,
  });

  return (
    <div className="space-y-2 rounded-xl border border-zinc-700/55 bg-zinc-900/50 px-3 py-3">
      {suggestions.loading ? (
        <p className="text-xs text-zinc-500" role="status" aria-live="polite">
          Loading market references…
        </p>
      ) : !suggestions.hasAnyReference ? (
        <p className="text-xs leading-relaxed text-zinc-500">
          No recent sales or listings found for this card yet.
        </p>
      ) : (
        <>
          <div className="space-y-2.5">
            {suggestions.marketPriceUsd != null ? (
              <SuggestionRow
                label={
                  suggestions.gradeLabel
                    ? `Market price (${suggestions.gradeLabel})`
                    : "Market price"
                }
                valueUsd={suggestions.marketPriceUsd}
                onUse={onApplyPrice}
                disabled={disabled}
              />
            ) : null}
            {suggestions.lastTokenableTradeUsd != null ? (
              <SuggestionRow
                label="Last Tokenable sale"
                valueUsd={suggestions.lastTokenableTradeUsd}
                onUse={onApplyPrice}
                disabled={disabled}
              />
            ) : null}
          </div>

          {suggestions.recentTrades.length > 0 ? (
            <div>
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Recent sales
              </p>
              <div className="max-h-36 overflow-y-auto pr-0.5">
                {suggestions.recentTrades.map((row, index) => (
                  <CompactTradeRow
                    key={`${row.t}-${row.priceUsdc}-${row.orderHash}-${index}`}
                    row={row}
                  />
                ))}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
