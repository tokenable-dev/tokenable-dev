"use client";

import { useMemo } from "react";
import { buildMarketsCollectionTitle } from "@/lib/markets/marketsCollectionTitle";
import {
  formatReferencePercentChange,
  referenceChangeTone,
} from "@/lib/market/priceChangePeriod";
import { useHomeMarketplaceGrids } from "@/hooks/home";

export function HomeTicker() {
  const { tickerItems } = useHomeMarketplaceGrids();

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
        pct: formatReferencePercentChange(changePct ?? 0, 0),
        up: tone !== "down",
      };
    });
  }, [tickerItems]);

  // Duplicate once for seamless CSS marquee (translateX -50%). With a long
  // unique cycle, the duplicate set stays off-screen on typical viewports.
  const loop = [...items, ...items];

  return (
    <div className="home-ticker">
      <span className="home-ticker__label">
        <span className="home-ticker__dot" aria-hidden />
        <span className="mono home-ticker__label-text">
          Indices 1Y<span className="home-ticker__label-full"> return</span>
        </span>
      </span>
      <div className="home-ticker__viewport">
        <div className="ticker-row">
          {loop.map((item, i) => (
            <span key={`${item.name}-${i}`} className="home-ticker__item">
              <span className="mono home-ticker__item-name">{item.name}</span>
              <span
                className={`mono home-ticker__item-pct ${
                  item.up ? "home-ticker__item-pct--up" : "home-ticker__item-pct--down"
                }`}
              >
                {item.up ? "▲" : "▼"} {item.pct}
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
