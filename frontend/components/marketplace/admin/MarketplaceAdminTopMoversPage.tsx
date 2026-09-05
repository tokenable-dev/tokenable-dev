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
import { ADMIN_ARTICLE, ADMIN_EMBEDDED_DARK, ADMIN_TEXT_EMPTY, ADMIN_TEXT_META, ADMIN_TEXT_SECONDARY } from "./adminUi";
import { MarketplaceAdminPageHeader } from "./MarketplaceAdminPageHeader";

function TopMoversSnapshotMeta({ category }: { category: string }) {
  const { data, isLoading } = useTopMovers(category, TOP_MOVERS_FETCH_COUNT);

  if (isLoading && !data) {
    return <p className={`text-base ${ADMIN_TEXT_EMPTY}`}>Loading snapshot metadata…</p>;
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
          <dt className={ADMIN_TEXT_META}>Cards</dt>
          <dd className="text-zinc-800">{data?.items.length ?? 0}</dd>
        </div>
        <div>
          <dt className={ADMIN_TEXT_META}>Fetched at</dt>
          <dd className="text-zinc-800">{data?.fetchedAt ?? "—"}</dd>
        </div>
        <div>
          <dt className={ADMIN_TEXT_META}>From cache</dt>
          <dd className="text-zinc-800">{data?.fromCache ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className={ADMIN_TEXT_META}>Cache expires</dt>
          <dd className="text-zinc-800">{data?.cacheExpiresAt ?? "—"}</dd>
        </div>
        <div>
          <dt className={ADMIN_TEXT_META}>Gain threshold</dt>
          <dd className="text-zinc-800">
            {data?.gainThreshold != null ? `${data.gainThreshold}%` : "—"}
          </dd>
        </div>
      </dl>
      <p className={`mt-4 text-sm leading-relaxed ${ADMIN_TEXT_SECONDARY}`}>
        Admin preview only — public Markets Top Movers UI remains disabled until
        production rollout. Data is served from Cardhedger{" "}
        <code className="font-mono text-zinc-800">top-movers</code> (1h server cache).
      </p>
    </div>
  );
}

function MarketplaceAdminTopMoversPageContent() {
  const searchParams = useSearchParams();
  const category = searchParams.get("category") ?? "Pokemon";

  return (
    <>
      <MarketplaceAdminPageHeader
        title="Top Movers preview"
        subtitle="Weekly gain leaders from Cardhedger (admin only)."
      />
      <TopMoversSnapshotMeta category={category} />
      <div className={ADMIN_EMBEDDED_DARK}>
        <TopMoversSection
          routing={ADMIN_TOP_MOVERS_ROUTING}
          title={`${TOP_MOVERS_SECTION_TITLE} (admin)`}
          itemCount={TOP_MOVERS_FETCH_COUNT}
          initialCategory={category}
        />
      </div>
    </>
  );
}

export function MarketplaceAdminTopMoversPage() {
  return (
    <Suspense fallback={<p className={`text-sm ${ADMIN_TEXT_EMPTY}`}>Loading…</p>}>
      <MarketplaceAdminTopMoversPageContent />
    </Suspense>
  );
}
