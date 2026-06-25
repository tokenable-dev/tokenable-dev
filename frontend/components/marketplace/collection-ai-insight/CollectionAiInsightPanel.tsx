"use client";

import Link from "next/link";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import type {
  CollectionAiInsightResponse,
  CollectionAiInsightSections,
  CollectionListMarketSnapshot,
  MarketplaceCollectionSummary,
} from "@/lib/core";
import { formatUsdCompact } from "@/lib/market";
import { useCollectionAiInsight } from "@/hooks/collection-ai-insight/useCollectionAiInsight";
import { CollectionAiInsightSparkline } from "./CollectionAiInsightSparkline";

function formatPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(1)}%`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/50 p-3">
      <h5 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:text-sm">
        {title}
      </h5>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="space-y-2">
      {items.map((line) => (
        <li
          key={line}
          className="flex gap-2 text-[13px] leading-relaxed text-zinc-300 sm:text-sm before:mt-2 before:h-1.5 before:w-1.5 before:shrink-0 before:rounded-full before:bg-mint/80 before:content-['']"
        >
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

function confidenceBadge(level: "high" | "medium" | "low") {
  if (level === "high") return "text-mint border-mint/30 bg-mint/10";
  if (level === "medium") return "text-amber-300 border-amber-500/30 bg-amber-500/10";
  return "text-zinc-400 border-zinc-600/40 bg-zinc-800/40";
}

function DataSourcesFooter({ sources }: { sources?: string[] }) {
  if (!sources?.length) return null;
  return (
    <p className="mt-2 text-[9px] leading-relaxed text-zinc-600">
      Sources: {sources.join(" · ")}
    </p>
  );
}

function MetricGrid({
  items,
}: {
  items: Array<{ label: string; value: React.ReactNode } | null>;
}) {
  const rows = items.filter(Boolean) as Array<{ label: string; value: React.ReactNode }>;
  if (rows.length === 0) return null;
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {rows.map((row) => (
        <div
          key={row.label}
          className="rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-2 py-1.5"
        >
          <dt className="text-[9px] uppercase text-zinc-600">{row.label}</dt>
          <dd className="text-[12px] font-semibold text-white">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ScoredBreakdown({
  score,
  components,
}: {
  score: number;
  components: Array<{
    key: string;
    label: string;
    score: number;
    weight: number;
    contribution: number;
  }>;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-mint/40 bg-mint/10">
        <span className="text-lg font-bold text-mint">{score}</span>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        {components.map((c) => (
          <div key={c.key} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-zinc-400">
              {c.label}{" "}
              <span className="text-zinc-600">(w{c.weight}%)</span>
            </span>
            <span className="font-semibold text-zinc-200">
              +{c.contribution.toFixed(1)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function volatilityLabel(level: "low" | "medium" | "high" | null | undefined): string {
  if (!level) return "—";
  return level.charAt(0).toUpperCase() + level.slice(1);
}

function cycleLabel(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function InsightSections({ sections }: { sections: CollectionAiInsightSections }) {
  return (
    <div className="space-y-3">
      {sections.executiveSummary ? (
        <SectionCard title="AI market summary">
          <div className="space-y-2">
            {sections.executiveSummary.paragraphs.map((p) => (
              <p key={p} className="text-[12px] leading-relaxed text-zinc-300">
                {p}
              </p>
            ))}
          </div>
          <DataSourcesFooter sources={sections.executiveSummary.dataSources} />
        </SectionCard>
      ) : null}

      {sections.cardIdentity ? (
        <SectionCard title="Card identity">
          <dl className="grid gap-2 sm:grid-cols-2">
            {sections.cardIdentity.facts.map((f) => (
              <div
                key={f.label}
                className="flex items-center justify-between rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-2"
              >
                <dt className="text-[11px] text-zinc-400">{f.label}</dt>
                <dd className="text-[12px] font-semibold text-white">{f.value}</dd>
              </div>
            ))}
          </dl>
          <DataSourcesFooter sources={sections.cardIdentity.dataSources} />
        </SectionCard>
      ) : null}

      {sections.marketStructure ? (
        <SectionCard title="Market structure">
          <BulletList items={sections.marketStructure.commentary} />
          <MetricGrid
            items={[
              sections.marketStructure.spotUsd != null
                ? { label: "Spot", value: formatUsdCompact(sections.marketStructure.spotUsd) }
                : null,
              sections.marketStructure.compLowUsd != null
                ? { label: "Comp low", value: formatUsdCompact(sections.marketStructure.compLowUsd) }
                : null,
              sections.marketStructure.compHighUsd != null
                ? { label: "Comp high", value: formatUsdCompact(sections.marketStructure.compHighUsd) }
                : null,
              sections.marketStructure.tokenableFloorUsd != null
                ? {
                    label: "Tokenable floor",
                    value: formatUsdCompact(sections.marketStructure.tokenableFloorUsd),
                  }
                : null,
              sections.marketStructure.floorPremiumPct != null
                ? {
                    label: "Floor vs spot",
                    value: formatPct(sections.marketStructure.floorPremiumPct),
                  }
                : null,
              sections.marketStructure.listingConcentrationPct != null
                ? {
                    label: "Listing concentration",
                    value: formatPct(sections.marketStructure.listingConcentrationPct),
                  }
                : null,
            ]}
          />
          {sections.marketStructure.marketplaceDistribution.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {sections.marketStructure.marketplaceDistribution.map((m) => (
                <span
                  key={m.label}
                  className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-[10px] text-zinc-400"
                >
                  {m.label}{" "}
                  <span className="font-semibold text-zinc-200">{m.pct.toFixed(0)}%</span>
                </span>
              ))}
            </div>
          ) : null}
          <DataSourcesFooter sources={sections.marketStructure.dataSources} />
        </SectionCard>
      ) : null}

      {sections.marketPerformance ? (
        <SectionCard title="Market performance">
          <BulletList items={sections.marketPerformance.commentary} />
          {sections.marketPerformance.trends.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {sections.marketPerformance.trends.map((t) => (
                <span
                  key={t.window}
                  className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1 text-[10px] text-zinc-400"
                >
                  {t.window}{" "}
                  <span className="font-semibold text-zinc-200">
                    {formatPct(t.changePct)}
                  </span>
                </span>
              ))}
            </div>
          ) : null}
          <DataSourcesFooter sources={sections.marketPerformance.dataSources} />
        </SectionCard>
      ) : null}

      {sections.priceTrend ? (
        <SectionCard title="Price trend insight">
          {sections.priceTrend.label ? (
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-mint/90">
              {sections.priceTrend.label}
            </p>
          ) : null}
          <BulletList items={sections.priceTrend.commentary} />
          <MetricGrid
            items={(
              [
                ["Low", sections.priceTrend.lowestUsd],
                ["High", sections.priceTrend.highestUsd],
                ["Median", sections.priceTrend.medianSaleUsd],
                ["Recent", sections.priceTrend.recentSaleUsd],
              ] as const
            ).map(([label, val]) =>
              val != null ? { label, value: formatUsdCompact(val) } : null,
            )}
          />
          <DataSourcesFooter sources={sections.priceTrend.dataSources} />
        </SectionCard>
      ) : null}

      {sections.fmv ? (
        <SectionCard title="FMV analysis">
          <MetricGrid
            items={[
              sections.fmv.currentUsd != null
                ? { label: "Current", value: formatUsdCompact(sections.fmv.currentUsd) }
                : null,
              sections.fmv.fmvUsd != null
                ? { label: "FMV", value: formatUsdCompact(sections.fmv.fmvUsd) }
                : null,
              sections.fmv.premiumVsFmvPct != null
                ? { label: "Premium / discount", value: formatPct(sections.fmv.premiumVsFmvPct) }
                : null,
              sections.fmv.confidenceGrade
                ? { label: "Confidence", value: sections.fmv.confidenceGrade }
                : null,
            ]}
          />
          {sections.fmv.method ? (
            <p className="mt-2 text-[11px] text-zinc-500">
              Method: {sections.fmv.method}
              {sections.fmv.freshnessDays != null
                ? ` · ${sections.fmv.freshnessDays}d fresh`
                : ""}
            </p>
          ) : null}
          <DataSourcesFooter sources={sections.fmv.dataSources} />
        </SectionCard>
      ) : null}

      {sections.gradePremium ? (
        <SectionCard title="Grade premium">
          <dl className="grid gap-2 sm:grid-cols-2">
            {sections.gradePremium.grades.map((g) => (
              <div
                key={g.grade}
                className="flex items-center justify-between rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-2"
              >
                <dt className="text-[11px] text-zinc-400">{g.grade}</dt>
                <dd className="text-[12px] font-semibold text-white">
                  {g.priceUsd != null ? formatUsdCompact(g.priceUsd) : "—"}
                </dd>
              </div>
            ))}
          </dl>
          <MetricGrid
            items={[
              sections.gradePremium.psa10VsRawPct != null
                ? { label: "PSA10 vs raw", value: formatPct(sections.gradePremium.psa10VsRawPct) }
                : null,
              sections.gradePremium.psa10VsPsa9Ratio != null
                ? {
                    label: "PSA10 / PSA9",
                    value: `${sections.gradePremium.psa10VsPsa9Ratio.toFixed(2)}×`,
                  }
                : null,
              sections.gradePremium.psa10VsPsa8Ratio != null
                ? {
                    label: "PSA10 / PSA8",
                    value: `${sections.gradePremium.psa10VsPsa8Ratio.toFixed(2)}×`,
                  }
                : null,
            ]}
          />
          <DataSourcesFooter sources={sections.gradePremium.dataSources} />
        </SectionCard>
      ) : null}

      {sections.volatility ? (
        <SectionCard title="Volatility">
          <MetricGrid
            items={[
              sections.volatility.vol30dPct != null
                ? {
                    label: "30d",
                    value: `${sections.volatility.vol30dPct.toFixed(1)}% · ${volatilityLabel(sections.volatility.level30d)}`,
                  }
                : null,
              sections.volatility.vol90dPct != null
                ? {
                    label: "90d",
                    value: `${sections.volatility.vol90dPct.toFixed(1)}% · ${volatilityLabel(sections.volatility.level90d)}`,
                  }
                : null,
              sections.volatility.vol365dPct != null
                ? {
                    label: "365d",
                    value: `${sections.volatility.vol365dPct.toFixed(1)}% · ${volatilityLabel(sections.volatility.level365d)}`,
                  }
                : null,
            ]}
          />
          <DataSourcesFooter sources={sections.volatility.dataSources} />
        </SectionCard>
      ) : null}

      {sections.marketCycle ? (
        <SectionCard title="Market cycle">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-mint/90">
            {cycleLabel(sections.marketCycle.label)}
          </p>
          <BulletList items={sections.marketCycle.reasoning} />
          <DataSourcesFooter sources={sections.marketCycle.dataSources} />
        </SectionCard>
      ) : null}

      {sections.liquidity ? (
        <SectionCard title="Market liquidity">
          <BulletList items={sections.liquidity.commentary} />
          <MetricGrid
            items={[
              sections.liquidity.sales7d != null
                ? { label: "7d sales", value: sections.liquidity.sales7d }
                : null,
              sections.liquidity.sales30d != null
                ? { label: "30d sales", value: sections.liquidity.sales30d }
                : null,
              sections.liquidity.avgDaysBetweenSales != null
                ? {
                    label: "Avg gap",
                    value: `${sections.liquidity.avgDaysBetweenSales.toFixed(1)}d`,
                  }
                : null,
              sections.liquidity.tokenableActiveListings != null
                ? { label: "Listings", value: sections.liquidity.tokenableActiveListings }
                : null,
              sections.liquidity.listingToSaleRatio != null
                ? {
                    label: "Listing / sale ratio",
                    value: sections.liquidity.listingToSaleRatio.toFixed(2),
                  }
                : null,
            ]}
          />
          <DataSourcesFooter sources={sections.liquidity.dataSources} />
        </SectionCard>
      ) : null}

      {sections.demand ? (
        <SectionCard title="Collector demand signal">
          <ScoredBreakdown
            score={sections.demand.score}
            components={sections.demand.components}
          />
          <div className="mt-3">
            <BulletList items={sections.demand.reasoning} />
          </div>
          <DataSourcesFooter sources={sections.demand.dataSources} />
        </SectionCard>
      ) : null}

      {sections.rarity ? (
        <SectionCard title="Rarity analysis">
          <BulletList items={sections.rarity.commentary} />
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            {sections.rarity.populations.map((row) => (
              <div
                key={row.label}
                className="flex items-center justify-between rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-2"
              >
                <dt className="text-[11px] text-zinc-400">{row.label}</dt>
                <dd className="text-[12px] font-semibold text-white">
                  {row.count.toLocaleString("en-US")}
                </dd>
              </div>
            ))}
          </dl>
          {sections.rarity.gradeDistribution.length > 0 ? (
            <div className="mt-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                Grade distribution
              </p>
              <dl className="grid gap-2 sm:grid-cols-3">
                {sections.rarity.gradeDistribution.map((row) => (
                  <div
                    key={row.label}
                    className="flex items-center justify-between rounded-lg border border-zinc-800/70 bg-zinc-900/40 px-3 py-2"
                  >
                    <dt className="text-[11px] text-zinc-400">{row.label}</dt>
                    <dd className="text-[12px] font-semibold text-white">
                      {row.count.toLocaleString("en-US")}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : null}
          <MetricGrid
            items={[
              sections.rarity.psa10SharePct != null
                ? { label: "PSA10 share", value: formatPct(sections.rarity.psa10SharePct) }
                : null,
              sections.rarity.scarcityRatio10vs9 != null
                ? {
                    label: "PSA10 / PSA9 ratio",
                    value: `${sections.rarity.scarcityRatio10vs9.toFixed(2)}×`,
                  }
                : null,
            ]}
          />
          <DataSourcesFooter sources={sections.rarity.dataSources} />
        </SectionCard>
      ) : null}

      {sections.marketRank ? (
        <SectionCard title="Market rank">
          <MetricGrid
            items={[
              { label: "Rank", value: `#${sections.marketRank.rank}` },
              { label: "Category", value: sections.marketRank.category },
              sections.marketRank.rankChange30d != null
                ? {
                    label: "30d change",
                    value:
                      sections.marketRank.rankChange30d > 0
                        ? `+${sections.marketRank.rankChange30d}`
                        : String(sections.marketRank.rankChange30d),
                  }
                : null,
              { label: "Percentile", value: `${sections.marketRank.percentile}%` },
            ]}
          />
          <DataSourcesFooter sources={sections.marketRank.dataSources} />
        </SectionCard>
      ) : null}

      {sections.opportunity ? (
        <SectionCard title="Opportunity score">
          <ScoredBreakdown
            score={sections.opportunity.score}
            components={sections.opportunity.components}
          />
          <DataSourcesFooter sources={sections.opportunity.dataSources} />
        </SectionCard>
      ) : null}

      {sections.investmentThesis ? (
        <SectionCard title="Investment thesis">
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["Bull case", sections.investmentThesis.bullCase],
                ["Bear case", sections.investmentThesis.bearCase],
                ["Key risks", sections.investmentThesis.keyRisks],
              ] as const
            ).map(([label, items]) =>
              items.length > 0 ? (
                <div key={label}>
                  <p className="text-[9px] font-bold uppercase tracking-wide text-zinc-500">
                    {label}
                  </p>
                  <BulletList items={items} />
                </div>
              ) : null,
            )}
          </div>
          <DataSourcesFooter sources={sections.investmentThesis.dataSources} />
        </SectionCard>
      ) : null}

      {sections.salesTimeline ? (
        <SectionCard title="Historical sales timeline">
          {sections.salesTimeline.trendSummary ? (
            <p className="mb-2 text-[11px] text-zinc-400">
              {sections.salesTimeline.trendSummary}
            </p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[320px] text-left text-[11px]">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-600">
                  <th className="pb-2 pr-3 font-medium">Date</th>
                  <th className="pb-2 pr-3 font-medium">Price</th>
                  <th className="pb-2 pr-3 font-medium">Marketplace</th>
                  <th className="pb-2 font-medium">Grade</th>
                </tr>
              </thead>
              <tbody>
                {sections.salesTimeline.entries.map((e) => (
                  <tr key={`${e.date}-${e.priceUsd}`} className="border-b border-zinc-900">
                    <td className="py-2 pr-3 text-zinc-400">{formatDate(e.date)}</td>
                    <td className="py-2 pr-3 font-semibold text-white">
                      {formatUsdCompact(e.priceUsd)}
                    </td>
                    <td className="py-2 pr-3 text-zinc-400">{e.marketplace ?? "—"}</td>
                    <td className="py-2 text-zinc-400">{e.grade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <DataSourcesFooter sources={sections.salesTimeline.dataSources} />
        </SectionCard>
      ) : null}

      {sections.psaVerification ? (
        <SectionCard title="PSA verification">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1 text-[12px] text-zinc-300">
              {sections.psaVerification.gradingLabel ? (
                <p>
                  Grade:{" "}
                  <span className="font-semibold text-white">
                    {sections.psaVerification.gradingLabel}
                  </span>
                </p>
              ) : null}
              {sections.psaVerification.certification ? (
                <p>
                  Certification:{" "}
                  <span className="font-mono text-zinc-200">
                    #{sections.psaVerification.certification}
                  </span>
                </p>
              ) : null}
              <p>
                PSA verified:{" "}
                <span className="font-semibold text-white">
                  {sections.psaVerification.psaVerified == null
                    ? "—"
                    : sections.psaVerification.psaVerified
                      ? "Yes"
                      : "No"}
                </span>
              </p>
              <p>
                Cert match:{" "}
                <span className="font-semibold text-white">
                  {sections.psaVerification.certMatch == null
                    ? "—"
                    : sections.psaVerification.certMatch
                      ? "Yes"
                      : "No"}
                </span>
              </p>
              <p>
                Grade match:{" "}
                <span className="font-semibold text-white">
                  {sections.psaVerification.gradeMatch == null
                    ? "—"
                    : sections.psaVerification.gradeMatch
                      ? "Yes"
                      : "No"}
                </span>
              </p>
              <p>
                Market data coverage:{" "}
                <span className="font-semibold text-white">
                  {sections.psaVerification.marketDataCoverage ? "Yes" : "No"}
                </span>
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-center">
              <p className="text-[9px] uppercase text-zinc-600">Trust score</p>
              <p className="text-lg font-bold text-mint">
                {sections.psaVerification.trustScore}
              </p>
            </div>
          </div>
          <div className="mt-2">
            <BulletList items={sections.psaVerification.reasoning} />
          </div>
          <DataSourcesFooter sources={sections.psaVerification.dataSources} />
        </SectionCard>
      ) : null}

      {sections.confidence ? (
        <SectionCard title="Insight confidence">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${confidenceBadge(sections.confidence.level)}`}
            >
              {sections.confidence.level} confidence
            </span>
            <span className="text-[11px] text-zinc-500">
              Score {(sections.confidence.score * 100).toFixed(0)}%
            </span>
          </div>
          <div className="mt-2">
            <BulletList items={sections.confidence.reasoning} />
          </div>
          <DataSourcesFooter sources={sections.confidence.dataSources} />
        </SectionCard>
      ) : null}
    </div>
  );
}

function InsightLoadingShell() {
  return (
    <div className="ai-insight-loading-shell rounded-xl border border-mint/20 p-4">
      <div className="space-y-3">
        <div className="ai-insight-loading-block h-5 w-2/3 rounded bg-zinc-800/80" />
        <div className="ai-insight-loading-block h-16 w-full rounded bg-zinc-800/60" />
        <div className="grid grid-cols-3 gap-2">
          <div className="ai-insight-loading-block h-12 rounded bg-zinc-800/50" />
          <div className="ai-insight-loading-block h-12 rounded bg-zinc-800/50" />
          <div className="ai-insight-loading-block h-12 rounded bg-zinc-800/50" />
        </div>
        <div className="ai-insight-loading-block h-28 w-full rounded bg-zinc-800/40" />
        <p className="text-center text-[10px] font-medium uppercase tracking-widest text-mint/70">
          Scanning Cardhedger market data…
        </p>
      </div>
    </div>
  );
}

function InsightBody({
  insight,
  row,
  snapshot,
}: {
  insight: CollectionAiInsightResponse;
  row: MarketplaceCollectionSummary;
  snapshot?: CollectionListMarketSnapshot;
}) {
  const { components } = row;
  const stats = insight.stats;
  const sections = insight.sections ?? {};
  const refUsd = stats?.psa10SpotUsd ?? snapshot?.gradePrices?.psa10 ?? null;
  const floorUsd = snapshot?.marketStats?.floor ?? null;

  const priceHistorySparkline =
    insight.priceHistory && insight.priceHistory.length >= 2
      ? insight.priceHistory.map((p) => ({ t: p.t, v: p.v }))
      : undefined;

  if (!insight.dataAvailable) {
    return (
      <div className="space-y-3 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4">
        <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-300">
          Admin preview · Cardhedger data required
        </span>
        <h4 className="text-base font-semibold text-white">{insight.title}</h4>
        <p className="text-[13px] leading-relaxed text-zinc-400">{insight.summary}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full border border-mint/30 bg-mint/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-mint">
          Admin preview · Cardhedger live data
        </span>
        {insight.marketTone ? (
          <span className="text-[10px] text-zinc-500">{insight.marketTone}</span>
        ) : null}
      </div>

      <header className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-mint/80 sm:text-xs">
          AI Insight
        </p>
        <h4 className="text-lg font-semibold leading-snug text-white sm:text-xl">
          {insight.title}
        </h4>
        <p className="text-sm leading-relaxed text-zinc-300 sm:text-[15px]">{insight.summary}</p>
      </header>

      {insight.bullets.length > 0 ? (
        <SectionCard title="Key signals">
          <BulletList items={insight.bullets} />
        </SectionCard>
      ) : null}

      {(refUsd != null || priceHistorySparkline || insight.chartSpec?.miniSeries) && (
        <section className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-3">
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h5 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 sm:text-sm">
                Price trajectory
              </h5>
              {refUsd != null ? (
                <p className="text-lg font-semibold text-white">{formatUsdCompact(refUsd)}</p>
              ) : null}
            </div>
            {stats?.change90dPct != null ? (
              <p className="text-[11px] text-zinc-400">
                90d {formatPct(stats.change90dPct)}
                {stats.change30dPct != null ? ` · 30d ${formatPct(stats.change30dPct)}` : ""}
              </p>
            ) : null}
          </div>
          <CollectionAiInsightSparkline
            sparklineUsd={priceHistorySparkline}
            miniSeries={insight.chartSpec?.miniSeries}
          />
          {insight.chartSpec?.visualInterpretation ? (
            <p className="mt-2 text-[11px] leading-relaxed text-zinc-500">
              {insight.chartSpec.visualInterpretation}
            </p>
          ) : null}
        </section>
      )}

      <InsightSections sections={sections} />

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-mint/20 bg-mint/[0.04] p-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-zinc-500">On-platform</p>
          <p className="text-sm font-semibold text-white">
            {floorUsd != null ? formatUsdCompact(floorUsd) : "No floor"}
          </p>
          <p className="text-[10px] text-zinc-500">
            {row.activeListingCount} listing{row.activeListingCount === 1 ? "" : "s"}
          </p>
        </div>
        <Link
          href={`/marketplace/collections/${encodeURIComponent(row.collectionKey)}`}
          className="rounded-lg bg-mint px-4 py-2 text-[11px] font-bold text-[#0a0a0a] hover:bg-mint/90"
        >
          View collection
        </Link>
      </section>

      {(insight.confidenceNote || insight.riskTapeNote || insight.riskLabel) && (
        <footer className="space-y-1 border-t border-zinc-800/60 pt-2 text-[10px] leading-relaxed text-zinc-600">
          {insight.confidence != null ? (
            <p>
              Model confidence: {(insight.confidence * 100).toFixed(0)}%
              {insight.confidenceNote ? ` — ${insight.confidenceNote}` : ""}
            </p>
          ) : insight.confidenceNote ? (
            <p>{insight.confidenceNote}</p>
          ) : null}
          {insight.riskLabel ? (
            <p>
              Risk: {insight.riskLabel}
              {insight.riskScore != null ? ` (${insight.riskScore}/100)` : ""}
              {insight.riskTapeNote ? ` — ${insight.riskTapeNote}` : ""}
            </p>
          ) : insight.riskTapeNote ? (
            <p>{insight.riskTapeNote}</p>
          ) : null}
          <p className="text-zinc-700">
            Generated {new Date(insight.generatedAt).toLocaleString()}
            {components.psaCertNumber ? ` · Cert #${components.psaCertNumber}` : ""}
          </p>
        </footer>
      )}
    </div>
  );
}

export function CollectionAiInsightPanel({
  row,
  snapshot,
  enabled,
}: {
  row: MarketplaceCollectionSummary;
  snapshot?: CollectionListMarketSnapshot;
  enabled: boolean;
}) {
  const { loading, error, insight } = useCollectionAiInsight(row.collectionKey, { enabled });

  if (!enabled) {
    return (
      <p className="text-[11px] text-zinc-500">
        Expand to load AI insight for this collection.
      </p>
    );
  }

  if (loading) return <InsightLoadingShell />;

  if (error) {
    return (
      <p className="text-[11px] text-red-400" role="alert">
        {error instanceof Error ? error.message : "Failed to load AI insight"}
      </p>
    );
  }

  if (!insight) {
    return <p className="text-[11px] text-zinc-500">No insight data.</p>;
  }

  return <InsightBody insight={insight} row={row} snapshot={snapshot} />;
}
