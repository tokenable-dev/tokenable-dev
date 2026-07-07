"use client";

import type { PsaPopulationByGrade } from "@/lib/market/psaPopulationByGrade";
import { formatPsaPopulationCount } from "@/lib/market";

const GRADE_ROWS: { score: keyof PsaPopulationByGrade; label: string; muted?: boolean }[] = [
  { score: "10", label: "GEM MT 10" },
  { score: "9", label: "MINT 9" },
  { score: "8", label: "NM-MT 8" },
  { score: "7", label: "NM 7", muted: true },
  { score: "6", label: "EX-MT 6", muted: true },
  { score: "5", label: "≤ 5", muted: true },
];

function sumLowerGrades(map: PsaPopulationByGrade): number {
  let sum = 0;
  for (let g = 1; g <= 5; g++) {
    const n = map[String(g) as keyof PsaPopulationByGrade];
    if (typeof n === "number" && Number.isFinite(n)) sum += n;
  }
  return sum;
}

function pctOfTotal(count: number, total: number): string {
  if (total <= 0) return "—";
  return `${((count / total) * 100).toFixed(1)}%`;
}

export function CollectionPsaPopulationPanel({
  byGrade,
  totalPop,
  highlightGrade = "10",
}: {
  byGrade?: PsaPopulationByGrade;
  totalPop?: number | null;
  highlightGrade?: string;
}) {
  const total =
    totalPop ??
    (byGrade
      ? Object.values(byGrade).reduce((a, b) => a + (typeof b === "number" ? b : 0), 0)
      : null);

  if (!byGrade && total == null) {
    return (
      <p className="cd-psa-panel__empty">PSA population data is not available for this card.</p>
    );
  }

  const highlightKey = highlightGrade.replace(/\D/g, "") || "10";

  return (
    <div className="cd-psa-panel">
      <div className="cd-psa-panel__head">
        <span>Grade</span>
        <span>Count</span>
        <span>% of Pop</span>
      </div>
      {GRADE_ROWS.map((row) => {
        let count: number | null = null;
        if (row.label === "≤ 5") {
          count = byGrade ? sumLowerGrades(byGrade) : null;
        } else {
          count = byGrade?.[row.score] ?? null;
        }
        const isHighlight = row.score === highlightKey;
        return (
          <div key={row.label} className="cd-psa-panel__row">
            <span
              className={`cd-psa-panel__grade${isHighlight ? " cd-psa-panel__grade--active" : ""}${row.muted ? " cd-psa-panel__grade--muted" : ""}`}
            >
              {row.label}
            </span>
            <span className="cd-psa-panel__count">
              {count != null ? formatPsaPopulationCount(count) : "—"}
            </span>
            <span className="cd-psa-panel__pct">
              {count != null && total != null && total > 0
                ? pctOfTotal(count, total)
                : "—"}
            </span>
          </div>
        );
      })}
      {total != null && total > 0 ? (
        <div className="cd-psa-panel__row cd-psa-panel__row--total">
          <span className="cd-psa-panel__grade cd-psa-panel__grade--muted">Total Pop</span>
          <span className="cd-psa-panel__count">{formatPsaPopulationCount(total)}</span>
          <span className="cd-psa-panel__pct">100%</span>
        </div>
      ) : null}
    </div>
  );
}
