"use client";

import Link from "next/link";
import { useHomeMarketplaceGrids } from "@/hooks/home";
import { buildMarketsCollectionTitle } from "@/lib/markets/marketsCollectionTitle";
import {
  resolveMarketsListingMarketChangePct90d,
  resolveMarketsListingMarketUsd,
} from "@/lib/markets/marketsListingMarketPrice";
import { formatUsdCompact } from "@/lib/market";
import {
  ADMIN_ARTICLE,
  ADMIN_EMBEDDED_DARK,
  ADMIN_TABLE,
  ADMIN_TABLE_HEAD,
  ADMIN_TABLE_TD,
  ADMIN_TABLE_TH,
  ADMIN_TABLE_WRAP,
  ADMIN_TEXT_EMPTY,
  ADMIN_TEXT_META,
  ADMIN_TEXT_SECONDARY,
} from "../adminUi";

function AdminHomePreviewTable({
  title,
  subtitle,
  rows,
  snapshotByKey,
  showChange,
  isPending,
}: {
  title: string;
  subtitle: string;
  rows: ReturnType<typeof useHomeMarketplaceGrids>["topMovers"];
  snapshotByKey: ReturnType<typeof useHomeMarketplaceGrids>["snapshotByKey"];
  showChange: boolean;
  isPending: boolean;
}) {
  return (
    <div className={ADMIN_ARTICLE}>
      <div className="mb-4">
        <h3 className="text-base font-semibold text-zinc-900">{title}</h3>
        <p className={`mt-1 text-sm ${ADMIN_TEXT_SECONDARY}`}>{subtitle}</p>
      </div>
      {isPending ? (
        <p className={`text-sm ${ADMIN_TEXT_EMPTY}`}>Loading catalog…</p>
      ) : rows.length === 0 ? (
        <p className={`text-sm ${ADMIN_TEXT_EMPTY}`}>No collections to show.</p>
      ) : (
        <div className={ADMIN_TABLE_WRAP}>
          <table className={ADMIN_TABLE}>
            <thead className={ADMIN_TABLE_HEAD}>
              <tr>
                <th className={ADMIN_TABLE_TH}>Collection</th>
                <th className={ADMIN_TABLE_TH}>Grade</th>
                <th className={`${ADMIN_TABLE_TH} text-right`}>Mark</th>
                {showChange ? (
                  <th className={`${ADMIN_TABLE_TH} text-right`}>90d</th>
                ) : null}
                <th className={`${ADMIN_TABLE_TH} text-right`}>Listed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => {
                const snap = snapshotByKey.get(c.collectionKey.toLowerCase());
                const price = resolveMarketsListingMarketUsd(c, snap);
                const change = showChange
                  ? resolveMarketsListingMarketChangePct90d(snap)
                  : null;
                const grade =
                  c.components?.gradeScore && c.components?.gradingCompany
                    ? `${c.components.gradingCompanyDisplay ?? c.components.gradingCompany} ${c.components.gradeScore}`
                    : c.components?.psaGradeLabel ?? "—";
                return (
                  <tr key={c.collectionKey}>
                    <td className={ADMIN_TABLE_TD}>
                      <Link
                        href={`/marketplace/collections/${encodeURIComponent(c.collectionKey)}`}
                        className="font-medium text-blue-600 hover:text-blue-700"
                        target="_blank"
                        rel="noreferrer"
                      >
                        {buildMarketsCollectionTitle({ collection: c, comp: c.components })}
                      </Link>
                      <p className={`mt-0.5 text-xs ${ADMIN_TEXT_META}`}>
                        {c.collectionKey}
                      </p>
                    </td>
                    <td className={ADMIN_TABLE_TD}>{grade}</td>
                    <td className={`${ADMIN_TABLE_TD} text-right font-mono text-sm`}>
                      {price != null ? formatUsdCompact(price) : "—"}
                    </td>
                    {showChange ? (
                      <td
                        className={`${ADMIN_TABLE_TD} text-right font-mono text-sm ${
                          change != null && change > 0
                            ? "text-emerald-700"
                            : change != null && change < 0
                              ? "text-red-600"
                              : ""
                        }`}
                      >
                        {change != null ? `${change > 0 ? "+" : ""}${change.toFixed(1)}%` : "—"}
                      </td>
                    ) : null}
                    <td className={`${ADMIN_TABLE_TD} text-right font-mono text-sm`}>
                      {c.activeListingCount}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function AdminHomePreviewPanel() {
  const {
    topMovers,
    justVaulted,
    snapshotByKey,
    isPending,
    snapshotsPending,
  } = useHomeMarketplaceGrids();

  const loading = isPending || snapshotsPending;

  return (
    <div className="space-y-6">
      <div className={`${ADMIN_ARTICLE} ${ADMIN_TEXT_SECONDARY} text-sm`}>
        <p className="font-semibold text-zinc-900">Home landing preview</p>
        <p className="mt-2 leading-relaxed">
          Mirrors the public home page: <strong>Top movers</strong> ranks every
          marketplace collection by <strong>90-day</strong> Cardhedger reference
          gain (max 20, positive only). <strong>Just vaulted</strong> lists the 20
          most recently minted collections by <code className="font-mono text-xs">createdAt</code>.
        </p>
        <p className="mt-2">
          <Link href="/" className="font-medium text-blue-600 hover:text-blue-700" target="_blank" rel="noreferrer">
            Open live home ↗
          </Link>
        </p>
      </div>

      <AdminHomePreviewTable
        title="Top movers (90d)"
        subtitle="Same ranking as home — highest 90-day price gain across all collections."
        rows={topMovers}
        snapshotByKey={snapshotByKey}
        showChange
        isPending={loading}
      />

      <AdminHomePreviewTable
        title="Just vaulted"
        subtitle="Newest minted collections — same order as home Just vaulted carousel."
        rows={justVaulted}
        snapshotByKey={snapshotByKey}
        showChange={false}
        isPending={loading}
      />

      <div className={ADMIN_EMBEDDED_DARK}>
        <p className={`px-1 pb-3 text-xs ${ADMIN_TEXT_META}`}>
          Dark carousel below matches the on-site card UI (read-only preview).
        </p>
        <div className="rounded-xl border border-zinc-700/50 bg-[#0a0a0f] p-4">
          <p className="mb-3 text-sm font-semibold text-white">Top movers cards</p>
          <p className={`text-xs ${ADMIN_TEXT_META}`}>
            {topMovers.length} collections — open home for full carousel UX.
          </p>
        </div>
      </div>
    </div>
  );
}
