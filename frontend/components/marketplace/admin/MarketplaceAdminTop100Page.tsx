"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CardTop100Section } from "@/components/markets/CardTop100Section";
import { useTop100, useTop100Categories } from "@/hooks/markets/usePokemonTop100";
import { ADMIN_TOP100_ROUTING } from "@/lib/markets/top100Routing";
import {
  ADMIN_ARTICLE,
  ADMIN_EMBEDDED_DARK,
  ADMIN_TEXT_EMPTY,
  ADMIN_TEXT_META,
  ADMIN_TEXT_MUTED,
  ADMIN_TEXT_SECONDARY,
} from "./adminUi";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

function Top100SnapshotMeta({ category }: { category: string }) {
  const { data: categories = [] } = useTop100Categories();
  const { data, isLoading } = useTop100(category);

  if (isLoading && !data) {
    return (
      <p className={`text-base ${ADMIN_TEXT_EMPTY}`}>Loading snapshot metadata…</p>
    );
  }

  return (
    <div className={`${ADMIN_ARTICLE} mb-5 sm:mb-6 ${ADMIN_TEXT_SECONDARY} text-sm sm:text-base`}>
      <p className="text-base font-semibold text-zinc-900">Snapshot metadata</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className={ADMIN_TEXT_META}>Category</dt>
          <dd className="text-zinc-800">{data?.category ?? category}</dd>
        </div>
        <div>
          <dt className={ADMIN_TEXT_META}>Grade</dt>
          <dd className="text-zinc-800">{data?.grade ?? "PSA 10"}</dd>
        </div>
        <div>
          <dt className={ADMIN_TEXT_META}>Snapshot date (KST)</dt>
          <dd className="text-zinc-800">{data?.snapshotDate ?? "—"}</dd>
        </div>
        <div>
          <dt className={ADMIN_TEXT_META}>Fetched at</dt>
          <dd className="text-zinc-800">{data?.fetchedAt ?? "—"}</dd>
        </div>
        <div>
          <dt className={ADMIN_TEXT_META}>Cards</dt>
          <dd className="text-zinc-800">{data?.items.length ?? 0}</dd>
        </div>
        <div>
          <dt className={ADMIN_TEXT_META}>Stale</dt>
          <dd className={data?.stale ? "text-amber-600" : "text-zinc-800"}>
            {data?.stale ? "Yes (serving prior day)" : "No"}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className={ADMIN_TEXT_META}>Categories source</dt>
          <dd className="text-zinc-800">
            {categories.length
              ? `${categories.length} categories (backend discovery)`
              : "—"}
          </dd>
        </div>
      </dl>
      <p className={`mt-4 text-sm leading-relaxed ${ADMIN_TEXT_SECONDARY}`}>
        Admin preview only — public Markets Top Cards UI remains disabled until
        production rollout. Data is served from daily Cardhedger snapshots (
        <code className="font-mono text-zinc-800">90day-prices-by-grade</code>).
      </p>
    </div>
  );
}

function MarketplaceAdminTop100PageContent() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category") ?? "Pokemon";

  return (
    <>
      <MarketplaceAdminPageHeader
        title="Top 100 preview"
        subtitle="Daily Cardhedger PSA 10 leaders by category (admin only)."
      />
      <Top100SnapshotMeta category={category} />
      <div className={ADMIN_EMBEDDED_DARK}>
        <CardTop100Section
          variant="full"
          initialCategory={category}
          routing={ADMIN_TOP100_ROUTING}
          title="Top 100 preview (admin)"
        />
      </div>
    </>
  );
}

export function MarketplaceAdminTop100Page() {
  return (
    <Suspense
      fallback={
        <div className={`px-3 py-8 text-sm ${ADMIN_TEXT_EMPTY}`}>Loading Top 100…</div>
      }
    >
      <MarketplaceAdminTop100PageContent />
    </Suspense>
  );
}
