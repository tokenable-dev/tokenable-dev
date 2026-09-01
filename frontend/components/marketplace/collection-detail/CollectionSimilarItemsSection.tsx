"use client";

import Link from "next/link";
import {
  formatReferencePercentChange,
  formatUsdCompact,
  referenceChangeTone,
} from "@/lib/market";
import {
  useCollectionSimilarItems,
  type SimilarCollectionItem,
} from "@/hooks/collection-detail/useCollectionSimilarItems";
import { CollectionCoverFrame } from "@/components/marketplace/collection-cover";
import { CARD_DISPLAY_LINE1_CLAMP_CLASS } from "@/components/marketplace/marketplace-shared";

function ChangeChip({ pct }: { pct: number | null }) {
  if (pct == null || !Number.isFinite(pct)) {
    return <span className="cd-si-card__chg mono cd-si-card__chg--muted">—</span>;
  }
  const tone = referenceChangeTone(pct);
  const arrow = tone === "down" ? "▼" : "▲";
  return (
    <span
      className={`cd-si-card__chg mono${
        tone === "down"
          ? " cd-si-card__chg--down"
          : tone === "up"
            ? " cd-si-card__chg--up"
            : ""
      }`}
    >
      <span className="cd-chg-glyph" aria-hidden>
        {arrow}
      </span>{" "}
      {formatReferencePercentChange(pct)}
    </span>
  );
}

function SimilarCard({ item }: { item: SimilarCollectionItem }) {
  return (
    <Link
      href={`/marketplace/collections/${encodeURIComponent(item.collectionKey)}`}
      className="cd-si-card si-card"
    >
      <div className="cd-si-card__media">
        {item.imageUrl ? (
          <CollectionCoverFrame
            imageUrl={item.imageUrl}
            variant="flat"
            className="h-full w-full"
            quietLoading
          />
        ) : (
          <div className="cd-si-card__media-empty" aria-hidden />
        )}
      </div>
      <div className="cd-si-card__body">
        <div className={`cd-si-card__title ${CARD_DISPLAY_LINE1_CLAMP_CLASS}`}>{item.displayLabel}</div>
        <div className="cd-si-card__price-row">
          <span className="cd-si-card__price">
            {item.lastPriceUsd != null
              ? formatUsdCompact(item.lastPriceUsd)
              : "—"}
          </span>
          <ChangeChip pct={item.changePct} />
        </div>
      </div>
    </Link>
  );
}

/**
 * Card.html `#similar-items` — same card name OR same set under Price history.
 */
export function CollectionSimilarItemsSection({
  collectionKey,
}: {
  collectionKey: string;
}) {
  const { data, isLoading, isError } = useCollectionSimilarItems(collectionKey);
  const items = data?.items ?? [];

  return (
    <section
      id="similar-items"
      className="cd-similar-items cd-notch"
      aria-labelledby="similar-items-heading"
    >
      <div className="cd-similar-items__head">
        <h2 id="similar-items-heading" className="cd-similar-items__title">
          Similar items
        </h2>
      </div>

      {isLoading ? (
        <p className="cd-similar-items__empty mono">Loading…</p>
      ) : isError ? (
        <p className="cd-similar-items__empty mono">Couldn’t load similar items.</p>
      ) : items.length === 0 ? (
        <p className="cd-similar-items__empty mono">
          No similar collections with the same name or set.
        </p>
      ) : (
        <div id="similar-row" className="cd-similar-items__grid">
          {items.map((item) => (
            <SimilarCard key={item.collectionKey} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
