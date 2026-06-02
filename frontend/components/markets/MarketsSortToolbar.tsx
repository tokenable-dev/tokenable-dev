"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  MARKETS_SORT_OPTIONS,
  type MarketsSortId,
} from "@/lib/markets/marketsCollectionSort";

const VIEW_TOGGLE_ACTIVE =
  "rounded-lg border border-white/75 bg-white/[0.06] text-white hover:border-white/90";
const VIEW_TOGGLE_INACTIVE =
  "rounded-lg border border-zinc-700/80 bg-zinc-900/50 text-zinc-500 hover:border-zinc-600/80 hover:text-zinc-400";

const LAYOUT_TOGGLE_SHELL =
  "shrink-0 items-center gap-1 rounded-xl border border-zinc-700/80 bg-zinc-900/80 p-1";

function SortToggleButton({
  active,
  onClick,
  ariaLabel,
  sortMenuOpen,
  children,
}: {
  active: boolean;
  onClick: () => void;
  ariaLabel: string;
  sortMenuOpen: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      aria-pressed={active}
      aria-haspopup="menu"
      aria-expanded={sortMenuOpen}
      className={`inline-flex h-11 w-11 touch-manipulation items-center justify-center transition-colors sm:h-10 sm:w-10 ${
        active ? VIEW_TOGGLE_ACTIVE : VIEW_TOGGLE_INACTIVE
      }`}
    >
      {children}
    </button>
  );
}

function SortToggle({
  sortMenuOpen,
  onSortMenu,
  className = "",
}: {
  sortMenuOpen: boolean;
  onSortMenu: () => void;
  className?: string;
}) {
  return (
    <div
      className={[className, LAYOUT_TOGGLE_SHELL].filter(Boolean).join(" ")}
    >
      <SortToggleButton
        active={sortMenuOpen}
        onClick={onSortMenu}
        ariaLabel="Sort collections"
        sortMenuOpen={sortMenuOpen}
      >
        <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden>
          <rect x="1" y="2" width="14" height="2" rx="1" />
          <rect x="1" y="7" width="14" height="2" rx="1" />
          <rect x="1" y="12" width="14" height="2" rx="1" />
        </svg>
      </SortToggleButton>
    </div>
  );
}

function SortMenu({
  open,
  sortId,
  onSelect,
  onClose,
}: {
  open: boolean;
  sortId: MarketsSortId;
  onSelect: (id: MarketsSortId) => void;
  onClose: () => void;
}) {
  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[130] cursor-default bg-transparent"
        aria-label="Close sort menu"
        onClick={onClose}
      />
      <div
        role="menu"
        aria-label="Sort"
        className="absolute right-0 top-[calc(100%+0.5rem)] z-[131] w-[min(100vw-1.5rem,15.5rem)] overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-900/95 py-1.5 shadow-[0_16px_48px_-12px_rgba(0,0,0,0.85)] ring-1 ring-white/[0.06] backdrop-blur-sm"
      >
        <p className="px-3.5 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">
          Sort
        </p>
        {MARKETS_SORT_OPTIONS.map((opt) => {
          const selected = sortId === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              onClick={() => {
                onSelect(opt.id);
                onClose();
              }}
              className={`flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-[13px] font-medium transition-colors ${
                selected
                  ? "bg-white/[0.08] text-white"
                  : "text-zinc-300 hover:bg-white/[0.05] hover:text-white"
              }`}
            >
              <span>{opt.label}</span>
              {selected ? (
                <span className="text-mint" aria-hidden>
                  ✓
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </>
  );
}

export function MarketsSortToolbar({
  sortId,
  onSortChange,
  className = "",
}: {
  sortId: MarketsSortId;
  onSortChange: (id: MarketsSortId) => void;
  className?: string;
}) {
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  useEffect(() => {
    if (!sortMenuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSortMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sortMenuOpen]);

  return (
    <div className={`relative ${className}`.trim()}>
      <SortToggle
        sortMenuOpen={sortMenuOpen}
        onSortMenu={() => setSortMenuOpen((open) => !open)}
      />
      <SortMenu
        open={sortMenuOpen}
        sortId={sortId}
        onSelect={onSortChange}
        onClose={() => setSortMenuOpen(false)}
      />
    </div>
  );
}
