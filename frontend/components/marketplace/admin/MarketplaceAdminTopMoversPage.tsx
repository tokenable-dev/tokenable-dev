"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { TopMoversSection } from "@/components/markets/TopMoversSection";
import { useTopMovers } from "@/hooks/markets/useTopMovers";
import {
  TOP_MOVERS_FETCH_COUNT,
  TOP_MOVERS_SECTION_TITLE,
} from "@/lib/markets/top100Copy";
import { ADMIN_TOP_MOVERS_ROUTING } from "@/lib/markets/top100Routing";
import { MarketplaceAdminNav } from "./MarketplaceAdminNav";

function TopMoversSnapshotMeta({ category }: { category: string }) {
  const { data, isLoading } = useTopMovers(category, TOP_MOVERS_FETCH_COUNT);

  if (isLoading && !data) {
    return <p className="text-xs text-zinc-500">Loading snapshot metadata…</p>;
  }

  return (
    <div className="mb-5 rounded-xl border border-zinc-800/80 bg-zinc-950/60 px-4 py-3 text-xs text-zinc-400">
      <p className="font-semibold text-zinc-300">Snapshot metadata</p>
      <dl className="mt-2 grid gap-1.5 sm:grid-cols-2">
        <div>
          <dt className="text-zinc-600">Category</dt>
          <dd className="text-zinc-300">{data?.category ?? category}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Cards</dt>
          <dd className="text-zinc-300">{data?.items.length ?? 0}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Fetched at</dt>
          <dd className="text-zinc-300">{data?.fetchedAt ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">From cache</dt>
          <dd className="text-zinc-300">{data?.fromCache ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Cache expires</dt>
          <dd className="text-zinc-300">{data?.cacheExpiresAt ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Gain threshold</dt>
          <dd className="text-zinc-300">
            {data?.gainThreshold != null ? `${data.gainThreshold}%` : "—"}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
        Admin preview only — public Markets Top Movers UI remains disabled until
        production rollout. Data is served from Cardhedger{" "}
        <code className="text-zinc-500">top-movers</code> (1h server cache).
      </p>
    </div>
  );
}

function MarketplaceAdminTopMoversPageContent() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category") ?? "Pokemon";

  return (
    <div className="mx-auto min-h-screen w-full max-w-6xl px-3 py-6 sm:px-5 sm:py-8">
      <MarketplaceAdminNav />
      <TopMoversSnapshotMeta category={category} />
      <TopMoversSection
        routing={ADMIN_TOP_MOVERS_ROUTING}
        title={`${TOP_MOVERS_SECTION_TITLE} (admin)`}
        itemCount={TOP_MOVERS_FETCH_COUNT}
        initialCategory={category}
      />
    </div>
  );
}

export function MarketplaceAdminTopMoversPage() {
  return (
    <Suspense
      fallback={
        <div className="px-3 py-8 text-sm text-zinc-500">Loading Top Movers…</div>
      }
    >
      <MarketplaceAdminTopMoversPageContent />
    </Suspense>
  );
}
