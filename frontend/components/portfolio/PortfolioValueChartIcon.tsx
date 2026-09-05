/** Sparkline chart — rounded frame, soft area fill, clean trend line. */
export function PortfolioValueChartIcon({ className }: { className?: string }) {
  const trend =
    "M6.25 15.75 9.5 12.75 12.25 13.5 15.25 9.75 17.75 7.25";

  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" aria-hidden>
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="3"
        stroke="currentColor"
        strokeWidth={1.5}
        className="opacity-30"
      />
      <path
        d={`${trend} V17.75 H6.25 Z`}
        fill="currentColor"
        className="opacity-[0.14]"
      />
      <path
        d={trend}
        stroke="currentColor"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="17.75" cy="7.25" r="1.35" fill="currentColor" />
    </svg>
  );
}
