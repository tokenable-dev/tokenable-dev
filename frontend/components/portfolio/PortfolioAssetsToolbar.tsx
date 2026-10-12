"use client";

import {
  ASSETS_FILTER_OPTIONS,
  type AssetsSegment,
} from "@/lib/portfolio/portfolioAssetsSegment";
import { TkButton } from "@/components/ds";

export type AssetsViewMode = "gallery" | "table";
export type AssetsToolbarSort = "newest" | "value" | "low";

const SORT_OPTIONS: { value: AssetsToolbarSort; label: string }[] = [
  { value: "newest", label: "Most recent" },
  { value: "value", label: "High price" },
  { value: "low", label: "Low price" },
];

function FilterChevron() {
  return (
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
  );
}

/** Portfolio.html My Assets `pf-tbar` — filter, Cancel/Hide, sort (gallery-only). */
export function PortfolioAssetsToolbar({
  segment,
  onSegmentChange,
  sort,
  onSortChange,
  view,
  onViewChange,
  selectMode,
  onSelectModeChange,
  selectedCount,
  selectedListedCount,
  selectedHideCount,
  onSelectAll,
  onClearSelection,
  onCancelSelected,
  onHideOrUnhideSelected,
  cancellingSelected,
  hidingSelected,
  onClearFilters,
}: {
  segment: AssetsSegment;
  onSegmentChange: (seg: AssetsSegment) => void;
  sort: AssetsToolbarSort;
  onSortChange: (sort: AssetsToolbarSort) => void;
  view: AssetsViewMode;
  onViewChange: (view: AssetsViewMode) => void;
  selectMode: boolean;
  onSelectModeChange: (on: boolean) => void;
  selectedCount: number;
  selectedListedCount: number;
  selectedHideCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onCancelSelected: () => void;
  onHideOrUnhideSelected: () => void;
  cancellingSelected?: boolean;
  hidingSelected?: boolean;
  onClearFilters: () => void;
}) {
  const filterActive = segment !== "all" || sort !== "newest";

  const hideActionLabel =
    segment === "hidden"
      ? `Unhide${selectedHideCount > 0 ? ` (${selectedHideCount})` : ""}`
      : `Hide${selectedHideCount > 0 ? ` (${selectedHideCount})` : ""}`;

  if (selectMode) {
    return (
      <div
        className="pf-tbar pf-tbar--select pf-cl-bar"
        id="pf-assets-toolbar"
        role="toolbar"
        aria-label="Cancel or hide items"
      >
        <span className="pf-cl-count">{selectedCount} selected</span>
        <button type="button" className="pf-tbtn" onClick={onSelectAll}>
          Select all
        </button>
        <button type="button" className="pf-tbtn pf-tbtn--ghost" onClick={onClearSelection}>
          Clear
        </button>
        <div className="pf-tbar__spacer" />
        {segment !== "hidden" ? (
          <TkButton
            type="button"
            variant="primary"
            size="sm"
            className="pf-cl-go"
            disabled={selectedListedCount === 0 || cancellingSelected}
            onClick={onCancelSelected}
          >
            {cancellingSelected
              ? "Cancelling…"
              : `Cancel listing${selectedListedCount > 0 ? ` (${selectedListedCount})` : ""}`}
          </TkButton>
        ) : null}
        <button
          type="button"
          className="pf-tbtn"
          disabled={selectedHideCount === 0 || hidingSelected}
          onClick={onHideOrUnhideSelected}
        >
          {hidingSelected ? "Saving…" : hideActionLabel}
        </button>
        <button
          type="button"
          className="pf-tbtn pf-tbtn--icon pf-tbtn--ghost"
          aria-label="Exit selection"
          onClick={() => onSelectModeChange(false)}
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="pf-tbar" id="pf-assets-toolbar">
        <label className="pf-tdrop">
          <span className="pf-tdrop__k">Filter:</span>
          <select
            aria-label="Filter items"
            value={segment}
            onChange={(e) => onSegmentChange(e.target.value as AssetsSegment)}
          >
            {ASSETS_FILTER_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          <FilterChevron />
        </label>

        <button
          type="button"
          id="pf-hide-btn"
          className="pf-tbtn"
          onClick={() => onSelectModeChange(true)}
        >
          Cancel / Hide
        </button>

        {filterActive ? (
          <button type="button" className="pf-tbtn pf-tbtn--ghost" onClick={onClearFilters}>
            Clear
          </button>
        ) : null}

        <div className="pf-tbar__spacer" />

        <div className="pf-tbar__cluster">
          <label className="pf-tdrop pf-tdrop--sort">
            <span className="pf-tdrop__k">Sort:</span>
            <select
              aria-label="Sort items"
              value={sort}
              onChange={(e) => onSortChange(e.target.value as AssetsToolbarSort)}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <FilterChevron />
          </label>

          <div className="pf-view-toggle" role="group" aria-label="View mode" hidden>
            <button
              type="button"
              className={`pf-view${view === "gallery" ? " pf-view--sel" : ""}`}
              aria-pressed={view === "gallery"}
              onClick={() => onViewChange("gallery")}
            >
              Gallery
            </button>
            <button
              type="button"
              className={`pf-view${view === "table" ? " pf-view--sel" : ""}`}
              aria-pressed={view === "table"}
              onClick={() => onViewChange("table")}
            >
              Table
            </button>
          </div>
        </div>
      </div>
  );
}
