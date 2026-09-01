"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { buildMarketsCollectionTitle } from "@/lib/markets/marketsCollectionTitle";
import {
  formatReferencePercentChange,
  referenceChangeTone,
} from "@/lib/market/priceChangePeriod";
import { useHomeMarketplaceGrids } from "@/hooks/home";
import "@/styles/tokenable-home.css";

/**
 * Indices strip — CSS marquee. On mobile Safari the animation often starts while
 * the row is still empty (snapshots pending); when items arrive the transform is
 * stuck. Remount the row after layout + on resume so the loop always runs.
 *
 * Styles live in tokenable-home.css. Shown on the landing page only.
 */
export function HomeTicker() {
  const { tickerItems, isPending, snapshotsPending } = useHomeMarketplaceGrids();

  const items = useMemo(() => {
    return tickerItems.map(({ collection, changePct }) => {
      const tone = referenceChangeTone(changePct ?? 0);
      const shortTitle = buildMarketsCollectionTitle({
        collection,
        comp: collection.components,
      });
      const name =
        shortTitle.length > 28 ? `${shortTitle.slice(0, 26)}…` : shortTitle;
      return {
        name,
        collectionKey: collection.collectionKey,
        pct: formatReferencePercentChange(changePct ?? 0, 0),
        up: tone !== "down",
      };
    });
  }, [tickerItems]);

  const itemsKey = items.map((i) => i.collectionKey).join("|");
  const [marqueeGen, setMarqueeGen] = useState(0);
  const loading = items.length === 0 && (isPending || snapshotsPending);

  useEffect(() => {
    if (items.length === 0) return;

    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;

    const bump = () => {
      if (!cancelled) setMarqueeGen((g) => g + 1);
    };

    // Two frames: first paint may still report 0-width on iOS WebKit.
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(bump);
    });

    const onVis = () => {
      if (document.visibilityState === "visible") bump();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) bump();
    };

    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pageshow", onPageShow);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [itemsKey, items.length]);

  const loop = [...items, ...items];

  return (
    <div className="home-ticker" data-loading={loading ? "true" : undefined}>
      <span className="home-ticker__label">
        <span className="home-ticker__dot" aria-hidden />
        <span className="mono home-ticker__label-text">
          Indices 1Y<span className="home-ticker__label-full"> return</span>
        </span>
      </span>
      <div className="home-ticker__viewport">
        {loading ? (
          <div className="ticker-row ticker-row--skeleton" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className="home-ticker__skel-item">
                <span className="home-ticker__skel-name" />
                <span className="home-ticker__skel-pct" />
              </span>
            ))}
          </div>
        ) : items.length > 0 ? (
          <div
            key={`${itemsKey}:${marqueeGen}`}
            className="ticker-row"
          >
            {loop.map((item, i) => (
              <Link
                key={`${item.collectionKey}-${i}`}
                href={`/marketplace/collections/${encodeURIComponent(item.collectionKey)}`}
                className="home-ticker__item"
              >
                <span className="mono home-ticker__item-name">{item.name}</span>
                <span
                  className={`mono home-ticker__item-pct ${
                    item.up
                      ? "home-ticker__item-pct--up"
                      : "home-ticker__item-pct--down"
                  }`}
                >
                  <span className="home-ticker__item-glyph" aria-hidden>
                    {item.up ? "▲" : "▼"}
                  </span>
                  {item.pct}
                </span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
