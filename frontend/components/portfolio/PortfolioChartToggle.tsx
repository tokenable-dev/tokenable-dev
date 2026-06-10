"use client";

import { PortfolioValueChartIcon } from "./PortfolioValueChartIcon";

export function PortfolioChartToggle({
  open,
  disabled,
  onToggle,
  variant = "box",
  iconClassName,
}: {
  open: boolean;
  disabled?: boolean;
  onToggle: () => void;
  /** Browser header — inline icon; mobile keeps bordered control. */
  variant?: "box" | "inline";
  /** Inline variant — size matched to portfolio value typography. */
  iconClassName?: string;
}) {
  const inlineIconClass =
    iconClassName ?? "h-[1.25rem] w-[1.25rem] sm:h-6 sm:w-6 lg:h-[1.875rem] lg:w-[1.875rem]";

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        aria-expanded={open}
        aria-pressed={open}
        aria-controls="portfolio-value-chart"
        aria-label={open ? "Hide value history" : "Show value history"}
        className="inline-flex shrink-0 touch-manipulation items-center justify-center self-center rounded-md p-0.5 text-white transition-colors duration-200 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <PortfolioValueChartIcon
          className={`${inlineIconClass} ${open ? "text-mint" : ""}`}
        />
      </button>
    );
  }

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
          : "border-zinc-700/60 bg-zinc-900/60 text-zinc-300 hover:border-zinc-600 hover:bg-zinc-800/80 hover:text-white"
      }`}
    >
      <PortfolioValueChartIcon className="h-[18px] w-[18px] sm:h-4 sm:w-4" />
    </button>
  );
}
