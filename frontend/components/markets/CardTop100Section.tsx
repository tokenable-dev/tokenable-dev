"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useTop100, useTop100Categories, type Top100Item } from "@/hooks/markets/usePokemonTop100";
import { useTop100DayChanges } from "@/hooks/markets/useTop100DayChanges";
import type { Top100Category } from "@/lib/core/api/cardhedger";
import {
  formatTop100Usd,
  resolveTop100ImageUrl,
  top100CardSubText,
  top100CardTitle,
} from "@/lib/markets/top100CardDisplay";
import type { Top100DayChange } from "@/lib/markets/top100DayChanges";
import { top100CardDetailHref } from "@/lib/markets/top100CardDetailUrl";
import { TOP_CARDS_SECTION_TITLE } from "@/lib/markets/top100Copy";
import { Top100DayChangeBadge } from "./Top100DayChangeBadge";
import { ASSETS } from "@/constants/assets";
import {
  MARKET_RASTER_ICON_IMG,
  MARKET_RASTER_ICON_IMG_ACTIVE,
  MARKET_RASTER_ICON_IMG_NBA,
  MARKET_RASTER_ICON_IMG_NBA_ACTIVE,
} from "@/lib/market";

// ─── Known icon map ───────────────────────────────────────────────────────────

type TabConfig = {
  iconSrc?: string;
  isNbaStyle?: boolean;
};

const KNOWN_TAB_CONFIG: Record<string, TabConfig> = {
  Pokemon: { iconSrc: ASSETS.icons.marketIndexPokemon },
  Baseball: { iconSrc: ASSETS.icons.marketIndexMlb },
  Basketball: { iconSrc: ASSETS.icons.marketIndexNba, isNbaStyle: true },
  Football: { iconSrc: ASSETS.icons.marketIndexNfl },
};

function tabConfig(category: string): TabConfig {
  return KNOWN_TAB_CONFIG[category] ?? {};
}

// ─── chip icon ────────────────────────────────────────────────────────────────

function ChipIcon({
  src,
  isNbaStyle = false,
  active = false,
}: {
  src: string;
  isNbaStyle?: boolean;
  active?: boolean;
}) {
  const imgCls = isNbaStyle
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
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        width={18}
        height={18}
        className={`${imgCls} !max-h-none !max-w-none h-full w-full object-contain transition-[filter,opacity] duration-200 ${
          active
            ? "opacity-100"
            : "opacity-[0.78] group-hover:opacity-100 group-hover:grayscale-0 group-hover:saturate-100"
        }`}
      />
    </span>
  );
}

// ─── scrollable chip row ──────────────────────────────────────────────────────

const CHIP_ROW =
  "mobile-scroll-x-contain flex w-full min-w-0 flex-nowrap items-stretch gap-2 scroll-smooth touch-pan-x snap-x snap-mandatory scroll-px-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-sm:gap-1.5 sm:gap-2.5";

const CHIP_BUTTON =
  "group relative inline-flex min-h-[28px] shrink-0 snap-start touch-manipulation items-center justify-center rounded-lg px-2 py-1 text-[12px] font-semibold tracking-tight transition-[color,background-color,box-shadow,transform] duration-200 ease-out hover:bg-zinc-800/45 hover:text-white active:scale-[0.985] active:text-white sm:min-h-[32px] sm:rounded-xl sm:px-3 sm:py-1.5 sm:text-[13px]";

const SCROLL_FADE =
  "pointer-events-none absolute inset-y-0 z-10 w-7 from-black via-black/80 to-transparent sm:w-9";

function scrollChipIntoHorizontalRail(
  container: HTMLElement,
  chip: HTMLElement,
  behavior: ScrollBehavior = "smooth",
) {
  const chipLeft = chip.offsetLeft;
  const chipRight = chipLeft + chip.offsetWidth;
  const viewLeft = container.scrollLeft;
  const viewRight = viewLeft + container.clientWidth;
  if (chipLeft < viewLeft) {
    container.scrollTo({ left: chipLeft, behavior });
  } else if (chipRight > viewRight) {
    container.scrollTo({ left: chipRight - container.clientWidth, behavior });
  }
}

function TabBar({
  categories,
  active,
  onChange,
}: {
  categories: string[];
  active: string;
  onChange: (c: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const userChangedTabRef = useRef(false);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });

  const updateIndicator = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const btn = el.querySelector<HTMLButtonElement>(`[data-tab="${active}"]`);
    if (!btn) return;
    setIndicator({
      left: btn.offsetLeft,
      width: btn.offsetWidth,
    });
  }, [active]);

  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const overflow = el.scrollWidth > el.clientWidth + 2;
    setShowLeft(overflow && el.scrollLeft > 4);
    setShowRight(overflow && el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    updateIndicator();
  }, [updateIndicator]);

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
  }, [updateFades, categories.length]);

  useEffect(() => {
    if (!userChangedTabRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const btn = el.querySelector<HTMLButtonElement>(`[data-tab="${active}"]`);
    if (btn) scrollChipIntoHorizontalRail(el, btn);
  }, [active]);

  const handleTabChange = (cat: string) => {
    userChangedTabRef.current = true;
    onChange(cat);
  };

  return (
    <div className="relative w-full min-w-0" role="toolbar" aria-label="Filter by category">
      {showLeft && <div className={`${SCROLL_FADE} left-0 bg-gradient-to-r`} aria-hidden />}
      {showRight && <div className={`${SCROLL_FADE} right-0 bg-gradient-to-l`} aria-hidden />}
      <div ref={scrollRef} className={`${CHIP_ROW} relative pb-0.5`}>
        {indicator.width > 0 ? (
          <div
            className="pointer-events-none absolute bottom-0 z-0 h-[2px] rounded-full bg-mint shadow-[0_0_10px_rgba(16,211,51,0.55)] transition-[left,width] duration-300 ease-out"
            style={{ left: indicator.left, width: indicator.width }}
            aria-hidden
          />
        ) : null}
        {categories.map((cat) => {
          const { iconSrc, isNbaStyle } = tabConfig(cat);
          const isActive = cat === active;
          return (
            <button
              key={cat}
              type="button"
              data-tab={cat}
              onClick={() => handleTabChange(cat)}
              aria-pressed={isActive}
              className={`${CHIP_BUTTON} relative z-[1] ${
                isActive
                  ? "bg-mint/[0.08] text-white shadow-[0_0_20px_-12px_rgba(16,211,51,0.45)] hover:bg-mint/[0.11]"
                  : "bg-transparent text-zinc-400 [&_svg]:text-zinc-400"
              }`}
            >
              <span
                className={`inline-flex items-center gap-1 whitespace-nowrap leading-none sm:gap-1.5 ${
                  isActive ? "" : "group-hover:text-zinc-100"
                }`}
              >
                {iconSrc ? (
                  <ChipIcon src={iconSrc} isNbaStyle={isNbaStyle} active={isActive} />
                ) : null}
                {cat}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── helpers ──────────────────────────────────────────────────────────────────

const CARD_CLICKABLE =
  "block cursor-pointer no-underline outline-none transition-[border-color,background-color,box-shadow] focus-visible:ring-2 focus-visible:ring-mint/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black";

// ─── shared card image (unified with platform surfaces) ───────────────────────

const IMAGE_FRAME =
  "relative shrink-0 overflow-hidden rounded-xl border border-white/[0.08] bg-[#0d0d0d] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

const IMAGE_INNER_PAD = "relative h-full w-full px-[12%] pt-[8%] pb-[4%]";

const CARD_IMAGE_FILTER: CSSProperties = {
  filter: "saturate(1.04) contrast(1.02)",
};

function Top100CardImage({
  item,
  size = "row",
  embedded = false,
}: {
  item: Top100Item;
  size?: "row" | "podium" | "podiumHero";
  embedded?: boolean;
}) {
  const imgUrl = resolveTop100ImageUrl(item.image);
  const isPodium = size === "podium" || size === "podiumHero";
  const sizeClass =
    size === "podiumHero"
      ? "aspect-[3/4] w-full"
      : size === "podium"
        ? "aspect-[3/4] w-full"
        : "aspect-[3/4] w-11 sm:w-12";
  const frameClass = embedded
    ? "relative shrink-0 overflow-hidden bg-[#0d0d0d]"
    : `${IMAGE_FRAME} ${isPodium ? "rounded-2xl" : ""}`;

  return (
    <div className={`${frameClass} ${sizeClass}`}>
      {imgUrl ? (
        <div className={IMAGE_INNER_PAD}>
          <Image
            src={imgUrl}
            alt={item.description}
            fill
            className="object-contain"
            style={CARD_IMAGE_FILTER}
            sizes={
              size === "row"
                ? "48px"
                : size === "podiumHero"
                  ? "300px"
                  : "260px"
            }
            unoptimized
          />
        </div>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-zinc-900/80">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-700">
            No img
          </span>
        </div>
      )}
    </div>
  );
}

// ─── rank badge ───────────────────────────────────────────────────────────────

function RankBadge({
  rank,
  size = "sm",
}: {
  rank: number;
  size?: "sm" | "lg";
}) {
  const base =
    size === "lg"
      ? "flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold tabular-nums sm:h-10 sm:w-10 sm:text-base"
      : "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold tabular-nums sm:h-8 sm:w-8";

  if (rank === 1) {
    return (
      <span
        className={`${base} border border-mint/50 bg-mint/15 text-mint shadow-[0_0_18px_-8px_rgba(16,211,51,0.65)]`}
      >
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className={`${base} border border-white/20 bg-white/[0.06] text-zinc-200`}>2</span>
    );
  }
  if (rank === 3) {
    return (
      <span className={`${base} border border-amber-500/30 bg-amber-500/[0.08] text-amber-300/90`}>
        3
      </span>
    );
  }
  return (
    <span className={`${base} border border-white/[0.06] bg-black/40 font-mono text-zinc-500`}>
      {rank}
    </span>
  );
}

function GradeBadge({ grade }: { grade: string | null }) {
  if (!grade) return null;
  return (
    <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-[5px] border border-mint/25 bg-mint/[0.08] px-1.5 py-0.5 text-[10px] font-semibold text-mint/90">
      {grade}
    </span>
  );
}

const PODIUM_IMAGE_WIDTH = {
  hero: "w-[min(252px,70vw)] sm:w-60 md:w-64",
  default: "w-[min(220px,62vw)] sm:w-52 md:w-56",
} as const;

const PODIUM_TEXT_WIDTH = {
  hero: "w-[min(292px,82vw)] sm:w-72 md:w-80",
  default: "w-[min(264px,76vw)] sm:w-64 md:w-72",
} as const;

const PODIUM_SHELL_STYLE = {
  gold: "border-mint/30 shadow-[0_0_36px_-18px_rgba(16,211,51,0.4)]",
  silver: "border-white/14",
  bronze: "border-amber-500/22",
} as const;

const PODIUM_RANK_THEME = {
  1: {
    header: "bg-gradient-to-r from-mint/[0.2] via-mint/[0.07] to-[#0d0d0d]",
    rankCell: "bg-mint/25",
    rankText: "text-lg font-bold text-mint sm:text-xl",
    gradeText: "font-semibold text-mint/90",
  },
  2: {
    header: "bg-gradient-to-r from-white/[0.14] via-white/[0.05] to-[#0d0d0d]",
    rankCell: "bg-white/[0.1]",
    rankText: "text-base font-bold text-zinc-100 sm:text-lg",
    gradeText: "font-semibold text-zinc-300",
  },
  3: {
    header: "bg-gradient-to-r from-amber-500/[0.16] via-amber-500/[0.05] to-[#0d0d0d]",
    rankCell: "bg-amber-500/[0.12]",
    rankText: "text-base font-bold text-amber-300 sm:text-lg",
    gradeText: "font-semibold text-amber-200/85",
  },
} as const;

function PodiumSlotMetaBar({ rank, grade }: { rank: 1 | 2 | 3; grade: string | null }) {
  const theme = PODIUM_RANK_THEME[rank];

  return (
    <div
      className={`flex w-full items-stretch ${theme.header}`}
      aria-label={grade ? `Rank ${rank}, ${grade}` : `Rank ${rank}`}
    >
      <span
        className={`flex min-w-[2.75rem] shrink-0 items-center justify-center px-3 py-2 sm:min-w-[3rem] sm:px-3.5 sm:py-2.5 ${theme.rankCell}`}
      >
        <span className={`tabular-nums leading-none ${theme.rankText}`}>{rank}</span>
      </span>
      {grade ? (
        <span className="flex min-w-0 flex-1 items-center px-3 py-2 sm:px-3.5 sm:py-2.5">
          <span className={`truncate text-xs sm:text-sm ${theme.gradeText}`}>{grade}</span>
        </span>
      ) : null}
    </div>
  );
}

// ─── podium stage (open layout — no card boxes) ───────────────────────────────

function PodiumSlot({
  item,
  category,
  accent,
  hero = false,
  dayChange,
  dayChangeLoading = false,
}: {
  item: Top100Item;
  category: string;
  accent: keyof typeof PODIUM_SHELL_STYLE;
  hero?: boolean;
  dayChange?: Top100DayChange;
  dayChangeLoading?: boolean;
}) {
  const rank = item.rank as 1 | 2 | 3;
  const subText = top100CardSubText(item);

  const imageWidth = hero ? PODIUM_IMAGE_WIDTH.hero : PODIUM_IMAGE_WIDTH.default;
  const textWidth = hero ? PODIUM_TEXT_WIDTH.hero : PODIUM_TEXT_WIDTH.default;

  return (
    <Link
      href={top100CardDetailHref(item, category)}
      className="flex min-w-0 cursor-pointer flex-col items-center text-center no-underline outline-none focus-visible:ring-2 focus-visible:ring-mint/40 focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      <div
        className={`mx-auto overflow-hidden rounded-2xl border bg-[#0d0d0d] ${PODIUM_SHELL_STYLE[accent]} ${imageWidth}`}
      >
        <PodiumSlotMetaBar rank={rank} grade={item.grade} />
        <Top100CardImage item={item} size={hero ? "podiumHero" : "podium"} embedded />
      </div>

      <div className={`mt-3 w-full ${textWidth}`}>
        <h3
          className="line-clamp-2 text-sm font-bold leading-snug text-white sm:text-base"
          title={top100CardTitle(item)}
        >
          {top100CardTitle(item)}
        </h3>
        {subText ? (
          <p className="mt-1.5 line-clamp-1 text-xs font-medium text-white sm:text-sm">{subText}</p>
        ) : null}
        {item["90_day_sales"] != null ? (
          <p className="mt-2 text-xs tabular-nums text-white sm:text-sm">
            {item["90_day_sales"].toLocaleString()} sales
          </p>
        ) : null}
        <p className="mt-2.5 text-base font-bold tabular-nums text-white sm:text-lg">
          {item.priceNum != null ? formatTop100Usd(item.priceNum) : "—"}
        </p>
        <div className="mt-1 flex min-h-[1rem] justify-center">
          <Top100DayChangeBadge
            change={dayChange}
            loading={dayChangeLoading}
            variant="compact"
          />
        </div>
      </div>
    </Link>
  );
}

function PodiumSkeleton() {
  const slots = [
    { rank: 1, hero: true, order: "order-1 sm:order-2" },
    { rank: 2, hero: false, order: "order-2 sm:order-1" },
    { rank: 3, hero: false, order: "order-3" },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-6xl px-1 sm:px-2">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:items-end sm:gap-4 md:gap-6">
        {slots.map(({ rank, hero, order }) => (
          <div key={rank} className={`flex animate-pulse flex-col items-center ${order}`}>
            <div
              className={`overflow-hidden rounded-2xl border border-zinc-800/70 bg-[#0d0d0d] ${
                hero ? PODIUM_IMAGE_WIDTH.hero : PODIUM_IMAGE_WIDTH.default
              }`}
            >
              <div className="flex h-9 sm:h-10">
                <div className="w-11 bg-zinc-800/90 sm:w-12" />
                <div className="flex-1 bg-zinc-800/50" />
              </div>
              <div className="aspect-[3/4] w-full bg-zinc-800" />
            </div>
            <div
              className={`mt-3 h-4 w-full rounded bg-zinc-800 ${
                hero ? PODIUM_TEXT_WIDTH.hero : PODIUM_TEXT_WIDTH.default
              }`}
            />
            <div className="mx-auto mt-2 h-5 w-2/3 max-w-[9rem] rounded bg-zinc-800/70" />
          </div>
        ))}
      </div>
    </div>
  );
}

function Top3Podium({
  items,
  category,
  loading,
  getDayChange,
  dayChangeLoading = false,
}: {
  items: Top100Item[];
  category: string;
  loading: boolean;
  getDayChange: (cardId: string) => Top100DayChange | undefined;
  dayChangeLoading?: boolean;
}) {
  if (loading) return <PodiumSkeleton />;

  const first = items[0];
  const second = items[1];
  const third = items[2];
  if (!first) return null;

  return (
    <div className="mx-auto w-full max-w-6xl px-1 sm:px-2">
      <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:items-end sm:gap-4 md:gap-6">
        {second ? (
          <div className="order-2 sm:order-1">
            <PodiumSlot
              item={second}
              category={category}
              accent="silver"
              dayChange={getDayChange(second.card_id)}
              dayChangeLoading={dayChangeLoading}
            />
          </div>
        ) : (
          <div className="hidden sm:order-1 sm:block" aria-hidden />
        )}
        <div className="order-1 sm:order-2">
          <PodiumSlot
            item={first}
            category={category}
            hero
            accent="gold"
            dayChange={getDayChange(first.card_id)}
            dayChangeLoading={dayChangeLoading}
          />
        </div>
        {third ? (
          <div className="order-3">
            <PodiumSlot
              item={third}
              category={category}
              accent="bronze"
              dayChange={getDayChange(third.card_id)}
              dayChangeLoading={dayChangeLoading}
            />
          </div>
        ) : (
          <div className="hidden sm:order-3 sm:block" aria-hidden />
        )}
      </div>
    </div>
  );
}

// ─── leaderboard row ──────────────────────────────────────────────────────────

function LeaderboardCardRow({
  item,
  category,
  dayChange,
  dayChangeLoading = false,
}: {
  item: Top100Item;
  category: string;
  dayChange?: Top100DayChange;
  dayChangeLoading?: boolean;
}) {
  const subText = top100CardSubText(item);

  return (
    <Link
      href={top100CardDetailHref(item, category)}
      className={`group flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-[#0d0d0d] px-2.5 py-2.5 duration-200 hover:border-white/[0.1] hover:bg-[#121212] hover:shadow-[0_8px_24px_-18px_rgba(0,0,0,0.9)] sm:gap-3 sm:px-3 sm:py-3 ${CARD_CLICKABLE}`}
    >
      <RankBadge rank={item.rank} />
      <Top100CardImage item={item} size="row" />
      <div className="min-w-0 flex-1">
        <p
          className="line-clamp-1 text-[0.8rem] font-semibold leading-snug text-white sm:text-sm"
          title={top100CardTitle(item)}
        >
          {top100CardTitle(item)}
        </p>
        {subText ? (
          <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500">{subText}</p>
        ) : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 sm:hidden">
          <GradeBadge grade={item.grade} />
          {item["90_day_sales"] != null ? (
            <span className="text-[10px] tabular-nums text-zinc-500">
              {item["90_day_sales"].toLocaleString()} sales
            </span>
          ) : null}
        </div>
      </div>
      <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
        <GradeBadge grade={item.grade} />
        {item["90_day_sales"] != null ? (
          <span className="text-[10px] tabular-nums text-zinc-500">
            {item["90_day_sales"].toLocaleString()} sales
          </span>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        {item.priceNum != null ? (
          <span className="text-sm font-bold tabular-nums text-white sm:text-[0.95rem]">
            {formatTop100Usd(item.priceNum)}
          </span>
        ) : (
          <span className="text-sm text-zinc-600">—</span>
        )}
        <div className="mt-0.5 flex justify-end">
          <Top100DayChangeBadge
            change={dayChange}
            loading={dayChangeLoading}
            variant="compact"
          />
        </div>
      </div>
    </Link>
  );
}

function LeaderboardSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className="flex animate-pulse items-center gap-3 rounded-xl border border-zinc-800/50 bg-[#0d0d0d] px-3 py-3"
        >
          <div className="h-8 w-8 rounded-lg bg-zinc-800" />
          <div className="aspect-[3/4] w-11 rounded-xl bg-zinc-800" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 rounded bg-zinc-800" />
            <div className="h-2.5 w-1/2 rounded bg-zinc-800/60" />
          </div>
          <div className="h-4 w-16 rounded bg-zinc-800" />
        </div>
      ))}
    </div>
  );
}

function LeaderboardColumn({
  label,
  items,
  category,
  loading,
  getDayChange,
  dayChangeLoading = false,
}: {
  label: string;
  items: Top100Item[];
  category: string;
  loading: boolean;
  getDayChange: (cardId: string) => Top100DayChange | undefined;
  dayChangeLoading?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-2.5 flex items-center justify-between px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-600">
          {label}
        </span>
        {!loading && items.length > 0 ? (
          <span className="text-[10px] tabular-nums text-zinc-700">{items.length} cards</span>
        ) : null}
      </div>
      {loading ? (
        <LeaderboardSkeleton count={12} />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <LeaderboardCardRow
              key={item.card_id}
              item={item}
              category={category}
              dayChange={getDayChange(item.card_id)}
              dayChangeLoading={dayChangeLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function top100FullHref(category: string): string {
  return `/markets/top100?category=${encodeURIComponent(category)}`;
}

function ViewFullTop100Cta({
  category,
}: {
  category: string;
}) {
  return (
    <div className="flex flex-col items-center gap-2 pt-1 sm:pt-2">
      <Link
        href={top100FullHref(category)}
        className="group inline-flex w-full max-w-md items-center justify-center gap-2 rounded-xl border border-mint/30 bg-mint/[0.06] px-5 py-3.5 text-sm font-semibold text-mint transition-[border-color,background-color,box-shadow] duration-200 hover:border-mint/45 hover:bg-mint/[0.1] hover:shadow-[0_0_28px_-14px_rgba(16,211,51,0.45)] sm:py-4"
      >
        View all
        <span
          className="transition-transform duration-200 group-hover:translate-x-0.5"
          aria-hidden
        >
          →
        </span>
      </Link>
    </div>
  );
}

// ─── tab panel ────────────────────────────────────────────────────────────────

function TabPanel({
  category,
  variant,
}: {
  category: Top100Category;
  variant: "preview" | "full";
}) {
  const { data, isLoading, isError } = useTop100(category);
  const items = data?.items ?? [];
  const dayChangesQuery = useTop100DayChanges(category, items);
  const dayChanges = dayChangesQuery.data;
  const getDayChange = (cardId: string) => dayChanges?.byCardId.get(cardId);

  if (isError) {
    return (
      <div className="rounded-xl border border-red-900/40 bg-red-950/20 px-4 py-4 text-sm text-red-400">
        Failed to load data. Please check that the backend is running.
      </div>
    );
  }

  if (!isLoading && items.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800/60 bg-[#0d0d0d] px-4 py-8 text-center text-sm text-zinc-500">
        No data yet.
      </div>
    );
  }

  const podiumItems = items.slice(0, 3);
  const rest = items.slice(3);
  const leftCol = rest.slice(0, 47);
  const rightCol = rest.slice(47);

  const podium = (
    <Top3Podium
      items={podiumItems}
      category={category}
      loading={isLoading}
      getDayChange={getDayChange}
      dayChangeLoading={dayChangesQuery.isLoading}
    />
  );

  if (variant === "preview") {
    return (
      <>
        <div className="space-y-5 sm:space-y-6">
          {podium}
          <ViewFullTop100Cta category={category} />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-5 sm:space-y-6">
        {podium}

        {(isLoading || rest.length > 0) && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-5">
            <LeaderboardColumn
              label="Rank 4 – 50"
              items={leftCol}
              category={category}
              loading={isLoading}
              getDayChange={getDayChange}
              dayChangeLoading={dayChangesQuery.isLoading}
            />
            {(isLoading || rightCol.length > 0) && (
              <LeaderboardColumn
                label="Rank 51 – 100"
                items={rightCol}
                category={category}
                loading={isLoading}
                getDayChange={getDayChange}
                dayChangeLoading={dayChangesQuery.isLoading}
              />
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── section ────────────────────────────────────────────────────────────────

export function CardTop100Section({
  variant = "preview",
  initialCategory,
}: {
  variant?: "preview" | "full";
  initialCategory?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: categories = ["Pokemon", "Baseball", "Basketball", "Football"] } =
    useTop100Categories();

  const categoryFromUrl = searchParams.get("category") ?? undefined;
  const resolvedInitial =
    initialCategory ?? categoryFromUrl ?? categories[0] ?? "Pokemon";

  const [activeTab, setActiveTab] = useState<string>(resolvedInitial);

  useEffect(() => {
    const next =
      initialCategory ?? categoryFromUrl ?? categories[0] ?? "Pokemon";
    if (categories.includes(next)) {
      setActiveTab(next);
    }
  }, [initialCategory, categoryFromUrl, categories]);

  const effectiveTab =
    categories.includes(activeTab) ? activeTab : (categories[0] ?? "Pokemon");

  const handleTabChange = (cat: string) => {
    setActiveTab(cat);
    if (variant === "full") {
      const params = new URLSearchParams(searchParams.toString());
      params.set("category", cat);
      router.replace(`/markets/top100?${params.toString()}`, { scroll: false });
    }
  };

  const isFull = variant === "full";

  return (
    <section className={isFull ? "" : "mb-10 sm:mb-12"}>
      <div className="mb-4 sm:mb-5">
        {isFull ? (
          <h1 className="text-xl font-bold leading-snug tracking-tight text-white sm:text-2xl lg:text-3xl">
            {TOP_CARDS_SECTION_TITLE}
          </h1>
        ) : (
          <h2 className="text-lg font-bold leading-snug tracking-tight text-white sm:text-2xl lg:text-3xl">
            {TOP_CARDS_SECTION_TITLE}
          </h2>
        )}
      </div>

      <div className="mb-4 sm:mb-5">
        <TabBar categories={categories} active={effectiveTab} onChange={handleTabChange} />
      </div>

      <div key={effectiveTab} className="markets-tab-panel-enter">
        <TabPanel category={effectiveTab} variant={variant} />
      </div>
    </section>
  );
}
