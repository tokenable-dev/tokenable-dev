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
    <Link
      href={`/p2p/listings/${listing.id}`}
      className="block border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--azure)]"
    >
      <div className="mb-2 inline-block text-[11px] font-semibold uppercase tracking-wide text-[var(--azure)]">
        P2P · Physical delivery
      </div>
      <div className="text-[15px] font-medium text-[var(--ink)]">
        {listing.displayName || `PSA #${listing.certNumber}`}
      </div>
      <div className="mt-1 text-[13px] text-[var(--muted)]">Cert {listing.certNumber}</div>
      <div className="mt-3 text-[17px] font-semibold text-[var(--ink)]">
        ${formatUsdc(listing.priceUsdc)} USDC
      </div>
    </Link>
  );
}

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
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-[var(--ink)]">P2P listings</h2>
        <p className="mt-2 text-sm text-[var(--muted)]">Loading…</p>
      </section>
    );
  }

  if (!items.length) return null;

  return (
    <section className="mt-10">
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--ink)]">P2P listings</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Buy the physical card — USDC held in escrow until you confirm receipt.
          </p>
        </div>
        <Link href="/sell/p2p" className="text-sm text-[var(--azure)] hover:underline">
          List for P2P sale
        </Link>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((listing) => (
          <P2pCard key={listing.id} listing={listing} />
        ))}
      </div>
    </section>
  );
}
