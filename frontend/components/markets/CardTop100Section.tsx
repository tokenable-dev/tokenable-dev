"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTop100, useTop100Categories, type Top100Item } from "@/hooks/markets/usePokemonTop100";
import { ASSETS } from "@/constants/assets";
import {
  MARKET_RASTER_ICON_IMG,
  MARKET_RASTER_ICON_IMG_ACTIVE,
  MARKET_RASTER_ICON_IMG_NBA,
  MARKET_RASTER_ICON_IMG_NBA_ACTIVE,
} from "@/lib/market";

// ─── Known icon map (seed categories + any we have icons for) ───────────────

type TabConfig = {
  iconSrc?: string;
  isNbaStyle?: boolean;
};

const KNOWN_TAB_CONFIG: Record<string, TabConfig> = {
  Pokemon:    { iconSrc: ASSETS.icons.marketIndexPokemon },
  Baseball:   { iconSrc: ASSETS.icons.marketIndexMlb },
  Basketball: { iconSrc: ASSETS.icons.marketIndexNba, isNbaStyle: true },
  Football:   { iconSrc: ASSETS.icons.marketIndexNfl },
};

function tabConfig(category: string): TabConfig {
  return KNOWN_TAB_CONFIG[category] ?? {};
}

// ─── chip icon (mirrors CollectionCategoryFilterBar ChipIcon) ───────────────

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
          active ? "opacity-100" : "opacity-[0.78] group-hover:opacity-100 group-hover:grayscale-0 group-hover:saturate-100"
        }`}
      />
    </span>
  );
}

// ─── scrollable chip row (mirrors CollectionCategoryFilterBar scroll rail) ──

const CHIP_ROW =
  "mobile-scroll-x-contain flex w-full min-w-0 flex-nowrap items-stretch gap-2 scroll-smooth touch-pan-x snap-x snap-mandatory scroll-px-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden max-sm:gap-1.5 sm:gap-2.5";

const CHIP_BUTTON =
  "group inline-flex min-h-[28px] shrink-0 snap-start touch-manipulation items-center justify-center rounded-lg px-2 py-1 text-[12px] font-semibold tracking-tight transition-colors duration-200 ease-out hover:bg-zinc-800/45 hover:text-white active:scale-[0.985] active:text-white sm:min-h-[32px] sm:rounded-xl sm:px-3 sm:py-1.5 sm:text-[13px]";

const SCROLL_FADE =
  "pointer-events-none absolute inset-y-0 z-10 w-7 from-black via-black/80 to-transparent sm:w-9";

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
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const updateFades = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const overflow = el.scrollWidth > el.clientWidth + 2;
    setShowLeft(overflow && el.scrollLeft > 4);
    setShowRight(overflow && el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }, []);

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
    const el = scrollRef.current;
    if (!el) return;
    const btn = el.querySelector<HTMLButtonElement>(`[data-tab="${active}"]`);
    btn?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "smooth" });
  }, [active]);

  return (
    <div className="relative w-full min-w-0" role="toolbar" aria-label="Filter Top 100 by category">
      {showLeft && <div className={`${SCROLL_FADE} left-0 bg-gradient-to-r`} aria-hidden />}
      {showRight && <div className={`${SCROLL_FADE} right-0 bg-gradient-to-l`} aria-hidden />}
      <div ref={scrollRef} className={CHIP_ROW}>
        {categories.map((cat) => {
          const { iconSrc, isNbaStyle } = tabConfig(cat);
          const isActive = cat === active;
          return (
            <button
              key={cat}
              type="button"
              data-tab={cat}
              onClick={() => onChange(cat)}
              aria-pressed={isActive}
              className={`${CHIP_BUTTON} ${
                isActive
                  ? "bg-white/[0.06] text-white hover:bg-white/[0.09]"
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

// ─── helpers ────────────────────────────────────────────────────────────────

function resolveImageUrl(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.startsWith("//")) return `https:${raw}`;
  return raw;
}

function formatUsd(price: number): string {
  return price.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatFetchedAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── rank cell ──────────────────────────────────────────────────────────────

function RankCell({ rank }: { rank: number }) {
  if (rank === 1) return <span className="text-base">🥇</span>;
  if (rank === 2) return <span className="text-base">🥈</span>;
  if (rank === 3) return <span className="text-base">🥉</span>;
  return (
    <span className="font-mono text-xs tabular-nums text-zinc-500">{rank}</span>
  );
}

// ─── table row ──────────────────────────────────────────────────────────────

function CardTableRow({ item }: { item: Top100Item }) {
  const imgUrl = resolveImageUrl(item.image);

  const subParts: string[] = [];
  if (item.set) subParts.push(item.set);
  if (item.number) subParts.push(`#${item.number}`);
  if (item.variant) subParts.push(item.variant);
  const subText = subParts.join(" · ");

  return (
    <tr className="group border-b border-zinc-800/40 transition-colors hover:bg-zinc-900/50 last:border-b-0">
      {/* Rank */}
      <td className="w-9 py-2.5 pl-3 pr-1 text-center align-middle sm:w-10 sm:pl-4">
        <RankCell rank={item.rank} />
      </td>

      {/* Card image */}
      <td className="w-9 py-2 pr-2 align-middle sm:w-11">
        <div className="relative mx-auto h-[52px] w-9 overflow-hidden rounded-md bg-zinc-800 sm:h-[60px] sm:w-10">
          {imgUrl ? (
            <Image
              src={imgUrl}
              alt={item.description}
              fill
              className="object-contain"
              sizes="44px"
              unoptimized
            />
          ) : (
            <div className="h-full w-full bg-zinc-800" />
          )}
        </div>
      </td>

      {/* Card name + set */}
      <td className="min-w-0 py-2.5 pr-3 align-middle">
        <p
          className="line-clamp-1 text-[0.75rem] font-semibold leading-snug text-white sm:text-sm"
          title={item.description}
        >
          {item.player ?? item.description}
        </p>
        {subText ? (
          <p className="mt-0.5 line-clamp-1 text-[0.65rem] text-zinc-500 sm:text-[0.7rem]">
            {subText}
          </p>
        ) : null}
      </td>

      {/* Grade */}
      <td className="hidden py-2.5 pr-3 align-middle sm:table-cell">
        {item.grade ? (
          <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-[5px] border border-emerald-700/50 bg-emerald-950/60 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-400">
            {item.grade}
          </span>
        ) : null}
      </td>

      {/* 90d sales */}
      <td className="hidden py-2.5 pr-3 align-middle text-right tabular-nums md:table-cell">
        {item["90_day_sales"] != null ? (
          <span className="text-xs text-zinc-400">
            {item["90_day_sales"].toLocaleString()}
          </span>
        ) : (
          <span className="text-xs text-zinc-700">—</span>
        )}
      </td>

      {/* Price */}
      <td className="py-2.5 pr-3 align-middle text-right sm:pr-4">
        {item.priceNum != null ? (
          <span className="text-sm font-bold tabular-nums text-white sm:text-[0.9rem]">
            {formatUsd(item.priceNum)}
          </span>
        ) : (
          <span className="text-sm text-zinc-600">—</span>
        )}
      </td>
    </tr>
  );
}

// ─── skeleton ───────────────────────────────────────────────────────────────

function SkeletonRows({ count }: { count: number }) {
  return (
    <>
      {[...Array(count)].map((_, i) => (
        <tr key={i} className="border-b border-zinc-800/40 last:border-b-0">
          <td className="w-9 py-2.5 pl-3 pr-1 sm:w-10 sm:pl-4">
            <div className="mx-auto h-4 w-5 animate-pulse rounded bg-zinc-800" />
          </td>
          <td className="w-9 py-2 pr-2 sm:w-11">
            <div className="mx-auto h-[52px] w-9 animate-pulse rounded-md bg-zinc-800 sm:h-[60px] sm:w-10" />
          </td>
          <td className="py-2.5 pr-3">
            <div className="h-3 w-3/4 animate-pulse rounded bg-zinc-800" />
            <div className="mt-1.5 h-2.5 w-1/2 animate-pulse rounded bg-zinc-800/60" />
          </td>
          <td className="hidden py-2.5 pr-3 sm:table-cell">
            <div className="h-4 w-14 animate-pulse rounded bg-zinc-800/40" />
          </td>
          <td className="hidden py-2.5 pr-3 md:table-cell">
            <div className="ml-auto h-3 w-8 animate-pulse rounded bg-zinc-800/40" />
          </td>
          <td className="py-2.5 pr-3 sm:pr-4">
            <div className="ml-auto h-4 w-16 animate-pulse rounded bg-zinc-800" />
          </td>
        </tr>
      ))}
    </>
  );
}

// ─── table panel ────────────────────────────────────────────────────────────

function CardTable({
  label,
  items,
  loading,
}: {
  label: string;
  items: Top100Item[];
  loading: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800/60 bg-[#0d0d0d]">
      <div className="border-b border-zinc-800/50 px-3 py-2 sm:px-4">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
          {label}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[300px] border-collapse">
          <thead>
            <tr className="border-b border-zinc-800/50">
              <th className="w-9 py-2 pl-3 pr-1 text-center text-[10px] font-medium uppercase tracking-wider text-zinc-600 sm:w-10 sm:pl-4">
                #
              </th>
              <th className="w-9 py-2 pr-2 sm:w-11" aria-label="Image" />
              <th className="py-2 pr-3 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                Card
              </th>
              <th className="hidden py-2 pr-3 text-left text-[10px] font-medium uppercase tracking-wider text-zinc-600 sm:table-cell">
                Grade
              </th>
              <th className="hidden py-2 pr-3 text-right text-[10px] font-medium uppercase tracking-wider text-zinc-600 md:table-cell">
                90d Sales
              </th>
              <th className="py-2 pr-3 text-right text-[10px] font-medium uppercase tracking-wider text-zinc-600 sm:pr-4">
                90d Avg Price
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows count={15} />
            ) : (
              items.map((item) => (
                <CardTableRow key={item.card_id} item={item} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── tab panel ──────────────────────────────────────────────────────────────

function TabPanel({ category }: { category: Top100Category }) {
  const { data, isLoading, isError } = useTop100(category);
  const items = data?.items ?? [];

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
        No data yet. The daily cron job will populate this automatically.
      </div>
    );
  }

  const leftCol = items.slice(0, 50);
  const rightCol = items.slice(50, 100);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-4">
      <CardTable label="Rank 1 – 50" items={leftCol} loading={isLoading} />
      {(isLoading || rightCol.length > 0) && (
        <CardTable label="Rank 51 – 100" items={rightCol} loading={isLoading} />
      )}
    </div>
  );
}

// ─── section ────────────────────────────────────────────────────────────────

export function CardTop100Section() {
  const { data: categories = ["Pokemon", "Baseball", "Basketball", "Football"] } =
    useTop100Categories();

  const [activeTab, setActiveTab] = useState<string>("Pokemon");

  // If the active tab is no longer in the list (shouldn't happen), reset to first
  const effectiveTab =
    categories.includes(activeTab) ? activeTab : (categories[0] ?? "Pokemon");

  const { data } = useTop100(effectiveTab);

  return (
    <section className="mt-10 sm:mt-14">
      {/* Header */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2 sm:mb-5">
        <div>
          <h2 className="text-xl font-bold leading-tight tracking-tight text-white sm:text-3xl">
            Top 100 Cards
          </h2>
        </div>
        {data?.fetchedAt ? (
          <div className="flex shrink-0 flex-col items-end gap-0.5">
            <span className="text-[11px] text-zinc-600">
              Updated: {formatFetchedAt(data.fetchedAt)}
            </span>
            {data.stale && (
              <span className="text-[10px] text-amber-600">Cache expired</span>
            )}
          </div>
        ) : null}
      </div>

      {/* Tab bar — same chip style as Markets category filter */}
      <div className="mb-4 sm:mb-5">
        <TabBar categories={categories} active={effectiveTab} onChange={setActiveTab} />
      </div>

      {/* Content */}
      <TabPanel key={effectiveTab} category={effectiveTab} />
    </section>
  );
}
