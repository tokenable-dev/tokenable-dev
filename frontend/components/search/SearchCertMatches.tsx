"use client";

import Link from "next/link";
import type { MarketplaceSearchCardHit } from "@/lib/core";
import { formatUsdCompact } from "@/lib/market/collectionMarketPricing";
import { useResolvedMediaUrlMap } from "@/hooks/media";
import { useMemo } from "react";
import { AssetDetailHeadlineTitle } from "@/components/marketplace/marketplace-shared";
import { assetDetailHeadlineHasContent } from "@/lib/marketplace/assetDetailHeadline";
import { formatSearchCardHitDisplay } from "@/lib/markets/searchHitDisplay";

export function SearchCertMatches({ cards }: { cards: MarketplaceSearchCardHit[] }) {
  const urls = useMemo(() => cards.map((c) => c.imageUrl).filter(Boolean) as string[], [cards]);
  const { map } = useResolvedMediaUrlMap(urls, { enabled: urls.length > 0 });

  if (cards.length === 0) return null;

  return (
    <div className="srch-cert-list">
      <div className="srch-cert-list__head">
        <span className="srch-cert-list__badge">Cert match</span>
        <span className="srch-cert-list__hint">
          {cards.length === 1 ? "Exact card found" : `${cards.length} cards found`}
        </span>
      </div>
      <h2 className="srch-sec-title">Cards</h2>
      {cards.map((card) => {
        const img = card.imageUrl ? (map.get(card.imageUrl) ?? card.imageUrl) : null;
        const display = formatSearchCardHitDisplay(card);
        const href = `/marketplace/${encodeURIComponent(card.tokenId)}`;
        return (
          <Link key={card.tokenId} href={href} className="srch-cert-match">
            <span className="srch-cert-match__thumb">
              {img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={img} alt="" loading="lazy" referrerPolicy="no-referrer" />
              ) : (
                <span className="srch-cert-match__thumb-fallback" aria-hidden>
                  #{card.tokenId}
                </span>
              )}
            </span>
            <div className="srch-cert-match__copy">
              <div className="srch-cert-match__title">
                {assetDetailHeadlineHasContent(display.parts) ? (
                  <AssetDetailHeadlineTitle
                    as="span"
                    parts={display.parts}
                    grade={display.grade}
                    className="block min-w-0 text-[inherit] font-[inherit] leading-[inherit] text-inherit [--cd-line1-lh:1.3]"
                  />
                ) : (
                  display.line1
                )}
              </div>
              {display.line2 ? (
                <div className="srch-cert-match__meta">{display.line2}</div>
              ) : null}
              {card.collectionKey ? (
                <div className="srch-cert-match__cta">View collection · see the market →</div>
              ) : null}
            </div>
            <div className="srch-cert-match__price">
              <div className="srch-cert-match__usd">
                {card.listedUsd != null ? formatUsdCompact(card.listedUsd) : "—"}
              </div>
              <div className="srch-cert-match__listed">
                {card.listedUsd != null ? "Listed" : "Unlisted"}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
