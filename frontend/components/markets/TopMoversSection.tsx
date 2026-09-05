"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTop100Categories } from "@/hooks/markets/usePokemonTop100";
import { useTopMovers, type TopMoverItem } from "@/hooks/markets/useTopMovers";
import {
  formatTop100Usd,
  resolveTop100ImageUrl,
  top100CardSubText,
  top100CardTitle,
} from "@/lib/markets/top100CardDisplay";
import {
  MARKETS_TOP100_ROUTING,
  type Top100Routing,
} from "@/lib/markets/top100Routing";
import {
  TOP_MOVERS_PREVIEW_COUNT,
  TOP_MOVERS_SECTION_TITLE,
} from "@/lib/markets/top100Copy";
import { formatSportCategoryDisplayLabel } from "@/lib/market/sportCategoryDisplay";
import { AppPageState } from "@/components/ui/AppPageState";
import { CARD_DISPLAY_LINE1_CLAMP_CLASS } from "@/components/marketplace/marketplace-shared";
import { ASSETS } from "@/constants/assets";
import {
  MARKET_RASTER_ICON_IMG,
  MARKET_RASTER_ICON_IMG_ACTIVE,
  MARKET_RASTER_ICON_IMG_NBA,
  MARKET_RASTER_ICON_IMG_NBA_ACTIVE,
} from "@/lib/market";

const TOP100_CATEGORY_SORT_ORDER: Record<string, number> = {
  Pokemon: 0,
  Basketball: 1,
  Baseball: 2,
  Football: 3,
};

function sortCategories(categories: string[]): string[] {
  return [...categories].sort(
    (a, b) =>
      (TOP100_CATEGORY_SORT_ORDER[a] ?? 99) - (TOP100_CATEGORY_SORT_ORDER[b] ?? 99),
  );
}

function formatGainPct(gain: number): string {
  return `+${gain.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
}

const KNOWN_TAB_CONFIG: Record<
  string,
  { iconSrc?: string; isNbaStyle?: boolean }
> = {
  Pokemon: { iconSrc: ASSETS.icons.marketIndexPokemon },
  Baseball: { iconSrc: ASSETS.icons.marketIndexMlb },
  Basketball: { iconSrc: ASSETS.icons.marketIndexNba, isNbaStyle: true },
  Football: { iconSrc: ASSETS.icons.marketIndexNfl },
};

function CategoryChip({
  category,
  active,
  onClick,
}: {
  category: string;
  active: boolean;
  onClick: () => void;
}) {
  const cfg = KNOWN_TAB_CONFIG[category] ?? {};
  const imgCls = cfg.isNbaStyle
    ? active
      ? MARKET_RASTER_ICON_IMG_NBA_ACTIVE
      : MARKET_RASTER_ICON_IMG_NBA
    : active
      ? MARKET_RASTER_ICON_IMG_ACTIVE
      : MARKET_RASTER_ICON_IMG;

  return (
    <button
      type="button"
      data-tab={category}
      onClick={onClick}
      className={`group inline-flex min-h-[28px] shrink-0 snap-start items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold tracking-tight transition-colors sm:min-h-[32px] sm:rounded-xl sm:px-3 sm:py-1.5 sm:text-[13px] ${
        active
          ? "bg-zinc-800/80 text-white"
          : "text-zinc-400 hover:bg-zinc-800/45 hover:text-white"
      }`}
    >
      {cfg.iconSrc ? (
        <span className="flex h-4 w-4 shrink-0 items-center justify-center sm:h-[18px] sm:w-[18px]" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={cfg.iconSrc}
            alt=""
            width={18}
            height={18}
            className={`${imgCls} h-full w-full object-contain`}
          />
        </span>
      ) : null}
      {formatSportCategoryDisplayLabel(category)}
    </button>
  );
}

function MoverCardRow({
  item,
  category,
  routing,
}: {
  item: TopMoverItem;
  category: string;
  routing: Top100Routing;
}) {
  const imgUrl = resolveTop100ImageUrl(item.image);
  const subText = top100CardSubText(item);
  const href = routing.cardDetailHref(
    {
      card_id: item.card_id,
      grade: item.headlineGrade ?? "PSA 10",
      rank: item.rank,
    },
    category,
  );

  return (
    <Link
      href={href}
      className="group flex min-w-0 items-center gap-2 rounded-xl border border-white/[0.06] bg-[#0d0d0d] px-2 py-2.5 transition-colors hover:border-white/[0.1] hover:bg-[#121212] sm:gap-3 sm:px-3 sm:py-3"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-xs font-bold tabular-nums text-zinc-400 sm:h-8 sm:w-8">
        {item.rank}
      </span>
      <div className="relative aspect-[3/4] w-11 shrink-0 overflow-hidden rounded-lg border border-white/[0.06] bg-zinc-900/80 sm:w-12">
        {imgUrl ? (
          <Image
            src={imgUrl}
            alt={item.description}
            fill
            className="object-contain p-0.5"
            sizes="48px"
            unoptimized
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-700">
            —
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`${CARD_DISPLAY_LINE1_CLAMP_CLASS} text-[0.8rem] font-semibold text-white sm:text-sm [--cd-line1-lh:1.375]`}>
          {top100CardTitle(item)}
        </p>
        {subText ? (
          <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{subText}</p>
        ) : null}
        {item.headlineGrade ? (
          <p className="mt-1 text-[10px] text-zinc-500">{item.headlineGrade}</p>
        ) : null}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-bold tabular-nums text-mint sm:text-[0.95rem]">
          {formatGainPct(item.gain)}
        </p>
        {item.headlinePrice != null ? (
          <p className="mt-0.5 text-[10px] tabular-nums text-zinc-500 sm:text-xs">
            {formatTop100Usd(item.headlinePrice)}
          </p>
        ) : null}
      </div>
    </Link>
  );
}

function MoverListSkeleton({ count }: { count: number }) {
  return (
    <div className="space-y-2">
      {[...Array(count)].map((_, i) => (
        <div
          key={i}
          className="h-[4.25rem] animate-pulse rounded-xl border border-zinc-800/50 bg-[#0d0d0d]"
        />
      ))}
    </div>
  );
}

function TopMoversPanel({
  category,
  itemCount,
  routing,
}: {
  category: string;
  itemCount: number;
  routing: Top100Routing;
}) {
  const { data, isLoading, isError } = useTopMovers(category, itemCount);
  const items = data?.items.slice(0, itemCount) ?? [];

  if (isError) {
    return (
      <AppPageState
        kind="section_load_failed"
        title="Top movers unavailable"
        message="Failed to load top movers. Check that the backend is running."
        layout="inline"
        primaryAction={{
          label: "Refresh page",
          onClick: () => window.location.reload(),
          variant: "neutral",
        }}
      />
    );
  }

  if (isLoading) {
    return <MoverListSkeleton count={itemCount} />;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800/60 bg-[#0d0d0d] px-4 py-8 text-center text-sm text-zinc-500">
        No movers for this category yet.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <MoverCardRow
          key={`${item.card_id}-${item.rank}`}
          item={item}
          category={category}
          routing={routing}
        />
      ))}
    </div>
  );
}

export type TopMoversSectionProps = {
  routing?: Top100Routing;
  title?: string;
  /** Items shown per category tab (preview=5, admin full list=20). */
  itemCount?: number;
  initialCategory?: string;
};

export function TopMoversSection({
  routing = MARKETS_TOP100_ROUTING,
  title = TOP_MOVERS_SECTION_TITLE,
  itemCount = TOP_MOVERS_PREVIEW_COUNT,
  initialCategory,
}: TopMoversSectionProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoryFromUrl = searchParams.get("category") ?? undefined;

  const { data: categories = ["Pokemon", "Baseball", "Basketball", "Football"] } =
    useTop100Categories();
  const sorted = sortCategories(categories);

  const resolvedInitial =
    initialCategory ?? categoryFromUrl ?? sorted[0] ?? "Pokemon";
  const [activeTab, setActiveTab] = useState(resolvedInitial);

  useEffect(() => {
    const next =
      initialCategory ?? categoryFromUrl ?? sorted[0] ?? "Pokemon";
    setActiveTab(next);
  }, [initialCategory, categoryFromUrl, sorted]);

  const effectiveTab = sorted.includes(activeTab) ? activeTab : (sorted[0] ?? "Pokemon");

  const onCategoryChange = useCallback(
    (category: string) => {
      setActiveTab(category);
      if (routing.syncCategoryToUrl) {
        router.replace(routing.listHref(category), { scroll: false });
      }
    },
    [router, routing],
  );

  return (
    <section className="mb-10 min-w-0 sm:mb-4">
      <div className="mb-3 sm:mb-5">
        <h2 className="min-w-0 text-xl font-bold leading-tight tracking-tight text-white sm:text-2xl">
          {title}
        </h2>
        <p className="mt-1 text-xs text-zinc-500 sm:text-sm">
          Cards with the strongest weekly price gains
        </p>
      </div>

      <div
        className="mobile-scroll-x-contain mb-4 flex w-full min-w-0 flex-nowrap gap-2 overflow-x-auto scroll-smooth pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="toolbar"
        aria-label="Filter top movers by category"
      >
        {sorted.map((cat) => (
          <CategoryChip
            key={cat}
            category={cat}
            active={effectiveTab === cat}
            onClick={() => onCategoryChange(cat)}
          />
        ))}
      </div>

      <div key={effectiveTab} className="markets-tab-panel-enter">
        <TopMoversPanel
          category={effectiveTab}
          itemCount={itemCount}
          routing={routing}
        />
      </div>
    </section>
  );
}
