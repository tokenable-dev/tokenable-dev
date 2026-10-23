"use client";

import Link from "next/link";
import { formatUsdCompact, resolveReferencePercentChangeDisplay } from "@/lib/market";
import {
  ListingCardChange,
  listingCardChangeGlyph,
} from "@/components/collectibles/ListingCardChange";
import {
  useCollectionSimilarItems,
  type SimilarCollectionItem,
} from "@/hooks/collection-detail/useCollectionSimilarItems";
import { CollectionPsaSlabFrame } from "@/components/marketplace/collection-cover";
import { parseCollectionComponents } from "@/lib/marketplace/collectionDetailComponents";

function ChangeChip({ pct }: { pct: number | null }) {
  const display = resolveReferencePercentChangeDisplay(pct);
  return (
    <ListingCardChange
      pctLabel={display.pctLabel}
      tone={display.tone}
      glyph={listingCardChangeGlyph(display)}
    />
  );
}

function SimilarCard({ item }: { item: SimilarCollectionItem }) {
  const name = item.displayLabel.trim();
  const grade = item.gradeLabel.trim();
  const alt = grade ? `${name} · ${grade}` : name;
  return (
    <Link
      href={`/marketplace/collections/${encodeURIComponent(item.collectionKey)}`}
      className="cd-si-card si-card"
    >
      <div className="cd-si-card__media">
        {item.imageUrl ? (
          <CollectionPsaSlabFrame
            imageUrl={item.imageUrl}
            alt={alt}
            comp={parseCollectionComponents(item.components)}
            displayLabel={item.catalogLabel}
            collectionKey={item.collectionKey}
          />
        ) : (
          <div className="cd-si-card__media-empty" aria-hidden />
        )}
      </div>
      <div className="cd-si-card__body">
        <div className="cd-si-card__headlines">
          <div className="cd-si-card__title">{name}</div>
          {grade ? <div className="cd-si-card__grade">{grade}</div> : null}
        </div>
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
