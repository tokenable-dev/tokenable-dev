"use client";

import {
  COLLECTION_GRADE_CHART_DAYS_OPTIONS,
  type CollectionGradeChartDays,
} from "@/lib/marketplace/collection-grade-chart/constants";

const toolbarControlCls =
  "h-7 shrink-0 rounded-md border border-white/[0.08] bg-zinc-950/80 text-[10px] font-semibold leading-none outline-none transition-colors focus:border-mint/35 disabled:opacity-50 sm:text-[11px]";

export function CollectionGradeChartToolbar({
  gradeOptions,
  activeGrade,
  onGradeChange,
  chartDays,
  onChartDaysChange,
  disabled = false,
}: {
  gradeOptions: readonly string[];
  activeGrade: string;
  onGradeChange: (grade: string) => void;
  chartDays: CollectionGradeChartDays;
  onChartDaysChange: (days: CollectionGradeChartDays) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex w-full min-w-0 items-center justify-end gap-1.5 overflow-x-auto">
      <select
        value={activeGrade}
        disabled={disabled || gradeOptions.length === 0}
        onChange={(e) => onGradeChange(e.target.value)}
        aria-label="Grade"
        className={`${toolbarControlCls} max-w-[7.5rem] min-w-0 px-2 text-white sm:max-w-[8.5rem]`}
      >
        {gradeOptions.map((g) => (
          <option key={g} value={g}>
            {g}
          </option>
        ))}
      </select>

      <div
        className="flex h-7 shrink-0 items-center rounded-md border border-white/[0.08] bg-zinc-950/80 p-px"
        role="group"
        aria-label="Chart range"
      >
        {COLLECTION_GRADE_CHART_DAYS_OPTIONS.map((d) => {
          const active = chartDays === d;
          return (
            <button
              key={d}
              type="button"
              disabled={disabled}
              onClick={() => onChartDaysChange(d)}
              aria-pressed={active}
              className={`touch-manipulation rounded-[5px] px-1.5 py-1 text-[10px] font-semibold leading-none transition-colors sm:px-2 sm:text-[11px] ${
                active
                  ? "bg-mint/15 text-mint"
                  : "text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
              }`}
            >
              {d}d
            </button>
          );
        })}
      </div>
    </div>
  );
}
