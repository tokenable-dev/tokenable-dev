"use client";

import {
  COLLECTION_GRADE_CHART_DAYS_OPTIONS,
  type CollectionGradeChartDays,
} from "@/lib/marketplace/collection-grade-chart/constants";

const PERIOD_LABELS: Record<CollectionGradeChartDays, string> = {
  30: "1M",
  90: "3M",
  180: "6M",
  365: "1Y",
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
  return (
    <div className="cd-period-toolbar" role="group" aria-label="Chart time range">
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
            {PERIOD_LABELS[days]}
          </button>
        );
      })}
    </div>
  );
}
