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
  /** Browser header — inline icon; mobile uses borderless icon control. */
  variant?: "box" | "inline";
  /** Inline variant — size matched to portfolio value typography. */
  iconClassName?: string;
}) {
  const inlineIconClass =
    iconClassName ?? "h-10 w-10 sm:h-11 sm:w-11 lg:h-12 lg:w-12";

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
        className="inline-flex shrink-0 touch-manipulation items-center justify-center self-center rounded-md p-1 text-white transition-colors duration-200 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
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
      className="inline-flex shrink-0 touch-manipulation items-center justify-center self-center rounded-md p-1 text-white transition-colors duration-200 hover:text-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <PortfolioValueChartIcon
        className={`h-9 w-9 sm:h-10 sm:w-10 ${open ? "text-mint" : ""}`}
      />
    </button>
  );
}
