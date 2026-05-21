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
  muted,
}: {
  src: string;
  nba: boolean;
  muted?: boolean;
}) {
  const imgCls = nba ? MARKET_RASTER_ICON_IMG_NBA : MARKET_RASTER_ICON_IMG;
  return (
    <span
      className={`flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden [&_img]:shrink-0 ${
        muted ? "opacity-[0.72] transition-opacity duration-200 group-hover:opacity-100" : ""
      }`}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- small raster from /public */}
      <img src={src} alt="" width={20} height={20} className={`${imgCls} !max-h-none !max-w-none h-full w-full object-contain`} />
    </span>
  );
}

function DropdownChevron({ expanded }: { expanded: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={`h-5 w-5 shrink-0 text-zinc-400 transition-transform duration-200 group-hover:text-zinc-200 ${expanded ? "rotate-180" : ""}`}
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
  mobileSectionHeading = "Category",
}: {
  value: CollectionCategoryFilterId;
  onChange: (id: CollectionCategoryFilterId) => void;
  mobileSectionHeading?: string;
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
          {mobileSectionHeading}
        </span>
      </div>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        onClick={() => setOpen((o) => !o)}
        className="group flex w-full min-h-[42px] touch-manipulation items-center justify-between gap-2 rounded-xl border border-zinc-600/55 bg-black/35 px-3 py-2 text-left outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] transition-colors duration-200 hover:border-zinc-500/65 hover:bg-zinc-900/40 hover:shadow-none focus-visible:border-zinc-400/50 focus-visible:ring-2 focus-visible:ring-zinc-500/25 active:bg-zinc-950/70"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2.5">
          {currentIconSrc ? (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-600/50 bg-black/40 p-0.5 shadow-inner shadow-black/20">
              <ChipIcon src={currentIconSrc} nba={current.id === "nba"} muted />
            </span>
          ) : (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-600/50 bg-black/40 p-0.5 shadow-inner shadow-black/20 [&_svg]:opacity-90">
              <AllCollectionsGlyph className="h-5 w-5 text-zinc-400 transition-colors duration-150 group-hover:text-zinc-200" />
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
                    className={`group flex w-full touch-manipulation items-center gap-2.5 px-3 py-2 text-left transition-colors duration-150 hover:bg-white/[0.04] active:bg-white/[0.06] ${
                      selected
                        ? "bg-white/[0.06] shadow-[inset_2px_0_0_rgba(255,255,255,0.35)]"
                        : ""
                    }`}
                  >
                    {iconSrc ? (
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border p-0.5 transition-colors duration-150 ${
                          selected
                            ? "border-zinc-400/60 bg-black/50"
                            : "border-zinc-600/60 bg-black/30"
                        }`}
                      >
                        <ChipIcon src={iconSrc} nba={f.id === "nba"} muted={!selected} />
                      </span>
                    ) : (
                      <span
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors duration-150 ${
                          selected
                            ? "border-zinc-400/60 bg-black/50 text-zinc-200"
                            : "border-zinc-600/60 bg-black/35 text-zinc-500"
                        }`}
                      >
                        <AllCollectionsGlyph className="h-5 w-5 transition-colors duration-150" />
                      </span>
                    )}
                    <span
                      className={`min-w-0 flex-1 truncate text-sm font-semibold tracking-tight ${
                        selected ? "text-white" : "text-zinc-300"
                      }`}
                    >
                      {mobileCategoryHeading(f.id)}
                    </span>
                    {selected ? (
                      <span className="shrink-0 text-zinc-200" aria-hidden>
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
  toolbarAriaLabel = "Filter by card category",
  mobileSectionHeading = "Category",
}: {
  value: CollectionCategoryFilterId;
  onChange: (id: CollectionCategoryFilterId) => void;
  /** `role="toolbar"` label (desktop strip) */
  toolbarAriaLabel?: string;
  /** Small label above the mobile dropdown trigger */
  mobileSectionHeading?: string;
}) {
  return (
    <>
      <div className="sm:hidden">
        <MobileCategoryDropdown
          value={value}
          onChange={onChange}
          mobileSectionHeading={mobileSectionHeading}
        />
      </div>

      <div
        className="hidden w-full min-w-0 overflow-x-auto overscroll-x-contain scroll-smooth sm:block sm:overflow-x-visible sm:pb-0 sm:[scrollbar-width:auto]"
        role="toolbar"
        aria-label={toolbarAriaLabel}
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
                className={`group inline-flex min-h-[38px] shrink-0 touch-manipulation items-center justify-center rounded-lg border px-3 py-1.5 text-[13px] font-semibold tracking-tight transition-colors duration-200 ease-out hover:border-zinc-400/50 hover:bg-zinc-800/45 hover:text-white active:scale-[0.985] active:text-white sm:min-h-[40px] sm:rounded-xl sm:px-3.5 sm:py-2 sm:text-sm ${
                  active
                    ? "border-zinc-300/55 bg-white/[0.06] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] hover:border-zinc-200/65 hover:bg-white/[0.09]"
                    : "border-zinc-700/65 bg-transparent text-zinc-400 [&_svg]:text-zinc-400"
                }`}
              >
                <span
                  className={`inline-flex items-center gap-2 ${iconSrc ? "" : "px-0.5"}`}
                >
                  {iconSrc ? (
                    <ChipIcon src={iconSrc} nba={f.id === "nba"} muted={!active} />
                  ) : (
                    <span
                      aria-hidden
                      className={`px-0.5 transition-colors duration-200 ${active ? "text-white" : "text-zinc-500 group-hover:text-zinc-200"}`}
                    >
                      <AllCollectionsGlyph className="h-5 w-5" />
                    </span>
                  )}
                  <span className={`whitespace-nowrap leading-none ${active ? "" : "group-hover:text-zinc-100"}`}>{f.label}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
