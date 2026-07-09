"use client";

import Link from "next/link";
import { HomeCardGrid } from "@/components/home/HomeCardGrid";
import { useHomeMarketplaceGrids } from "@/hooks/home";

export function HomeTopMovers() {
  const { topMovers, snapshotByKey, isPending, snapshotsPending } =
    useHomeMarketplaceGrids();

  return (
    <section className="tkl-wrap home-section">
      <div className="home-section-head">
        <div>
          <h2 className="tkl-sec-title">Top movers</h2>
          <p className="tkl-sec-sub">
            Steepest price gains across the market right now.
          </p>
        </div>
        <Link href="/markets" className="tkl-view-all">
          View all ↗
        </Link>
      </div>
      {isPending ? (
        <p className="tkl-mono text-sm text-[var(--t2)] py-8 text-center">Loading…</p>
      ) : (
        <HomeCardGrid
          collections={topMovers}
          snapshotByKey={snapshotByKey}
          subMode="change"
          changeLoading={snapshotsPending}
          use90dChange
        />
      )}
    </section>
  );
}
