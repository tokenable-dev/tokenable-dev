"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ASSETS } from "@/constants/assets";
import {
  MARKET_RASTER_ICON_IMG,
  MARKET_RASTER_ICON_IMG_NBA,
} from "@/lib/market";
import type { CollectionCategoryFilterId } from "@/lib/market";

const FILTERS: { id: CollectionCategoryFilterId; label: string }[] = [
  { id: "all", label: "ALL" },
  { id: "pokemon", label: "Pokemon" },
  { id: "mlb", label: "MLB" },
  { id: "nba", label: "NBA" },
  { id: "nfl", label: "NFL" },
  { id: "soccer", label: "Soccer" },
  { id: "others", label: "Others" },
];

function categoryFilterIconSrc(id: CollectionCategoryFilterId): string | undefined {
  switch (id) {
    case "pokemon":
      return ASSETS.icons.marketIndexPokemon;
    case "mlb":
      return ASSETS.icons.marketIndexMlb;
    case "nba":
      return ASSETS.icons.marketIndexNba;
    case "nfl":
      return ASSETS.icons.marketIndexNfl;
    case "soccer":
      return ASSETS.icons.marketIndexSoccer;
    default:
      return undefined;
  }
}

/** Readable title in mobile picklist (chip row still uses short `ALL`). */
function mobileCategoryHeading(id: CollectionCategoryFilterId): string {
  if (id === "all") return "All collections";
  return FILTERS.find((x) => x.id === id)?.label ?? "";
}

function AllCollectionsGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4.75 4.75h6.05v6.05H4.75V4.75Zm8.45 0h6.05v6.05h-6.05V4.75Zm-8.45 8.45h6.05v6.05H4.75v-6.05Zm8.45 0h6.05v6.05h-6.05v-6.05Z"
        stroke="currentColor"
        strokeWidth="1.65"
        strokeLinejoin="round"
        opacity={0.9}
      />
    </svg>
  );
}

/** Chip icons: tight box aligned to glyph size (avoid hero-sized MARKET_RASTER_ICON_FRAME). */
function ChipIcon({
  src,
  nba,
}: {
  src: string;
  nba: boolean;
}) {
  const imgCls = nba ? MARKET_RASTER_ICON_IMG_NBA : MARKET_RASTER_ICON_IMG;
  return (
    <span className="flex h-5 w-5 shrink-0 items-center justify-center" aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element -- small raster from /public */}
      <img src={src} alt="" width={20} height={20} className={`${imgCls} !max-h-none !max-w-none h-full w-full`} />
    </span>
  );
}

function DropdownChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-5 w-5 shrink-0 text-mint transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
      aria-hidden
    >
      <path
        d="M7 10l5 5 5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Custom picklist: matches chip styling; avoids platform-native picker chrome. */
function MobileCategoryDropdown({
  value,
  onChange,
}: {
  value: CollectionCategoryFilterId;
  onChange: (id: CollectionCategoryFilterId) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const current = FILTERS.find((f) => f.id === value) ?? FILTERS[0]!;
  const currentIconSrc = categoryFilterIconSrc(current.id);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointer, true);
    return () => document.removeEventListener("pointerdown", onPointer, true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [open]);

  const pick = (id: CollectionCategoryFilterId) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <div className="mb-1.5 px-0.5">
        <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-zinc-500">
          Category
        </span>
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full min-h-[42px] touch-manipulation items-center justify-between gap-2 rounded-xl border border-zinc-500/55 bg-[#10141c] px-3 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_6px_20px_-5px_rgba(0,0,0,0.5)] outline-none transition-colors duration-200 hover:border-zinc-500/75 focus-visible:border-mint/45 focus-visible:ring-2 focus-visible:ring-mint/20 active:bg-[#0c1016]"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          {currentIconSrc ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-600/65 bg-black/35 p-0.5 shadow-inner shadow-black/25">
              <ChipIcon src={currentIconSrc} nba={current.id === "nba"} />
            </span>
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-600/65 bg-black/35 text-zinc-400 shadow-inner shadow-black/25">
              <AllCollectionsGlyph className="h-5 w-5" />
            </span>
          )}
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold leading-snug tracking-tight text-white">
              {mobileCategoryHeading(current.id)}
            </span>
          </span>
        </span>
        <DropdownChevron expanded={open} />
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[3px]"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <ul
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 top-[calc(100%+8px)] z-[70] max-h-[min(24rem,calc(100vh-10rem))] divide-y divide-zinc-700/45 overflow-y-auto overscroll-contain rounded-xl border border-zinc-500/55 bg-zinc-950/97 py-0 shadow-[0_16px_40px_-10px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-md"
          >
            {FILTERS.map((f) => {
              const selected = value === f.id;
              const iconSrc = categoryFilterIconSrc(f.id);
              return (
                <li key={f.id} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => pick(f.id)}
                    className={`flex w-full touch-manipulation items-center gap-2.5 px-3 py-2 text-left transition-colors duration-150 ${
                      selected
                        ? "bg-[linear-gradient(90deg,rgba(148,255,212,0.12)_0%,rgba(148,255,212,0.04)_55%,transparent_100%)]"
                        : "active:bg-white/[0.04]"
                    }`}
                  >
                    {iconSrc ? (
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border p-0.5 ${
                          selected
                            ? "border-mint/45 bg-black/45 shadow-[0_0_0_1px_rgba(148,255,212,0.1)]"
                            : "border-zinc-600/60 bg-black/35"
                        }`}
                      >
                        <ChipIcon src={iconSrc} nba={f.id === "nba"} />
                      </span>
                    ) : (
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-zinc-400 ${
                          selected
                            ? "border-mint/45 bg-black/45 text-mint shadow-[0_0_0_1px_rgba(148,255,212,0.1)]"
                            : "border-zinc-600/60 bg-black/35"
                        }`}
                      >
                        <AllCollectionsGlyph className="h-5 w-5" />
                      </span>
                    )}
                    <span
                      className={`min-w-0 flex-1 truncate text-sm font-semibold tracking-tight ${
                        selected ? "text-white" : "text-zinc-100"
                      }`}
                    >
                      {mobileCategoryHeading(f.id)}
                    </span>
                    {selected ? (
                      <span
                        className="shrink-0 text-mint drop-shadow-[0_0_8px_rgba(148,255,212,0.3)]"
                        aria-hidden
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24">
                          <path
                            d="M6 12.5 L10.2 17 18 7"
                            stroke="currentColor"
                            strokeWidth="2.25"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    ) : (
                      <span className="w-5 shrink-0" aria-hidden />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
    </div>
  );
}

export function CollectionCategoryFilterBar({
  value,
  onChange,
}: {
  value: CollectionCategoryFilterId;
  onChange: (id: CollectionCategoryFilterId) => void;
}) {
  return (
    <>
      <div className="sm:hidden">
        <MobileCategoryDropdown value={value} onChange={onChange} />
      </div>

      <div
        className="hidden w-full min-w-0 overflow-x-auto overscroll-x-contain scroll-smooth sm:block sm:overflow-x-visible sm:pb-0 sm:[scrollbar-width:auto]"
        role="toolbar"
        aria-label="Filter by card category"
      >
        <div className="flex w-full max-w-full flex-wrap items-stretch gap-2 sm:gap-2.5">
          {FILTERS.map((f) => {
            const active = value === f.id;
            const iconSrc = categoryFilterIconSrc(f.id);
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => onChange(f.id)}
                aria-pressed={active}
                className={`inline-flex min-h-[38px] shrink-0 touch-manipulation items-center justify-center rounded-lg border px-3 py-1.5 text-[13px] font-semibold tracking-tight transition-all duration-200 active:scale-[0.98] sm:min-h-[40px] sm:rounded-xl sm:px-3.5 sm:py-2 sm:text-sm ${
                  active
                    ? "border-mint/50 bg-mint text-mint-ink shadow-[0_0_0_1px_rgba(148,255,212,0.12)] shadow-mint/25"
                    : "border-zinc-700/70 bg-zinc-950/80 text-zinc-100 hover:border-zinc-500/60 hover:bg-zinc-900/90 hover:text-white"
                }`}
              >
                <span
                  className={`inline-flex items-center gap-2 ${iconSrc ? "" : "px-0.5"}`}
                >
                  {iconSrc ? <ChipIcon src={iconSrc} nba={f.id === "nba"} /> : null}
                  <span className="whitespace-nowrap leading-none">{f.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
