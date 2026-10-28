"use client";

import { useTranslations } from "next-intl";
import {
  COLLECTION_GRADE_CHART_ALL_DAYS,
  COLLECTION_GRADE_CHART_DAYS_OPTIONS,
  type CollectionGradeChartDays,
} from "@/lib/marketplace/collection-grade-chart/constants";

const PERIOD_KEYS: Record<
  CollectionGradeChartDays,
  "range1m" | "range3m" | "range6m" | "range1y" | "rangeAll"
> = {
  30: "range1m",
  90: "range3m",
  180: "range6m",
  365: "range1y",
  [COLLECTION_GRADE_CHART_ALL_DAYS]: "rangeAll",
};

export function CollectionDetailChartPeriodToolbar({
  chartDays,
  onChartDaysChange,
  disabled = false,
}: {
  chartDays: CollectionGradeChartDays;
  onChartDaysChange: (days: CollectionGradeChartDays) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("CollectionDetail");
  return (
    <div className="cd-period-toolbar" role="group" aria-label={t("chartRange")}>
      {COLLECTION_GRADE_CHART_DAYS_OPTIONS.map((days) => {
        const active = chartDays === days;
        return (
          <button
            key={days}
            type="button"
            disabled={disabled}
            onClick={() => onChartDaysChange(days)}
            aria-pressed={active}
            className={`cd-period${active ? " cd-period--active" : ""}`}
          >
            {t(PERIOD_KEYS[days])}
          </button>
        );
      })}
    </div>
  );
}
