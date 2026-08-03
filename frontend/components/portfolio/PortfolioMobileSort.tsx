"use client";

import { TkSelect } from "@/components/ds";

export type PortfolioMobileSortOption = {
  key: string;
  label: string;
};

export function PortfolioMobileSort({
  options,
  value,
  onChange,
}: {
  options: PortfolioMobileSortOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="pf-mobile-sort">
      <span className="pf-mobile-sort__label">Sort by</span>
      <TkSelect
        className="pf-mobile-sort__select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Sort table"
      >
        {options.flatMap((opt) => [
          <option key={`${opt.key}:asc`} value={`${opt.key}:asc`}>
            {opt.label} ↑
          </option>,
          <option key={`${opt.key}:desc`} value={`${opt.key}:desc`}>
            {opt.label} ↓
          </option>,
        ])}
      </TkSelect>
    </div>
  );
}
