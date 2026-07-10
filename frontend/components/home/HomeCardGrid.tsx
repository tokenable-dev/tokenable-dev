"use client";

import { useCallback, useEffect, useRef } from "react";
import type { CollectionListMarketSnapshot, MarketplaceCollectionSummary } from "@/lib/core";
import { useResolvedMediaUrlMap } from "@/hooks/media";
import { pickCollectionSummaryDisplayImageUrl } from "@/lib/marketplace/collectionDisplayImage";
import { resolveMarketsListingMarketChangePct90d } from "@/lib/markets/marketsListingMarketPrice";
import { CollectibleCard } from "@/components/collectibles/CollectibleCard";
import { cn } from "@/lib/ds/cn";
import {
  homeMockChangePeriodLabel,
  isHomeMockCollectionKey,
} from "@/lib/home/homeMockData";

function ScrollArrow({
  direction,
  onClick,
  buttonRef,
}: {
  direction: "left" | "right";
  onClick: () => void;
  buttonRef: React.RefObject<HTMLButtonElement | null>;
}) {
  return (
    <button
      ref={buttonRef}
      type="button"
      className={cn(
        "grid4-arrow is-hidden",
        direction === "left" ? "grid4-arrow--left" : "grid4-arrow--right",
      )}
      data-dir={direction}
      onClick={onClick}
      aria-label={direction === "left" ? "Scroll left" : "Scroll right"}
    >
      <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2.5}>
        {direction === "left" ? (
          <>
            <line x1={19} y1={12} x2={5} y2={12} />
            <polyline points="12 19 5 12 12 5" />
          </>
        ) : (
          <>
            <line x1={5} y1={12} x2={19} y2={12} />
            <polyline points="12 5 19 12 12 19" />
          </>
        )}
      </svg>
    </button>
  );
}

export function HomeCardGrid({
  collections,
  snapshotByKey,
  subMode = "change",
  changeLoading = false,
  use90dChange = false,
}: {
  collections: MarketplaceCollectionSummary[];
  snapshotByKey: Map<string, CollectionListMarketSnapshot>;
  subMode?: "change" | "vaulted";
  changeLoading?: boolean;
  /** Home Top movers — fixed 90-day reference % change. */
  use90dChange?: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const leftArrowRef = useRef<HTMLButtonElement>(null);
  const rightArrowRef = useRef<HTMLButtonElement>(null);

  const coverSources = collections.map((c) => pickCollectionSummaryDisplayImageUrl(c));
  const { map: coverUrlMap } = useResolvedMediaUrlMap(coverSources, {
    enabled: collections.length > 0,
  });

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    const canScroll = scrollWidth > clientWidth + 10;
    const atStart = scrollLeft < 10;
    const atEnd = scrollLeft + clientWidth >= scrollWidth - 10;

    const rect = el.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const inView = rect.bottom > 0 && rect.top < window.innerHeight;

    const positionBtn = (
      btn: HTMLButtonElement | null,
      dir: "left" | "right",
      show: boolean,
    ) => {
      if (!btn) return;
      if (!show || !inView) {
        btn.classList.add("is-hidden");
        btn.style.display = "none";
        return;
      }
      btn.classList.remove("is-hidden");
      btn.style.display = "flex";
      btn.style.top = `${midY}px`;
      btn.style.transform = "translateY(-50%)";
      if (dir === "right") {
        btn.style.left = `${Math.min(rect.right, window.innerWidth) - btn.offsetWidth - 8}px`;
      } else {
        btn.style.left = `${Math.max(rect.left, 0) + 8}px`;
      }
    };

    positionBtn(leftArrowRef.current, "left", canScroll && !atStart);
    positionBtn(rightArrowRef.current, "right", canScroll && !atEnd);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    window.addEventListener("resize", updateArrows);
    window.addEventListener("scroll", updateArrows, { passive: true });
    const t1 = window.setTimeout(updateArrows, 500);
    const t2 = window.setTimeout(updateArrows, 2000);
    const t3 = window.setTimeout(updateArrows, 4000);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      window.removeEventListener("resize", updateArrows);
      window.removeEventListener("scroll", updateArrows);
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      window.clearTimeout(t3);
    };
  }, [collections.length, updateArrows]);

  function scrollByDir(dir: "left" | "right") {
    const el = scrollerRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>(".card-wrap .card, .card, a.card");
    const cardWidth = card?.offsetWidth ?? 0;
    const scrollAmt = cardWidth > 0 ? (cardWidth + 22) * (dir === "left" ? -1 : 1) : 300 * (dir === "left" ? -1 : 1);
    el.scrollBy({ left: scrollAmt, behavior: "smooth" });
    window.setTimeout(updateArrows, 400);
  }

  if (collections.length === 0) {
    return (
      <p className="tkl-mono text-sm text-[var(--t2)] py-8 text-center">
        No collections to show yet.
      </p>
    );
  }

  return (
    <div className="grid4-wrap">
      <div ref={scrollerRef} className="grid4">
        {collections.map((collection) => {
          const key = collection.collectionKey.toLowerCase();
          const snapshot = snapshotByKey.get(key);
          const changePct90d = use90dChange
            ? resolveMarketsListingMarketChangePct90d(snapshot)
            : undefined;
          const periodLabel = isHomeMockCollectionKey(collection.collectionKey)
            ? homeMockChangePeriodLabel(snapshot?.marketChangeWindow)
            : use90dChange
              ? "90d"
              : undefined;
          return (
            <CollectibleCard
              key={collection.collectionKey}
              collection={collection}
              snapshot={snapshot}
              resolvedCoverUrl={(() => {
                const src = pickCollectionSummaryDisplayImageUrl(collection);
                return src ? coverUrlMap.get(src) : undefined;
              })()}
              subMode={subMode}
              changeLoading={changeLoading}
              marketChangePctOverride={
                isHomeMockCollectionKey(collection.collectionKey)
                  ? (snapshot?.marketChangePct ?? changePct90d)
                  : changePct90d
              }
              marketChangePeriodLabel={periodLabel}
              shell="none"
            />
          );
        })}
      </div>
      <ScrollArrow
        direction="left"
        onClick={() => scrollByDir("left")}
        buttonRef={leftArrowRef}
      />
      <ScrollArrow
        direction="right"
        onClick={() => scrollByDir("right")}
        buttonRef={rightArrowRef}
      />
    </div>
  );
}
