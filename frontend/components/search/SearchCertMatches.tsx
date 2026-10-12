"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MarketplaceSearchCardHit } from "@/lib/core";
import { formatUsdListing } from "@/lib/market/collectionMarketPricing";
import { useResolvedMediaUrlMap } from "@/hooks/media";
import { useMemo, type MouseEvent } from "react";
import { CollectionCoverFrame } from "@/components/marketplace/collection-cover";
import {
  cardDisplayPartsFromAssetDetail,
  formatCardDisplayLine1,
} from "@/lib/marketplace/assetDetailHeadline";
import {
  collectionDetailHref,
  resolveCollectionDetailHref,
} from "@/lib/marketplace/collectionBrowseContext";
import { formatSearchCardHitDisplay } from "@/lib/markets/searchHitDisplay";

/** Public cert numbers are masked to `#****1234`, so exactness is checked on the last 4 digits. */
function isExactCertHit(card: MarketplaceSearchCardHit, query: string): boolean {
  if (card.tokenId === query) return true;
  const certDigits = (card.certNumber ?? "").replace(/\D/g, "");
  return certDigits.length === 4 && query.endsWith(certDigits);
}

/** Search.html `#cert-match` — cert-number query surfaces the individual card. */
export function SearchCertMatches({
  cards,
  query,
}: {
  cards: MarketplaceSearchCardHit[];
  query: string;
}) {
  const router = useRouter();
  const urls = useMemo(() => cards.map((c) => c.imageUrl).filter(Boolean) as string[], [cards]);
  const { map } = useResolvedMediaUrlMap(urls, { enabled: urls.length > 0 });

  if (cards.length === 0) return null;

  const single = cards.length === 1 ? cards[0] : null;
  const singleCollectionKey = single?.collectionKey?.trim();

  return (
    <section className="srch-cert">
      <div className="srch-cert__head">
        <span className="srch-cert__badge">✓ Cert match</span>
        <span className="srch-cert__hint">
          {single && isExactCertHit(single, query)
            ? "Exact card found"
            : `${cards.length} cards found`}
        </span>
        {singleCollectionKey ? (
          <Link href={collectionDetailHref(singleCollectionKey)} className="srch-cert__link">
            View collection →
          </Link>
        ) : null}
      </div>
      <div className="markets-grid">
        {cards.map((card) => {
          const img = card.imageUrl ? (map.get(card.imageUrl) ?? card.imageUrl) : null;
          const display = formatSearchCardHitDisplay(card);
          const title =
            formatCardDisplayLine1(cardDisplayPartsFromAssetDetail(display.parts, display.grade)) ||
            display.line1;
          const meta = [display.line2, card.vaultLabel].filter(Boolean).join(" · ");
          const exact = isExactCertHit(card, query);
          const certLabel = exact ? query : card.certNumber?.replace(/^#/, "");
          const key = card.collectionKey?.trim();
          const href = key
            ? collectionDetailHref(key, { listingTokenId: card.tokenId })
            : null;
          const onClick = async (e: MouseEvent<HTMLAnchorElement>) => {
            if (href) return;
            e.preventDefault();
            router.push(await resolveCollectionDetailHref(card.tokenId, card.collectionKey));
          };
          return (
            <div key={card.tokenId} className="card-wrap">
              <Link
                href={href ?? "#"}
                onClick={onClick}
                className={exact ? "card srch-cert__card--exact" : "card"}
              >
                <div className="card__img">
                  {img ? (
                    <CollectionCoverFrame
                      imageUrl={img}
                      variant="flat"
                      className="h-full w-full"
                      quietLoading
                    />
                  ) : (
                    <div className="h-full w-full bg-[#111113]" aria-hidden />
                  )}
                  {exact ? <span className="srch-cert__exact">✓ Exact</span> : null}
                </div>
                <div className="card__body">
                  <div className="card__title" title={title}>
                    {title}
                  </div>
                  <div className="srch-cert__meta">
                    {meta ? <div className="srch-cert__meta-line">{meta}</div> : null}
                    {certLabel ? (
                      <div>
                        Cert #<b>{certLabel}</b>
                      </div>
                    ) : null}
                  </div>
                  <div className="card__price-row">
                    <span className="card__price">
                      {card.listedUsd != null ? formatUsdListing(card.listedUsd) : "—"}
                    </span>
                    <span className="card__sub card__sub--muted">
                      {card.listedUsd != null ? "Listed" : "Unlisted"}
                    </span>
                  </div>
                </div>
              </Link>
            </div>
          );
        })}
      </div>
    </section>
  );
}
