"use client";

/**
 * Price history placeholder — decorative area chart until real time-series data exists.
 */
export function CollectionPriceHistoryPlaceholder({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-gray-800/80 bg-[#06080c] ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_80%_at_50%_100%,rgba(52,211,153,0.12),transparent_60%)]"
        aria-hidden
      />
      <div className="text-center px-3 pt-3 pb-1">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          Price (USDC)
        </p>
        <p className="text-[10px] text-gray-600 mt-0.5">Historical chart — coming soon</p>
      </div>
      <div className="relative h-[160px] sm:h-[180px] w-full max-w-xl mx-auto px-3 pb-3">
        <svg
          viewBox="0 0 400 120"
          className="h-full w-full"
          preserveAspectRatio="none"
          aria-hidden
        >
          <defs>
            <linearGradient id="collection-chart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgb(52, 211, 153)" stopOpacity="0.35" />
              <stop offset="100%" stopColor="rgb(52, 211, 153)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="collection-chart-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="rgb(34, 197, 94)" />
              <stop offset="100%" stopColor="rgb(52, 211, 153)" />
            </linearGradient>
          </defs>
          <path
            d="M0,95 C40,88 60,102 100,78 C140,54 160,70 200,52 C240,34 260,48 300,38 C340,28 360,42 400,30 L400,120 L0,120 Z"
            fill="url(#collection-chart-fill)"
          />
          <path
            d="M0,95 C40,88 60,102 100,78 C140,54 160,70 200,52 C240,34 260,48 300,38 C340,28 360,42 400,30"
            fill="none"
            stroke="url(#collection-chart-line)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {[0, 1, 2, 3, 4].map((i) => (
            <line
              key={i}
              x1="0"
              y1={24 + i * 24}
              x2="400"
              y2={24 + i * 24}
              stroke="rgba(255,255,255,0.04)"
              strokeWidth="1"
            />
          ))}
        </svg>
      </div>
    </div>
  );
}
