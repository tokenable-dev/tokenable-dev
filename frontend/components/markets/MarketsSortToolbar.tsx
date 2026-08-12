"use client";

import { useEffect, useState } from "react";
import {
  MARKETS_SORT_OPTIONS,
  MARKETS_SORT_UI_IDS,
  type MarketsSortId,
} from "@/lib/markets/marketsCollectionSort";

function SortTextButton({
  sortId,
  sortMenuOpen,
  onClick,
}: {
  sortId: MarketsSortId;
  sortMenuOpen: boolean;
  onClick: () => void;
}) {
  const label = MARKETS_SORT_OPTIONS.find((o) => o.id === sortId)?.label ?? "Sort";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-haspopup="menu"
      aria-expanded={sortMenuOpen}
      aria-label={`Sort collections — current: ${label}`}
      className={`inline-flex min-h-[28px] shrink-0 touch-manipulation items-center gap-1 rounded-lg border px-2.5 py-1 text-[12px] font-semibold tracking-tight transition-colors sm:min-h-[32px] sm:gap-1.5 sm:rounded-xl sm:px-3 sm:py-1.5 sm:text-[13px] ${
        sortMenuOpen
          ? "border-zinc-500/70 bg-zinc-800/70 text-white"
          : "border-zinc-700/65 bg-zinc-900/50 text-zinc-300 hover:border-zinc-500/60 hover:bg-zinc-800/50 hover:text-white"
      }`}
    >
      <span className="whitespace-nowrap">{label}</span>
      <svg
        viewBox="0 0 10 6"
        className={`h-2 w-2 shrink-0 text-zinc-400 transition-transform duration-150 sm:h-2.5 sm:w-2.5 ${sortMenuOpen ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M1 1l4 4 4-4" />
      </svg>
    </button>
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
        {MARKETS_SORT_UI_IDS.map((id) => {
          const opt = MARKETS_SORT_OPTIONS.find((o) => o.id === id);
          if (!opt) return null;
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
      <SortTextButton
        sortId={sortId}
        sortMenuOpen={sortMenuOpen}
        onClick={() => setSortMenuOpen((open) => !open)}
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
