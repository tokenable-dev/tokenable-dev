"use client";

import { TkButton } from "@/components/ds";
import type { Order, RwaMetadata } from "@/lib/core";
import {
  listingVaultBadge,
  listingVerificationTiles,
} from "@/lib/marketplace/collectionListingModalHelpers";

function formatAskUsd(amount: string): string {
  try {
    const n = Number(amount) / 1_000_000;
    if (!Number.isFinite(n)) return "—";
    return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
  } catch {
    return "—";
  }
}

/**
 * Card.html `#ask-listbox .ask-row` — Ask price | Vault | Cert | Buy.
 */
export function CollectionListingAskRow({
  tokenId,
  listing,
  metadata,
  isLowest,
  onOpenListing,
}: {
  tokenId: number;
  listing: Order;
  metadata?: RwaMetadata | null;
  isLowest?: boolean;
  onOpenListing?: (tokenId: number, action?: "view" | "buy" | "bid") => void;
}) {
  const price = formatAskUsd(listing.considerationAmount);
  const vault = listingVaultBadge(listing);
  const tiles = listingVerificationTiles(metadata ?? null);
  const cert =
    tiles.certNumber && tiles.certNumber !== "—"
      ? `Cert #${tiles.certNumber}`
      : "Cert —";

  const openView = () => onOpenListing?.(tokenId, "view");
  const openBuy = () => onOpenListing?.(tokenId, "buy");

  return (
    <div
      className={`cd-ask-row${isLowest ? " cd-ask-row--lowest" : ""}`}
      role="button"
      tabIndex={0}
      onClick={openView}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openView();
        }
      }}
    >
      <span className="cd-ask-row__price">
        ${price}
        {isLowest ? (
          <span className="cd-ask-row__lowest-tag mono">LOWEST</span>
        ) : null}
      </span>
      <span
        className={`cd-ask-row__vault mono cd-ask-row__vault--${vault.tone}`}
        title={vault.title}
      >
        {vault.label}
      </span>
      <span className="cd-ask-row__cert mono">{cert}</span>
      <TkButton
        type="button"
        variant={isLowest ? "primary" : "ghost"}
        size="sm"
        className="cd-ask-row__buy"
        onClick={(e) => {
          e.stopPropagation();
          openBuy();
        }}
      >
        Buy
      </TkButton>
    </div>
  );
}
