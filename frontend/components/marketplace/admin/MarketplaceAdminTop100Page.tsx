"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CardTop100Section } from "@/components/markets/CardTop100Section";
import { useTop100, useTop100Categories } from "@/hooks/markets/usePokemonTop100";
import { ADMIN_TOP100_ROUTING } from "@/lib/markets/top100Routing";
import { MarketplaceAdminNav } from "./MarketplaceAdminNav";

function Top100SnapshotMeta({ category }: { category: string }) {
  const { data: categories = [] } = useTop100Categories();
  const { data, isLoading } = useTop100(category);

  if (isLoading && !data) {
    return (
      <p className="text-xs text-zinc-500">Loading snapshot metadata…</p>
    );
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
      <p className="mt-3 text-[11px] leading-relaxed text-zinc-600">
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
    <div className="mx-auto min-h-screen w-full max-w-6xl px-3 py-6 sm:px-5 sm:py-8">
      <MarketplaceAdminNav />
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
