"use client";

import Link from "next/link";
import { HomeCardGrid } from "@/components/home/HomeCardGrid";
import { useHomeMarketplaceGrids } from "@/hooks/home";

export function HomeJustVaulted() {
  const { justVaulted, snapshotByKey, isPending, snapshotsPending } =
    useHomeMarketplaceGrids();

  return (
    <section className="tkl-wrap home-section home-section--vaulted">
      <div className="home-section-head">
        <div>
          <h2 className="tkl-sec-title">New items</h2>
          <p className="tkl-sec-sub">
            Vaulted and freshly minted tokens
          </p>
        </div>
        <Link href="/markets?sort=newest" className="tkl-view-all">
          View all ↗
        </Link>
      </div>
      {isPending ? (
        <p className="tkl-mono text-sm text-[var(--t2)] py-8 text-center">Loading…</p>
      ) : (
        <HomeCardGrid
          collections={justVaulted}
          snapshotByKey={snapshotByKey}
          subMode="change"
          changeLoading={snapshotsPending}
          use1yChange
          layout="wrap"
        />
      )}
    </section>
  );
}
