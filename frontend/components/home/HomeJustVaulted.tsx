"use client";

import Link from "next/link";
import { HomeCardGrid } from "@/components/home/HomeCardGrid";
import { useHomeMarketplaceGrids } from "@/hooks/home";
import { useHeaderNavGate } from "@/hooks/auth/useHeaderNavGate";

export function HomeJustVaulted() {
  const { justVaulted, snapshotByKey, isPending } = useHomeMarketplaceGrids();
  const navigate = useHeaderNavGate();

  return (
    <section className="tkl-wrap home-section home-section--vaulted">
      <div className="home-section-head">
        <div>
          <h2 className="tkl-sec-title">Just vaulted</h2>
          <p className="tkl-sec-sub">
            Newly authenticated and listed — first to market.
          </p>
        </div>
        <button type="button" className="tkl-view-all" onClick={() => navigate("/vault", 1)}>
          Browse the vault ↗
        </button>
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
