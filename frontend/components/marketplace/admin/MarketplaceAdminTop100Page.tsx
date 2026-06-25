"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CardTop100Section } from "@/components/markets/CardTop100Section";
import { useTop100, useTop100Categories } from "@/hooks/markets/usePokemonTop100";
import { ADMIN_TOP100_ROUTING } from "@/lib/markets/top100Routing";
import { ADMIN_ARTICLE, ADMIN_PAGE_WIDE } from "./adminUi";
import { MarketplaceAdminNav } from "./MarketplaceAdminNav";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

function Top100SnapshotMeta({ category }: { category: string }) {
  const { data: categories = [] } = useTop100Categories();
  const { data, isLoading } = useTop100(category);

  if (isLoading && !data) {
    return (
      <p className="text-base text-zinc-500">Loading snapshot metadata…</p>
    );
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
          <dt className="text-zinc-600">Grade</dt>
          <dd className="text-zinc-300">{data?.grade ?? "PSA 10"}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Snapshot date (KST)</dt>
          <dd className="text-zinc-300">{data?.snapshotDate ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Fetched at</dt>
          <dd className="text-zinc-300">{data?.fetchedAt ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Cards</dt>
          <dd className="text-zinc-300">{data?.items.length ?? 0}</dd>
        </div>
        <div>
          <dt className="text-zinc-600">Stale</dt>
          <dd className={data?.stale ? "text-amber-400" : "text-zinc-300"}>
            {data?.stale ? "Yes (serving prior day)" : "No"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-zinc-600">Categories source</dt>
          <dd className="text-zinc-300">
            {categories.length
              ? `${categories.length} categories (backend discovery)`
              : "—"}
          </dd>
        </div>
      </dl>
      <p className="mt-4 text-sm leading-relaxed text-zinc-600">
        Admin preview only — public Markets Top Cards UI remains disabled until
        production rollout. Data is served from daily Cardhedger snapshots (
        <code className="text-zinc-500">90day-prices-by-grade</code>).
      </p>
    </div>
  );
}

function MarketplaceAdminTop100PageContent() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category") ?? "Pokemon";

  return (
    <div className={ADMIN_PAGE_WIDE}>
      <MarketplaceAdminNav />
      <MarketplaceAdminPageHeader
        title="Top 100 preview"
        subtitle="Daily Cardhedger PSA 10 leaders by category (admin only)."
      />
      <Top100SnapshotMeta category={category} />
      <CardTop100Section
        variant="full"
        initialCategory={category}
        routing={ADMIN_TOP100_ROUTING}
        title="Top 100 preview (admin)"
      />
    </div>
  );
}

export function MarketplaceAdminTop100Page() {
  return (
    <Suspense
      fallback={
        <div className="px-3 py-8 text-sm text-zinc-500">Loading Top 100…</div>
      }
    >
      <MarketplaceAdminTop100PageContent />
    </Suspense>
  );
}
