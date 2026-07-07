"use client";

import Link from "next/link";
import { HomeCardGrid } from "@/components/home/HomeCardGrid";
import { useHomeMarketplaceGrids } from "@/hooks/home";

export function HomeJustVaulted() {
  const { justVaulted, snapshotByKey, isPending } = useHomeMarketplaceGrids();

  return (
    <section className="tkl-wrap home-section home-section--vaulted">
      <div className="home-section-head">
        <div>
          <h2 className="tkl-sec-title">Just vaulted</h2>
          <p className="tkl-sec-sub">
            The newest mints on Tokenable — authenticated and ready to trade.
          </p>
        </div>
        <Link href="/vault" className="tkl-view-all">
          Browse the vault ↗
        </Link>
      </div>
      {isPending ? (
        <p className="tkl-mono text-sm text-[var(--t2)] py-8 text-center">Loading…</p>
      ) : (
        <HomeCardGrid
          collections={justVaulted}
          snapshotByKey={snapshotByKey}
          subMode="vaulted"
        />
      )}
    </section>
  );
}
