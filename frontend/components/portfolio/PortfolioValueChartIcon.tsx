/** Growth chart — three bars + stepped trend line with arrow (portfolio header). */
export function PortfolioValueChartIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="currentColor"
      aria-hidden
    >
      <rect x="2.25" y="14.75" width="3.75" height="5.5" rx="1" />
      <rect x="7.75" y="11.75" width="3.75" height="8.5" rx="1" />
      <rect x="13.25" y="7.75" width="3.75" height="12.5" rx="1" />
      <path
        d="M3.6 13.85 7.15 11.45 h3.55 l3.35 2.95 3.55 3.15"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.35}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.1 6.55h3.35v3.35"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.35}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
