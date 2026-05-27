"use client";

import { useMemo } from "react";
import {
  buildRwaDetailMobileTrustView,
  type RwaDetailMetadata,
} from "@/components/marketplace/RwaDetailAssetPanel";
import {
  formatReferencePercentChange,
  formatUsdCompact,
  isFlatReferencePercentChange,
  MARKET_PRICE_CHANGE_PERIOD_SHORT,
  referenceChangeTone,
} from "@/lib/market";

function formatPopCompact(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${m >= 10 ? Math.round(m) : m.toFixed(1)}M`;
  }
  if (n >= 10_000) {
    const k = n / 1_000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1)}k`;
  }
  return n.toLocaleString("en-US");
}

function TrustStat({
  label,
  value,
  valueClassName = "text-white",
  title,
  href,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  title?: string;
  href?: string;
}) {
  const valueNode = href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`max-w-full truncate text-[13px] font-bold tabular-nums leading-tight underline decoration-zinc-600 underline-offset-2 transition-colors hover:text-mint hover:decoration-mint/50 ${valueClassName}`}
      title={title ?? "Verify on PSA"}
    >
      {value}
    </a>
  ) : (
    <span
      className={`max-w-full truncate text-[13px] font-bold tabular-nums leading-tight ${valueClassName}`}
      title={title}
    >
      {value}
    </span>
  );

  return (
    <div className="flex min-w-[3.25rem] flex-1 flex-col items-center justify-center gap-0.5 px-0.5 py-1 text-center sm:min-w-0">
      <span className="text-[10px] font-medium leading-tight text-zinc-500">
        {label}
      </span>
      {valueNode}
    </div>
  );
}

function MobileMarketContext({
  externalRefUsd,
  marketChangePct,
  marketChangePeriodShort = MARKET_PRICE_CHANGE_PERIOD_SHORT,
  marketChangePeriodLabel,
  marketChangeCoverageHint,
}: {
  externalRefUsd: number | null;
  marketChangePct: number | null;
  marketChangePeriodShort?: string;
  marketChangePeriodLabel?: string;
  marketChangeCoverageHint?: string;
}) {
  if (externalRefUsd == null && marketChangePct == null) return null;
  const showRef = externalRefUsd != null;
  const showChange =
    marketChangePct != null && Number.isFinite(marketChangePct);
  const changeShowsPct =
    showChange && !isFlatReferencePercentChange(marketChangePct);
  const changeTone = changeShowsPct ? referenceChangeTone(marketChangePct) : null;

  return (
    <div className="mt-4 w-full min-w-0 shrink-0 px-3 py-1 sm:px-4">
      <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
        Market context
      </p>
      <div className="w-full min-w-0">
        <div className="mobile-scroll-x-contain flex min-w-0 justify-between gap-1 px-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {showRef ? (
            <TrustStat
              label="eBay ref"
              value={formatUsdCompact(externalRefUsd)}
              valueClassName="text-[#87FF48]"
              title="eBay reference price"
            />
          ) : null}
          {showChange ? (
            <TrustStat
              label={marketChangePeriodShort}
              value={
                changeShowsPct
                  ? formatReferencePercentChange(marketChangePct, 0)
                  : "0.0%"
              }
              valueClassName={
                changeTone === "up"
                  ? "text-mint"
                  : changeTone === "down"
                    ? "text-rose-400"
                    : "text-zinc-300"
              }
              title={`Collection ${marketChangePeriodLabel ?? marketChangePeriodShort} change${
                marketChangeCoverageHint ? ` — ${marketChangeCoverageHint}` : ""
              }`}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function TrustStripSkeleton() {
  return (
    <div className="mobile-scroll-x-contain flex w-full min-w-0 shrink-0 justify-between gap-1 px-3 py-1 sm:px-4 lg:hidden">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-0.5 px-0.5 py-1">
          <span className="h-2.5 w-10 animate-pulse rounded bg-zinc-800/90" aria-hidden />
          <span className="h-4 w-14 animate-pulse rounded bg-zinc-800/80" aria-hidden />
        </div>
      ))}
    </div>
  );
}

export function RwaDetailMobileSpecsPanel({
  metadata,
  loading = false,
  externalRefUsd = null,
  marketChangePct = null,
  marketChangePeriodShort,
  marketChangePeriodLabel,
  marketChangeCoverageHint,
  showMarketContext = false,
}: {
  metadata: RwaDetailMetadata | null;
  loading?: boolean;
  externalRefUsd?: number | null;
  marketChangePct?: number | null;
  marketChangePeriodShort?: string;
  marketChangePeriodLabel?: string;
  marketChangeCoverageHint?: string;
  showMarketContext?: boolean;
}) {
  const view = useMemo(
    () => buildRwaDetailMobileTrustView(metadata),
    [metadata],
  );

  const hasTrust =
    view.gradeLine != null ||
    view.population != null ||
    view.certNumber != null;
  const hasMarket =
    showMarketContext &&
    (externalRefUsd != null || marketChangePct != null);

  if (loading && !hasTrust) {
    return <TrustStripSkeleton />;
  }

  if (!hasTrust && !hasMarket) {
    return null;
  }

  const popTitle =
    view.populationHigher != null && view.populationHigher > 0
      ? `PSA population · ${view.populationHigher.toLocaleString("en-US")} graded higher`
      : "PSA population for this grade";

  const certDisplay = view.certNumber
    ? view.certNumber.length > 8
      ? `···${view.certNumber.slice(-4)}`
      : view.certNumber
    : "—";

  return (
    <section
      className="mx-auto w-full max-w-[32rem] min-w-0 pb-5 pt-4 lg:hidden"
      aria-label="Card details"
    >
      {hasTrust ? (
        <div className="mobile-scroll-x-contain flex w-full min-w-0 shrink-0 justify-between gap-1 px-3 py-1 [scrollbar-width:none] sm:px-4 [&::-webkit-scrollbar]:hidden">
          <TrustStat
            label="Grade"
            value={view.gradeLine ?? "—"}
            valueClassName={view.gradeLine ? "text-mint" : "text-zinc-500"}
          />
          <TrustStat
            label="Pop"
            value={
              view.population != null ? formatPopCompact(view.population) : "—"
            }
            title={popTitle}
          />
          <TrustStat
            label="Cert"
            value={certDisplay}
            href={view.certVerifyUrl ?? undefined}
            valueClassName={
              view.certVerifyUrl && view.certNumber
                ? "text-white"
                : "text-zinc-400"
            }
            title={
              view.certNumber
                ? view.certVerifyUrl
                  ? `Cert ${view.certNumber} — verify on PSA`
                  : `Cert ${view.certNumber}`
                : undefined
            }
          />
        </div>
      ) : null}

      {hasMarket ? (
        <MobileMarketContext
          externalRefUsd={externalRefUsd ?? null}
          marketChangePct={marketChangePct ?? null}
          marketChangePeriodShort={marketChangePeriodShort}
          marketChangePeriodLabel={marketChangePeriodLabel}
          marketChangeCoverageHint={marketChangeCoverageHint}
        />
      ) : null}
    </section>
  );
}
