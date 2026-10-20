import Link from "next/link";
import type { ReactNode } from "react";
import {
  formatAskPrice,
  formatLoosePrice,
  type CatalogListing,
} from "@/lib/core/api/pricecharting-listings";

export function catalogListingStatusLabel(status: string): string {
  if (status === "draft") return "Draft — buyers cannot see this yet";
  if (status === "submitted") return "Submitted";
  if (status === "cancelled") return "Cancelled";
  return status;
}

export function CatalogListingSummary({
  listing,
  href,
  showStatus,
  showPhoto = true,
  children,
}: {
  listing: CatalogListing;
  href?: string;
  showStatus?: boolean;
  showPhoto?: boolean;
  children?: ReactNode;
}) {
  const name = listing.productName ?? "Catalog item";
  return (
    <article className="sell-catalog-card">
      {href ? (
        <Link href={href} className="sell-catalog-card__open" aria-label={name} />
      ) : null}
      {showPhoto && listing.photos[0] ? (
        <img src={listing.photos[0].publicUrl} alt="" width={96} height={96} />
      ) : null}
      <div>
        <h2 className="sell-flow-choice__h2">
          {href ? (
            <Link href={href} className="sell-flow-link">
              {name}
            </Link>
          ) : (
            name
          )}
        </h2>
        {listing.consoleName ? <p>{listing.consoleName}</p> : null}
        {listing.releaseDate ? <p>Released {listing.releaseDate}</p> : null}
        <p>{formatLoosePrice(listing.loosePriceCents)}</p>
        <p>{formatAskPrice(listing.askPriceCents)}</p>
        <p>Quantity {listing.quantity ?? "—"}</p>
        {listing.sealedStatus ? <p>{listing.sealedStatus}</p> : null}
        {listing.conditionNote ? <p>{listing.conditionNote}</p> : null}
        {showStatus ? <p>{catalogListingStatusLabel(listing.status)}</p> : null}
        {children}
      </div>
    </article>
  );
}
