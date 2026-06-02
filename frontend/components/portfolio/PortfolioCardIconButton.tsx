"use client";

import type { MouseEvent, ReactNode } from "react";

export function PortfolioCardIconButton({
  ariaLabel,
  title,
  disabled,
  onClick,
  children,
  className = "",
}: {
  ariaLabel: string;
  title: string;
  disabled?: boolean;
  onClick: (e: MouseEvent<HTMLButtonElement>) => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`absolute right-1.5 top-1.5 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-mint/35 bg-[#0a1018]/90 text-mint shadow-[0_2px_12px_rgba(0,0,0,0.55)] backdrop-blur-sm transition-all hover:border-mint/55 hover:bg-[#0a1018] hover:shadow-[0_0_16px_-6px_rgba(16,211,51,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint/50 disabled:cursor-not-allowed disabled:opacity-40 sm:right-2 sm:top-2 sm:h-8 sm:w-8 ${className}`}
    >
      {children}
    </button>
  );
}

export function PortfolioHideIcon({ className = "h-3.5 w-3.5 sm:h-4 sm:w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12c2.4-4 6-6 9-6s6.6 2 9 6c-2.4 4-6 6-9 6s-6.6-2-9-6z" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

export function PortfolioUnhideIcon({ className = "h-3.5 w-3.5 sm:h-4 sm:w-4" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 12c2.4-4 6-6 9-6s6.6 2 9 6c-2.4 4-6 6-9 6s-6.6-2-9-6z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}
