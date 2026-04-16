"use client";

import type { CollectionCategoryFilterId } from "@/lib/collectionCategoryFilter";

const FILTERS: {
  id: CollectionCategoryFilterId;
  label: string;
  emoji?: string;
}[] = [
  { id: "all", label: "ALL" },
  { id: "pokemon", label: "Pokemon", emoji: "\uD83E\uDD81" },
  { id: "mlb", label: "MLB", emoji: "\u26BE" },
  { id: "nba", label: "NBA", emoji: "\uD83C\uDFC0" },
  { id: "nfl", label: "NFL", emoji: "\uD83C\uDFC8" },
  { id: "soccer", label: "Soccer", emoji: "\u26BD" },
  { id: "others", label: "Others" },
];

export function CollectionCategoryFilterBar({
  value,
  onChange,
}: {
  value: CollectionCategoryFilterId;
  onChange: (id: CollectionCategoryFilterId) => void;
}) {
  return (
    <div className="-mx-1 overflow-x-auto pb-1">
      <div className="flex min-w-min items-center gap-2 px-1 sm:gap-3">
        {FILTERS.map((f) => {
          const active = value === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onChange(f.id)}
              className={`shrink-0 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors sm:px-4 ${
                active
                  ? "border-mint-deep/40 bg-mint text-mint-ink shadow-sm shadow-mint/20"
                  : "border-gray-700/80 bg-[#141414] text-white hover:border-gray-600 hover:bg-[#1a1a1a]"
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                {f.emoji ? <span className="text-base leading-none">{f.emoji}</span> : null}
                {f.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
