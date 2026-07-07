"use client";

import {
  formatReferencePercentChange,
  formatUsdCompact,
  formatPsaPopulationCount,
  formatPsaPopulationPair,
  NO_EXTERNAL_PRICE,
  REFERENCE_CHANGE_UNAVAILABLE_LABEL,
  referenceChangeTone,
} from "@/lib/market";
import type { PsaPopulationMetrics } from "@/lib/market/gradedCardMarketCap";
import type { ReferencePercentChangeResult } from "@/lib/market/priceChangePeriod";
import { formatReferenceChangePeriodShort } from "@/lib/market/priceChangePeriod";

function formatChangeTag(pct: number): { arrow: string; label: string } {
  const tone = referenceChangeTone(pct);
  return {
    arrow: tone === "down" ? "▼" : "▲",
    label: formatReferencePercentChange(pct),
  };
}

function changePeriodHint(
  period: ReferencePercentChangeResult | null | undefined,
  gradeLabel: string,
): string {
  const window = formatReferenceChangePeriodShort(
    period ?? null,
    period?.marketChangeWindow ?? null,
  );
  return `${window} change · ${gradeLabel}`;
}

export function CollectionDetailStatMain({
  imageUrl,
  priceUsd,
  priceLoading,
  changePct,
  changeLoading,
  changePeriod,
  gradeLabel = "PSA 10",
  tradeVolumeUsdc,
  tradeVolumeLoading,
  marketCapUsd,
  formatMarketCap,
  psaPopulationMetrics,
  totalPopulation,
}: {
  imageUrl?: string | null;
  priceUsd: number | null;
  priceLoading: boolean;
  changePct: number | null;
  changeLoading: boolean;
  changePeriod?: ReferencePercentChangeResult | null;
  gradeLabel?: string;
  tradeVolumeUsdc: number | null;
  tradeVolumeLoading: boolean;
  marketCapUsd: number | null;
  formatMarketCap: (n: number | null | undefined) => string;
  psaPopulationMetrics?: PsaPopulationMetrics | null;
  totalPopulation?: number | null;
}) {
  const popMetrics = psaPopulationMetrics ?? {
    gradeLabel: "PSA 10",
    gradePop: null,
    totalPsaPop: totalPopulation ?? null,
    psa10Pop: null,
  };
  const popPair = formatPsaPopulationPair(popMetrics.gradePop, popMetrics.totalPsaPop);
  const changeTone =
    changePct != null && Number.isFinite(changePct)
      ? referenceChangeTone(changePct)
      : null;
  const changeTag =
    changePct != null && Number.isFinite(changePct)
      ? formatChangeTag(changePct)
      : null;

  return (
    <div className="cd-stat-block">
      <div className="cd-stat-main cd-notch">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="cd-stat-main__thumb"
          />
        ) : (
          <div className="cd-stat-main__thumb cd-stat-main__thumb--empty" aria-hidden />
        )}
        <div className="cd-stat-main__body">
          <div className="cd-stat-main__label">Last price</div>
          <div className="cd-stat-main__price-row">
            {priceLoading && priceUsd == null ? (
              <span className="cd-stat-main__price cd-stat-main__skeleton" aria-hidden />
            ) : priceUsd != null && Number.isFinite(priceUsd) ? (
              <span className="cd-stat-main__price">{formatUsdCompact(priceUsd)}</span>
            ) : (
              <span className="cd-stat-main__price cd-stat-main__price--muted">
                {NO_EXTERNAL_PRICE}
              </span>
            )}
            {changeLoading && changePct == null ? (
              <span className="cd-stat-main__change cd-stat-main__skeleton cd-stat-main__skeleton--tag" aria-hidden />
            ) : changeTag ? (
              <span
                className={`cd-stat-main__change cd-stat-main__change--${changeTone === "down" ? "down" : "up"}`}
              >
                <span className="cd-stat-main__change-arrow" aria-hidden>
                  {changeTag.arrow}
                </span>
                {changeTag.label}
              </span>
            ) : (
              <span className="cd-stat-main__change cd-stat-main__change--muted">
                {REFERENCE_CHANGE_UNAVAILABLE_LABEL}
              </span>
            )}
          </div>
          <div className="cd-stat-main__hint">
            {changePeriodHint(changePeriod, popMetrics.gradeLabel || gradeLabel)}
          </div>
        </div>
      </div>

      <div className="cd-stat-grid">
        <div className="cd-stat-grid__cell cd-notch">
          <div className="cd-stat-grid__label">Volume 30d</div>
          {tradeVolumeLoading && tradeVolumeUsdc == null ? (
            <div className="cd-stat-grid__value cd-stat-main__skeleton" aria-hidden />
          ) : (
            <div className="cd-stat-grid__value">
              {formatUsdCompact(
                tradeVolumeUsdc != null && Number.isFinite(tradeVolumeUsdc)
                  ? tradeVolumeUsdc
                  : 0,
              )}
            </div>
          )}
        </div>
        <div className="cd-stat-grid__cell cd-notch">
          <div className="cd-stat-grid__label">Market cap</div>
          <div className="cd-stat-grid__value">{formatMarketCap(marketCapUsd)}</div>
        </div>
        <div className="cd-stat-grid__cell cd-notch">
          <div className="cd-stat-grid__label">
            {popMetrics.gradeLabel || gradeLabel} / Pop
          </div>
          <div className="cd-stat-grid__value" title={popPair}>
            {popPair !== "—"
              ? popPair
              : totalPopulation != null
                ? formatPsaPopulationCount(totalPopulation)
                : "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
