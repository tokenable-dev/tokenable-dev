"use client";

export function PortfolioChartToggle({
  open,
  disabled,
  onToggle,
}: {
  open: boolean;
  disabled?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      aria-expanded={open}
      aria-pressed={open}
      aria-controls="portfolio-value-chart"
      aria-label={open ? "Hide value history" : "Show value history"}
      className={`inline-flex h-10 w-10 shrink-0 touch-manipulation items-center justify-center rounded-xl border transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9 ${
        open
          ? "border-mint/45 bg-mint/[0.12] text-mint shadow-[0_0_22px_-10px_rgba(16,211,51,0.65)]"
          : "border-zinc-700/60 bg-zinc-900/60 text-zinc-500 hover:border-zinc-600 hover:bg-zinc-800/80 hover:text-zinc-300"
      }`}
    >
      <svg
        className="h-[18px] w-[18px] sm:h-4 sm:w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        aria-hidden
      >
        <path d="M4 20V4" strokeWidth={1.5} strokeLinecap="round" />
        <path d="M4 20H20" strokeWidth={1.5} strokeLinecap="round" />
        <path
          d="M7.5 14.5L11 11l3 2.5L18.5 8"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className={open ? "drop-shadow-[0_0_6px_rgba(16,211,51,0.55)]" : undefined}
        />
        {open ? (
          <circle cx="18.5" cy="8" r="1.35" fill="currentColor" stroke="none" />
        ) : null}
      </svg>
    </button>
  );
}
