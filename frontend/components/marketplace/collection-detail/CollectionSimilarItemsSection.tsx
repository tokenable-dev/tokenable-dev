"use client";

import { useDisplayFx } from "@/components/i18n/DisplayPreferencesProvider";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatUsdCompact } from "@/lib/market";
import {
  ListingGradeCardLines,
  buildListingGradeCardChange,
} from "@/components/collectibles/ListingGradeCardLines";
import {
  useCollectionSimilarItems,
  type SimilarCollectionItem,
} from "@/hooks/collection-detail/useCollectionSimilarItems";
import { CollectionPsaSlabFrame } from "@/components/marketplace/collection-cover";
import { parseCollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import {
  localizeCatalogPhrase,
  useCatalogNameRevision,
} from "@/lib/marketplace/catalogNameTranslation";
import { buildMarketsCollectionTitle } from "@/lib/markets/marketsCollectionTitle";

function SimilarCard({ item }: { item: SimilarCollectionItem }) {
  useDisplayFx(); // re-render on display currency / FX change
  useCatalogNameRevision();
  const sealed = item.components.assetKind === "sealed_box";
  const name = (
    sealed
      ? localizeCatalogPhrase(item.displayLabel)
      : buildMarketsCollectionTitle({
          collection: {
            collectionKey: item.collectionKey,
            displayLabel: item.catalogLabel,
          },
          comp: item.components,
        })
  ).trim() || item.displayLabel.trim();
  const alt = name;
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
        <ListingGradeCardLines
          title={name}
          priceLabel={
            item.lastPriceUsd != null ? formatUsdCompact(item.lastPriceUsd) : "—"
          }
          change={buildListingGradeCardChange({
            changePct: item.changePct,
            periodLabel: item.changePeriod,
          })}
        />
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
  const t = useTranslations("CollectionDetail");
  const tChrome = useTranslations("CollectionChrome");
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
          {tChrome("similar")}
        </h2>
      </div>

      {isLoading ? (
        <p className="cd-similar-items__empty mono">{t("similarLoading")}</p>
      ) : isError ? (
        <p className="cd-similar-items__empty mono">{t("similarError")}</p>
      ) : items.length === 0 ? (
        <p className="cd-similar-items__empty mono">{t("similarEmpty")}</p>
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
