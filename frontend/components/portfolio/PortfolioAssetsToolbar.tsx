"use client";

import { useEffect, useState } from "react";
import {
  ASSETS_SEGMENT_OPTIONS,
  type AssetsSegment,
} from "@/lib/portfolio/portfolioAssetsSegment";
import { TkButton } from "@/components/ds";
import { PortfolioToolbarSearch } from "./PortfolioToolbarSearch";

export type AssetsViewMode = "gallery" | "table";
export type AssetsToolbarSort = "newest" | "value" | "pl" | "ret" | "name";

const SORT_OPTIONS: { value: AssetsToolbarSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "value", label: "Value" },
  { value: "pl", label: "Gain $" },
  { value: "ret", label: "Return %" },
  { value: "name", label: "Name" },
];

const FilterIcon = () => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <line x1="4" y1="6" x2="20" y2="6" />
    <line x1="7" y1="12" x2="17" y2="12" />
    <line x1="10" y1="18" x2="14" y2="18" />
  </svg>
);

const SelectIcon = () => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden
  >
    <polyline points="9 11 12 14 22 4" />
    <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
  </svg>
);

/** Portfolio.html My Assets `pf-tbar` — filter, search, sort, view, Select. */
export function PortfolioAssetsToolbar({
  segment,
  onSegmentChange,
  searchQuery,
  onSearchQueryChange,
  sort,
  onSortChange,
  view,
  onViewChange,
  selectMode,
  onSelectModeChange,
  selectedCount,
  onSelectAll,
  onClearSelection,
  onCancelSelected,
  cancellingSelected,
}: {
  segment: AssetsSegment;
  onSegmentChange: (seg: AssetsSegment) => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  sort: AssetsToolbarSort;
  onSortChange: (sort: AssetsToolbarSort) => void;
  view: AssetsViewMode;
  onViewChange: (view: AssetsViewMode) => void;
  selectMode: boolean;
  onSelectModeChange: (on: boolean) => void;
  selectedCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onCancelSelected: () => void;
  cancellingSelected?: boolean;
}) {
  const [filterOpen, setFilterOpen] = useState(false);
  const filterActive = segment !== "tradeable";

  useEffect(() => {
    if (!filterOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFilterOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [filterOpen]);

  if (selectMode) {
    return (
      <div className="pf-tbar pf-tbar--select" id="pf-assets-toolbar" role="toolbar" aria-label="Cancel listing selection">
        <span className="pf-cl-count">
          {selectedCount} selected
        </span>
        <button type="button" className="pf-cl-chip" onClick={onSelectAll}>
          Select all
        </button>
        <button type="button" className="pf-cl-chip" onClick={onClearSelection}>
          Clear
        </button>
        <TkButton
          type="button"
          variant="primary"
          size="sm"
          className="pf-cl-go"
          disabled={selectedCount === 0 || cancellingSelected}
          onClick={onCancelSelected}
        >
          {cancellingSelected ? "Cancelling…" : "Cancel listing"}
        </TkButton>
        <button
          type="button"
          className="pf-cl-chip pf-cl-chip--icon"
          aria-label="Exit selection"
          onClick={() => onSelectModeChange(false)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="pf-tbar" id="pf-assets-toolbar">
        <button
          type="button"
          className="pf-tbtn pf-tbtn--icon"
          aria-label="Filter assets"
          aria-expanded={filterOpen}
          onClick={() => setFilterOpen(true)}
        >
          <FilterIcon />
          {filterActive ? <span className="pf-tbtn__dot" /> : null}
        </button>

        <PortfolioToolbarSearch
          value={searchQuery}
          onChange={onSearchQueryChange}
          placeholder="Search name, cert #, set"
          aria-label="Search your assets"
        />

        <div className="pf-tbar__spacer" />

        <div className="pf-tbar__cluster">
          <div className="pf-tbar__sortsel">
            <select
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
              className="cx"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
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

          <button
            type="button"
            className="pf-tbtn"
            onClick={() => onSelectModeChange(true)}
          >
            <SelectIcon />
            <span>Select</span>
          </button>
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
