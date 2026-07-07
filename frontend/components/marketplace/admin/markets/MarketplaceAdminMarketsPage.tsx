"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CardTop100Section } from "@/components/markets/CardTop100Section";
import { TopMoversSection } from "@/components/markets/TopMoversSection";
import { useTop100, useTop100Categories } from "@/hooks/markets/usePokemonTop100";
import { useTopMovers } from "@/hooks/markets/useTopMovers";
import {
  TOP_MOVERS_FETCH_COUNT,
  TOP_MOVERS_SECTION_TITLE,
} from "@/lib/markets/top100Copy";
import { ADMIN_TOP100_ROUTING, ADMIN_TOP_MOVERS_ROUTING } from "@/lib/markets/top100Routing";
import { AdminTabBar } from "../shared/AdminTabBar";
import { AdminHomePreviewPanel } from "./AdminHomePreviewPanel";
import {
  ADMIN_ARTICLE,
  ADMIN_EMBEDDED_DARK,
  ADMIN_TEXT_EMPTY,
  ADMIN_TEXT_META,
  ADMIN_TEXT_SECONDARY,
} from "../adminUi";
import { MarketplaceAdminPageHeader } from "../MarketplaceAdminPageHeader";

const MARKETS_TABS = [
  { id: "home", label: "Home landing", href: "/marketplace/admin/markets?tab=home" },
  { id: "top100", label: "Top 100", href: "/marketplace/admin/markets?tab=top100" },
  {
    id: "cardhedger-movers",
    label: "Cardhedger movers",
    href: "/marketplace/admin/markets?tab=cardhedger-movers",
  },
] as const;

type MarketsTabId = (typeof MARKETS_TABS)[number]["id"];

function resolveTab(raw: string | null): MarketsTabId {
  if (raw === "top100" || raw === "cardhedger-movers" || raw === "home") return raw;
  return "home";
}

function Top100SnapshotMeta({ category }: { category: string }) {
  const { data: categories = [] } = useTop100Categories();
  const { data, isLoading } = useTop100(category);

  if (isLoading && !data) {
    return <p className={`text-base ${ADMIN_TEXT_EMPTY}`}>Loading snapshot metadata…</p>;
  }

  return (
    <div className={`${ADMIN_ARTICLE} mb-5 sm:mb-6 ${ADMIN_TEXT_SECONDARY} text-sm sm:text-base`}>
      <p className="text-base font-semibold text-zinc-900">Top 100 snapshot</p>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <dt className={ADMIN_TEXT_META}>Category</dt>
          <dd className="text-zinc-800">{data?.category ?? category}</dd>
        </div>
        <div>
          <dt className={ADMIN_TEXT_META}>Snapshot date (KST)</dt>
          <dd className="text-zinc-800">{data?.snapshotDate ?? "—"}</dd>
        </div>
        <div>
          <dt className={ADMIN_TEXT_META}>Cards</dt>
          <dd className="text-zinc-800">{data?.items.length ?? 0}</dd>
        </div>
        <div>
          <dt className={ADMIN_TEXT_META}>Categories discovered</dt>
          <dd className="text-zinc-800">{categories.length || "—"}</dd>
        </div>
      </dl>
    </div>
  );
}

function TopMoversSnapshotMeta({ category }: { category: string }) {
  const { data, isLoading } = useTopMovers(category, TOP_MOVERS_FETCH_COUNT);

  if (isLoading && !data) {
    return <p className={`text-base ${ADMIN_TEXT_EMPTY}`}>Loading snapshot metadata…</p>;
  }

  return (
    <div className={`${ADMIN_ARTICLE} mb-5 sm:mb-6 ${ADMIN_TEXT_SECONDARY} text-sm sm:text-base`}>
      <p className="text-base font-semibold text-zinc-900">Cardhedger top movers</p>
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
          <dt className={ADMIN_TEXT_META}>From cache</dt>
          <dd className="text-zinc-800">{data?.fromCache ? "Yes" : "No"}</dd>
        </div>
        <div>
          <dt className={ADMIN_TEXT_META}>Gain threshold</dt>
          <dd className="text-zinc-800">
            {data?.gainThreshold != null ? `${data.gainThreshold}%` : "—"}
          </dd>
        </div>
      </dl>
      <p className={`mt-4 text-sm leading-relaxed ${ADMIN_TEXT_SECONDARY}`}>
        Weekly gain leaders from Cardhedger upstream — separate from home Top movers
        (90-day, all Tokenable collections).
      </p>
    </div>
  );
}

function MarketplaceAdminMarketsPageContent() {
  const searchParams = useSearchParams();
  const tab = resolveTab(searchParams.get("tab"));
  const category = searchParams.get("category") ?? "Pokemon";

  return (
    <>
      <MarketplaceAdminPageHeader
        title="Markets preview"
        subtitle="Home landing rankings plus Cardhedger catalog widgets (admin only)."
      />

      <AdminTabBar tabs={[...MARKETS_TABS]} activeId={tab} />

      {tab === "home" ? <AdminHomePreviewPanel /> : null}

      {tab === "top100" ? (
        <>
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
      ) : null}

      {tab === "cardhedger-movers" ? (
        <>
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
      ) : null}
    </>
  );
}

export function MarketplaceAdminMarketsPage() {
  return (
    <Suspense fallback={<p className={`text-sm ${ADMIN_TEXT_EMPTY}`}>Loading…</p>}>
      <MarketplaceAdminMarketsPageContent />
    </Suspense>
  );
}
