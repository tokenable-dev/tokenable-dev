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
import { ADMIN_ARTICLE, ADMIN_PAGE_WIDE } from "./adminUi";
import { MarketplaceAdminNav } from "./MarketplaceAdminNav";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

function TopMoversSnapshotMeta({ category }: { category: string }) {
  const { data, isLoading } = useTopMovers(category, TOP_MOVERS_FETCH_COUNT);

  if (isLoading && !data) {
    return <p className="text-base text-zinc-500">Loading snapshot metadata…</p>;
  }

  return (
    <div className={`${ADMIN_ARTICLE} mb-6 text-sm text-zinc-400 sm:text-base`}>
      <p className="text-base font-semibold text-zinc-200">Snapshot metadata</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
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
      <p className="mt-4 text-sm leading-relaxed text-zinc-600">
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
    <div className={ADMIN_PAGE_WIDE}>
      <MarketplaceAdminNav />
      <MarketplaceAdminPageHeader
        title="Top Movers preview"
        subtitle="Weekly gain leaders from Cardhedger (admin only)."
      />
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
