"use client";

import { ASSETS } from "@/constants/assets";
import {
  MARKET_RASTER_ICON_IMG,
  MARKET_RASTER_ICON_IMG_NBA,
} from "@/lib/market";
import type { CollectionCategoryFilterId } from "@/lib/market";

const FILTERS: { id: CollectionCategoryFilterId; label: string }[] = [
  { id: "all", label: "ALL" },
  { id: "pokemon", label: "Pokemon" },
  { id: "mlb", label: "MLB" },
  { id: "nba", label: "NBA" },
  { id: "nfl", label: "NFL" },
  { id: "soccer", label: "Soccer" },
  { id: "others", label: "Others" },
];

function categoryFilterIconSrc(id: CollectionCategoryFilterId): string | undefined {
  switch (id) {
    case "pokemon":
      return ASSETS.icons.marketIndexPokemon;
    case "mlb":
      return ASSETS.icons.marketIndexMlb;
    case "nba":
      return ASSETS.icons.marketIndexNba;
    case "nfl":
      return ASSETS.icons.marketIndexNfl;
    case "soccer":
      return ASSETS.icons.marketIndexSoccer;
    default:
      return undefined;
  }
}

/** Chip icons: tight box aligned to glyph size (avoid hero-sized MARKET_RASTER_ICON_FRAME). */
function ChipIcon({
  src,
  nba,
}: {
  src: string;
  nba: boolean;
}) {
  const imgCls = nba ? MARKET_RASTER_ICON_IMG_NBA : MARKET_RASTER_ICON_IMG;
  return (
    <span
      className="flex h-[22px] w-[22px] shrink-0 items-center justify-center sm:h-6 sm:w-6"
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- small raster from /public */}
      <img src={src} alt="" width={24} height={24} className={`${imgCls} !max-h-none !max-w-none h-full w-full`} />
    </span>
  );
}

export function CollectionCategoryFilterBar({
  value,
  onChange,
}: {
  value: CollectionCategoryFilterId;
  onChange: (id: CollectionCategoryFilterId) => void;
}) {
  return (
    <div className="-mx-1 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
      <div className="flex min-w-min items-center gap-2.5 px-1 sm:gap-3">
        {FILTERS.map((f) => {
          const active = value === f.id;
          const iconSrc = categoryFilterIconSrc(f.id);
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => onChange(f.id)}
              className={`inline-flex min-h-[42px] shrink-0 items-center justify-center rounded-xl border px-3.5 py-2 text-[13px] font-semibold tracking-tight transition-all duration-200 sm:min-h-[44px] sm:px-4 sm:py-2.5 sm:text-sm ${
                active
                  ? "border-mint/50 bg-mint text-mint-ink shadow-[0_0_0_1px_rgba(148,255,212,0.12)] shadow-mint/25"
                  : "border-zinc-700/70 bg-zinc-950/80 text-zinc-100 hover:border-zinc-500/60 hover:bg-zinc-900/90 hover:text-white"
              }`}
            >
              <span
                className={`inline-flex items-center gap-2.5 sm:gap-3 ${
                  iconSrc ? "" : "px-0.5"
                }`}
              >
                {iconSrc ? <ChipIcon src={iconSrc} nba={f.id === "nba"} /> : null}
                <span className="whitespace-nowrap leading-none">{f.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
