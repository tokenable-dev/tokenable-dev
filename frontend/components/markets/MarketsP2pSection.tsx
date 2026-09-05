"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listP2pListings, type P2pListing } from "@/lib/core/api/p2p";
import { activeRqChainId } from "@/lib/chains";

function formatUsdc(atomic: string): string {
  const n = Number(atomic) / 1e6;
  if (!Number.isFinite(n)) return atomic;
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function P2pCard({ listing }: { listing: P2pListing }) {
  return (
    <Link href={`/p2p/listings/${listing.id}`} className="mk-p2p-card">
      <div className="mk-p2p-card__badge">P2P · Physical delivery</div>
      <div className="mk-p2p-card__name">
        {listing.displayName || `PSA #${listing.certNumber}`}
      </div>
      <div className="mk-p2p-card__cert">Cert {listing.certNumber}</div>
      <div className="mk-p2p-card__price">${formatUsdc(listing.priceUsdc)} USDC</div>
    </Link>
  );
}

/** Markets.html P2P band — shown when active listings exist. */
export function MarketsP2pSection() {
  const chainId = activeRqChainId();
  const q = useQuery({
    queryKey: ["p2p", "listings", "active", chainId],
    queryFn: listP2pListings,
    staleTime: 30_000,
  });

  const items = q.data ?? [];
  if (q.isPending) {
    return (
      <section className="tkl-wrap mk-p2p-section">
        <h2 className="mk-p2p-section__title">P2P listings</h2>
        <p className="mk-p2p-section__sub">Loading…</p>
      </section>
    );
  }

  if (!items.length) return null;

  return (
    <section className="tkl-wrap mk-p2p-section">
      <div className="mk-p2p-section__head">
        <div>
          <h2 className="mk-p2p-section__title">P2P listings</h2>
          <p className="mk-p2p-section__sub">
            Buy the physical card — USDC held in escrow until you confirm receipt.
          </p>
        </div>
        <Link href="/sell/p2p" className="mk-p2p-section__cta">
          List for P2P sale
        </Link>
      </div>
      <div className="mk-p2p-grid">
        {items.map((listing) => (
          <P2pCard key={listing.id} listing={listing} />
        ))}
      </div>
    </section>
  );
}
