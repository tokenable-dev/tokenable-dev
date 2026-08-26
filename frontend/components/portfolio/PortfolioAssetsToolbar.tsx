"use client";

import { useEffect, useRef, useState } from "react";
import {
  ASSETS_SEGMENT_OPTIONS,
  type AssetsSegment,
} from "@/lib/portfolio/portfolioAssetsSegment";

export type AssetsViewMode = "gallery" | "table";
export type AssetsToolbarSort = "value" | "pl" | "ret" | "name";

const SORT_OPTIONS: { value: AssetsToolbarSort; label: string }[] = [
  { value: "value", label: "Value" },
  { value: "pl", label: "Gain $" },
  { value: "ret", label: "Return %" },
  { value: "name", label: "Name" },
];

/** Portfolio.html My Assets control bar — filter, search, sort, gallery/table. */
export function PortfolioAssetsToolbar({
  segment,
  onSegmentChange,
  searchOpen,
  onSearchOpenChange,
  searchQuery,
  onSearchQueryChange,
  sort,
  onSortChange,
  view,
  onViewChange,
}: {
  segment: AssetsSegment;
  onSegmentChange: (seg: AssetsSegment) => void;
  searchOpen: boolean;
  onSearchOpenChange: (open: boolean) => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  sort: AssetsToolbarSort;
  onSortChange: (sort: AssetsToolbarSort) => void;
  view: AssetsViewMode;
  onViewChange: (view: AssetsViewMode) => void;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const filterActive = segment !== "tradeable";

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    if (!filterOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFilterOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [filterOpen]);

  function closeSearch() {
    onSearchOpenChange(false);
    onSearchQueryChange("");
  }

  return (
    <>
      <div className="pf-assets-bar">
        <div className="pf-assets-bar__left">
          <button
            type="button"
            className="pf-filter-btn"
            aria-label="Filter assets"
            aria-expanded={filterOpen}
            onClick={() => setFilterOpen(true)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="4" y1="6" x2="20" y2="6" />
              <line x1="7" y1="12" x2="17" y2="12" />
              <line x1="10" y1="18" x2="14" y2="18" />
            </svg>
            {filterActive ? <span className="pf-filter-btn__dot" /> : null}
          </button>

          {!searchOpen ? (
            <button
              type="button"
              className="pf-search-toggle"
              aria-label="Search your assets"
              onClick={() => onSearchOpenChange(true)}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <line x1="16.5" y1="16.5" x2="21" y2="21" />
              </svg>
            </button>
          ) : (
            <div className="pf-search-expanded">
              <svg
                className="pf-search-expanded__icon"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth="2"
                aria-hidden
              >
                <circle cx="11" cy="11" r="7" />
                <line x1="16.5" y1="16.5" x2="21" y2="21" />
              </svg>
              <input
                ref={searchRef}
                type="search"
                className="pf-search-expanded__input"
                autoComplete="off"
                placeholder="Search your assets — name, cert #, set"
                value={searchQuery}
                onChange={(e) => onSearchQueryChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") closeSearch();
                }}
              />
              <button
                type="button"
                className="pf-search-expanded__close"
                aria-label="Close search"
                onClick={closeSearch}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          )}
        </div>

        <div className="pf-assets-bar__right">
          <div className="pf-gallery-sort">
            <select
              className="pf-gallery-sort__select"
              aria-label="Sort assets"
              value={sort}
              onChange={(e) => onSortChange(e.target.value as AssetsToolbarSort)}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <svg
              className="pf-gallery-sort__caret"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>

          <div className="pf-view-toggle" role="group" aria-label="View mode">
            <button
              type="button"
              className={`pf-view${view === "gallery" ? " pf-view--sel" : ""}`}
              aria-pressed={view === "gallery"}
              onClick={() => onViewChange("gallery")}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
              <span className="pf-view__lbl">Gallery</span>
            </button>
            <button
              type="button"
              className={`pf-view${view === "table" ? " pf-view--sel" : ""}`}
              aria-pressed={view === "table"}
              onClick={() => onViewChange("table")}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
              <span className="pf-view__lbl">Table</span>
            </button>
          </div>
        </div>
      </div>

      {filterOpen ? (
        <div className="pf-filter-drawer" role="presentation">
          <button
            type="button"
            className="pf-filter-drawer__scrim"
            aria-label="Close filter"
            onClick={() => setFilterOpen(false)}
          />
          <div
            className="pf-filter-drawer__sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Filter assets"
          >
            <div className="pf-filter-drawer__grip" />
            <div className="pf-filter-drawer__h">Filter assets</div>
            {ASSETS_SEGMENT_OPTIONS.map((opt) => {
              const sel = segment === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={`pf-filter-drawer__opt${sel ? " pf-filter-drawer__opt--sel" : ""}`}
                  onClick={() => {
                    onSegmentChange(opt.id);
                    setFilterOpen(false);
                  }}
                >
                  {opt.label}
                  <span className="pf-filter-drawer__ck" aria-hidden>
                    ✓
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </>
  );
}
