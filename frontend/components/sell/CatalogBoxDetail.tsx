"use client";

import { useMemo, useState } from "react";
import { CollectionCoverFrame } from "@/components/marketplace/collection-cover/CollectionCoverFrame";
import { CollectionDualPriceChart } from "@/components/marketplace/collection-dual-price-chart";
import { CollectionDetailBreadcrumb } from "@/components/marketplace/collection-detail/CollectionDetailBreadcrumb";
import { CollectionDetailsKvCard } from "@/components/marketplace/collection-hero/CollectionDetailsKvCard";
import { CollectionHeroDetailsTabs } from "@/components/marketplace/collection-hero/CollectionHeroDetailsTabs";
import { COLLECTION_DETAIL_SHELL_CLASS } from "@/constants/layout";
import {
  formatAskPrice,
  formatLoosePrice,
  type CatalogListingDetail,
} from "@/lib/core/api/pricecharting-listings";
import type { CollectionDetailCard } from "@/lib/marketplace/collectionDetailTypes";

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function seoulNoonSeconds(day: string): number {
  return Math.floor(Date.parse(`${day}T12:00:00+09:00`) / 1000);
}

function detailRows(listing: CatalogListingDetail): CollectionDetailCard[] {
  const text: { id: string; label: string; value: string | null }[] = [
    { id: "set", label: "Set", value: listing.consoleName },
    { id: "product", label: "Product", value: listing.productName },
    { id: "genre", label: "Genre", value: listing.genre },
    { id: "released", label: "Released", value: listing.releaseDate },
    { id: "product-id", label: "Product id", value: listing.pricechartingProductId },
    { id: "upc", label: "UPC", value: listing.upc },
    { id: "asin", label: "ASIN", value: listing.asin },
    { id: "tcg", label: "TCG id", value: listing.tcgId },
    { id: "epid", label: "EPID", value: listing.epid },
    {
      id: "sales",
      label: "Sales volume",
      value: listing.salesVolume == null ? null : String(listing.salesVolume),
    },
  ];
  const rows: CollectionDetailCard[] = text.flatMap((row) =>
    row.value ? [{ id: row.id, label: row.label, value: row.value }] : [],
  );
  for (const price of listing.prices) {
    rows.push({
      id: price.column,
      label: price.label,
      value: usd(price.cents),
    });
  }
  return rows;
}

export function CatalogBoxDetail({ listing }: { listing: CatalogListingDetail }) {
  const [photoIndex, setPhotoIndex] = useState(0);
  const photo = listing.photos[photoIndex] ?? listing.photos[0] ?? null;
  const title = listing.productName ?? "Catalog item";
  const rows = useMemo(() => detailRows(listing), [listing]);
  const history = useMemo(
    () =>
      listing.loosePriceHistory.map((point) => ({
        t: seoulNoonSeconds(point.observedOn),
        v: point.loosePriceCents / 100,
      })),
    [listing.loosePriceHistory],
  );
  const historyWindowDays = useMemo(() => {
    if (history.length < 2) return 1;
    const span = Math.ceil((history[history.length - 1]!.t - history[0]!.t) / 86400);
    return Math.max(span + 1, 1);
  }, [history]);
  const looseUsd = listing.loosePriceCents == null ? null : listing.loosePriceCents / 100;

  return (
    <div className="collection-detail-page min-h-screen min-w-0 overflow-x-clip text-white">
      <div className={`collection-detail-page__shell ${COLLECTION_DETAIL_SHELL_CLASS}`}>
        <CollectionDetailBreadcrumb
          categoryLabel={listing.genre ?? "Catalog"}
          trailLabel={title}
        />
        <section className="cd-overview-board" aria-label="Box details">
          <div className="grid gap-6 px-3.5 pb-8 sm:px-6 lg:grid-cols-[minmax(260px,307px)_minmax(0,1fr)_minmax(280px,372px)] lg:px-8">
            <div className="min-w-0">
              {photo ? (
                <CollectionCoverFrame
                  imageUrl={photo.publicUrl}
                  alt={`Photo of ${title}`}
                  variant="hero"
                />
              ) : (
                <p>No seller photo.</p>
              )}
              {listing.photos.length > 1 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {listing.photos.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      className="overflow-hidden rounded-lg"
                      aria-label={`Photo ${index + 1}`}
                      aria-current={index === photoIndex}
                      onClick={() => setPhotoIndex(index)}
                    >
                      <img src={item.publicUrl} alt="" width={64} height={64} />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="min-w-0">
              <h1 className="cd-hero-bar__title" title={title}>
                {title}
              </h1>
              {listing.consoleName ? <p className="mt-1 text-sm text-white/70">{listing.consoleName}</p> : null}
              <div className="cd-hero-bar__priceblock mt-4" id="hero-priceblock">
                <div className="cd-hero-bar__lastlbl mono">Loose price</div>
                <div className="cd-hero-bar__price">
                  {listing.loosePriceCents == null ? "—" : usd(listing.loosePriceCents)}
                </div>
              </div>
              <div className="cd-chart-panel cd-notch mt-4" id="chart-card">
                <div className="cd-chart-panel__plot">
                  <div className="cd-chart-panel__header">
                    <div className="cd-chart-panel__head-left">
                      <span className="cd-chart-panel__title">Price history</span>
                    </div>
                  </div>
                  <div className="cd-chart-panel__body cd-chart-panel__body--card-html">
                    <CollectionDualPriceChart
                      platformUsd={[]}
                      externalRollingUsd={history}
                      externalMarketUsd={looseUsd}
                      externalWindowDays={historyWindowDays}
                      externalRollingKind="history"
                      externalSeriesShortLabel="Loose"
                      externalRefLineTag="Loose"
                      externalLegendLabel="Loose price"
                      colorTheme="collection-detail"
                      emptyStateMessage="No loose-price history is stored for this box yet."
                    />
                  </div>
                </div>
              </div>
              <div className="mt-4">
                <CollectionHeroDetailsTabs
                  detailsPanel={
                    <CollectionDetailsKvCard title={title} subtitle={listing.consoleName} rows={rows} />
                  }
                />
              </div>
            </div>

            <aside className="cd-trade-panel" aria-label="Seller listing">
              <div className="cd-trade-panel__body">
                <p className="cd-hero-bar__lastlbl mono">Asking price</p>
                <p className="cd-hero-bar__price">
                  {listing.askPriceCents == null ? "—" : usd(listing.askPriceCents)}
                </p>
                <p className="mt-3 text-sm text-white/80">{formatLoosePrice(listing.loosePriceCents)}</p>
                <p className="mt-1 text-sm text-white/80">{formatAskPrice(listing.askPriceCents)}</p>
                <p className="mt-3 text-sm text-white/80">Quantity {listing.quantity ?? "—"}</p>
                {listing.sealedStatus ? (
                  <p className="mt-1 text-sm text-white/80">{listing.sealedStatus}</p>
                ) : null}
                {listing.conditionNote ? (
                  <p className="mt-1 text-sm text-white/80">{listing.conditionNote}</p>
                ) : null}
                <p className="mt-4 text-sm text-white/60">Checkout is not available for this box.</p>
              </div>
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
}
