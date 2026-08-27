"use client";

import Link from "next/link";
import type { MarketplaceSearchCardHit } from "@/lib/core";
import { formatUsdCompact } from "@/lib/market/collectionMarketPricing";
import { useResolvedMediaUrlMap } from "@/hooks/media";
import { useMemo } from "react";

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
        const meta = [
          card.setLine,
          card.gradeLabel,
          card.certNumber ? `Cert #${card.certNumber}` : null,
          card.vaultLabel,
        ].filter(Boolean);
        const href = `/marketplace/${encodeURIComponent(card.tokenId)}`;
        return (
          <Link key={card.tokenId} href={href} className="srch-cert-match">
            {img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={img} alt="" />
            ) : (
              <span className="srch-cert-match__thumb-empty" aria-hidden />
            )}
            <div className="srch-cert-match__copy">
              <div className="srch-cert-match__title">{card.title}</div>
              <div className="srch-cert-match__meta">{meta.join(" · ")}</div>
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
