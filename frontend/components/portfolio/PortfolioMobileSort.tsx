"use client";

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
      <div className="pf-mobile-sort__select-wrap">
        <select
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
        </select>
        <svg
          className="pf-mobile-sort__caret"
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  );
}
