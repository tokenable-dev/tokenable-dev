"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ASSETS } from "@/constants/assets";
import {
  MARKET_RASTER_ICON_IMG,
  MARKET_RASTER_ICON_IMG_ACTIVE,
  MARKET_RASTER_ICON_IMG_NBA,
  MARKET_RASTER_ICON_IMG_NBA_ACTIVE,
} from "@/lib/market";
import {
  DEFAULT_CATEGORY_FILTERS,
  type CategoryFilterOption,
  type CollectionCategoryFilterId,
} from "@/lib/market";

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

function ChipIcon({
  src,
  nba,
  active = false,
}: {
  src: string;
  nba: boolean;
  active?: boolean;
}) {
  const imgCls = nba
    ? active
      ? MARKET_RASTER_ICON_IMG_NBA_ACTIVE
      : MARKET_RASTER_ICON_IMG_NBA
    : active
      ? MARKET_RASTER_ICON_IMG_ACTIVE
      : MARKET_RASTER_ICON_IMG;
  return (
    <span
      className="flex h-4 w-4 shrink-0 items-center justify-center overflow-hidden [&_img]:shrink-0 sm:h-[18px] sm:w-[18px]"
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- small raster from /public */}
      <img
        src={src}
        alt=""
        width={18}
        height={18}
        className={`${imgCls} !max-h-none !max-w-none h-full w-full object-contain transition-[filter,opacity] duration-200 ${
          active ? "opacity-100" : "opacity-[0.78] group-hover:opacity-100 group-hover:grayscale-0 group-hover:saturate-100"
        }`}
      />
    </span>
  );
}

const CATEGORY_CHIP_ROW =
  "mobile-scroll-x-contain flex w-full min-w-0 flex-nowrap items-stretch gap-2 scroll-smooth touch-pan-x snap-x snap-mandatory scroll-px-3 pr-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-sm:gap-1.5 sm:gap-2.5 sm:scroll-px-4 sm:pr-4";

const CATEGORY_CHIP_BUTTON =
  "group inline-flex min-h-[28px] shrink-0 snap-start touch-manipulation items-center justify-center rounded-lg px-2 py-1 text-[12px] font-semibold tracking-tight transition-colors duration-200 ease-out hover:bg-zinc-800/45 hover:text-white active:scale-[0.985] active:text-white sm:min-h-[32px] sm:rounded-xl sm:px-3 sm:py-1.5 sm:text-[13px]";

const SCROLL_FADE =
  "pointer-events-none absolute inset-y-0 z-10 w-7 from-black via-black/80 to-transparent sm:w-9";

function CategoryFilterScrollRail({
  scrollRef,
  itemCount,
  children,
}: {
  scrollRef: RefObject<HTMLDivElement | null>;
  itemCount: number;
  children: ReactNode;
}) {
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const overflow = el.scrollWidth > el.clientWidth + 2;
    setShowLeftFade(overflow && el.scrollLeft > 4);
    setShowRightFade(overflow && el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateFades();
    el.addEventListener("scroll", updateFades, { passive: true });
    const ro = new ResizeObserver(updateFades);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateFades);
      ro.disconnect();
    };
  }, [updateFades, itemCount, scrollRef]);

  return (
    <div className="relative min-w-0 w-full">
      {showLeftFade ? (
        <div className={`${SCROLL_FADE} left-0 bg-gradient-to-r`} aria-hidden />
      ) : null}
      {showRightFade ? (
        <div className={`${SCROLL_FADE} right-0 bg-gradient-to-l`} aria-hidden />
      ) : null}
      <div ref={scrollRef} className={CATEGORY_CHIP_ROW}>
        {children}
      </div>
    </div>
  );
}

export function CollectionCategoryFilterBar({
  value,
  onChange,
  filters = DEFAULT_CATEGORY_FILTERS,
  toolbarAriaLabel = "Filter by card category",
}: {
  value: CollectionCategoryFilterId;
  onChange: (id: CollectionCategoryFilterId) => void;
  filters?: CategoryFilterOption[];
  toolbarAriaLabel?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const btn = el.querySelector<HTMLButtonElement>(`[data-category-id="${value}"]`);
    btn?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [value, filters.length]);

  return (
    <div className="w-full min-w-0" role="toolbar" aria-label={toolbarAriaLabel}>
      <CategoryFilterScrollRail scrollRef={scrollRef} itemCount={filters.length}>
        {filters.map((f) => {
          const active = value === f.id;
          const iconSrc = categoryFilterIconSrc(f.id);
          return (
            <button
              key={f.id}
              type="button"
              data-category-id={f.id}
              onClick={() => onChange(f.id)}
              aria-pressed={active}
              className={`${CATEGORY_CHIP_BUTTON} ${
                active
                  ? "bg-white/[0.06] text-white hover:bg-white/[0.09]"
                  : "bg-transparent text-zinc-400 [&_svg]:text-zinc-400"
              }`}
            >
              <span
                className={`inline-flex items-center whitespace-nowrap leading-none ${
                  iconSrc ? "gap-1 sm:gap-1.5" : "px-0.5"
                } ${active ? "" : "group-hover:text-zinc-100"}`}
              >
                {iconSrc ? <ChipIcon src={iconSrc} nba={f.id === "nba"} active={active} /> : null}
                {f.label}
              </span>
            </button>
          );
        })}
      </CategoryFilterScrollRail>
    </div>
  );
}
