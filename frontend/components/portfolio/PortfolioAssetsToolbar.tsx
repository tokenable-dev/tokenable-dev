"use client";

import { useTranslations } from "next-intl";
import {
  ASSETS_FILTER_OPTIONS,
  type AssetsSegment,
} from "@/lib/portfolio/portfolioAssetsSegment";
import {
  placePortfolioToolbar,
  useDockPortfolioToolbar,
} from "@/components/portfolio/PortfolioMainSection";

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
  const t = useTranslations("Portfolio");
  const filterActive = segment !== "all" || sort !== "newest";
  const dockSlot = useDockPortfolioToolbar(1024);

  const hideActionLabel =
    segment === "hidden"
      ? selectedHideCount > 0
        ? t("unhideCount", { count: selectedHideCount })
        : t("unhide")
      : selectedHideCount > 0
        ? t("hideCount", { count: selectedHideCount })
        : t("hide");
  const filterLabel = (id: AssetsSegment) => {
    if (id === "listed") return t("listed");
    if (id === "notlisted") return t("unlisted");
    if (id === "shipping") return t("redeeming");
    if (id === "verifying") return t("vaulting");
    if (id === "hidden") return t("hidden");
    return t("all");
  };
  const sortLabel = (value: AssetsToolbarSort) => {
    if (value === "value") return t("highPrice");
    if (value === "low") return t("lowPrice");
    return t("mostRecent");
  };

  if (selectMode) {
    return placePortfolioToolbar(
      <div
        className="pf-tbar pf-tbar--select pf-cl-bar"
        id="pf-assets-toolbar"
        role="toolbar"
        aria-label={t("selectToolbar")}
      >
        <span className="pf-cl-count">{t("selected", { count: selectedCount })}</span>
        <button type="button" className="pf-tbtn" onClick={onSelectAll}>
          {t("selectAll")}
        </button>
        <button type="button" className="pf-tbtn pf-tbtn--ghost" onClick={onClearSelection}>
          {t("clear")}
        </button>
        <div className="pf-tbar__spacer" />
        {segment !== "hidden" ? (
          <button
            type="button"
            className="pf-tbtn pf-tbtn--primary"
            disabled={selectedListedCount === 0 || cancellingSelected}
            onClick={onCancelSelected}
          >
            {cancellingSelected
              ? t("cancelling")
              : selectedListedCount > 0
                ? t("cancelListingCount", { count: selectedListedCount })
                : t("cancelListing")}
          </button>
        ) : null}
        <button
          type="button"
          className="pf-tbtn"
          disabled={selectedHideCount === 0 || hidingSelected}
          onClick={onHideOrUnhideSelected}
        >
          {hidingSelected ? t("saving") : hideActionLabel}
        </button>
        <button
          type="button"
          className="pf-tbtn pf-tbtn--icon pf-tbtn--ghost"
          aria-label={t("exitSelection")}
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
      </div>,
      dockSlot,
    );
  }

  return placePortfolioToolbar(
    <div className="pf-tbar" id="pf-assets-toolbar">
        <label className="pf-tdrop">
          <span className="pf-tdrop__k">{t("filter")}</span>
          <select
            aria-label={t("filterItems")}
            value={segment}
            onChange={(e) => onSegmentChange(e.target.value as AssetsSegment)}
          >
            {ASSETS_FILTER_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {filterLabel(o.id)}
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
          {t("cancelHide")}
        </button>

        {filterActive ? (
          <button type="button" className="pf-tbtn pf-tbtn--ghost" onClick={onClearFilters}>
            {t("clear")}
          </button>
        ) : null}

        <div className="pf-tbar__spacer" />

        <div className="pf-tbar__cluster">
          <label className="pf-tdrop pf-tdrop--sort">
            <span className="pf-tdrop__k">{t("sort")}</span>
            <select
              aria-label={t("sortItems")}
              value={sort}
              onChange={(e) => onSortChange(e.target.value as AssetsToolbarSort)}
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {sortLabel(o.value)}
                </option>
              ))}
            </select>
            <FilterChevron />
          </label>

          <div className="pf-view-toggle" role="group" aria-label={t("viewMode")} hidden>
            <button
              type="button"
              className={`pf-view${view === "gallery" ? " pf-view--sel" : ""}`}
              aria-pressed={view === "gallery"}
              onClick={() => onViewChange("gallery")}
            >
              {t("gallery")}
            </button>
            <button
              type="button"
              className={`pf-view${view === "table" ? " pf-view--sel" : ""}`}
              aria-pressed={view === "table"}
              onClick={() => onViewChange("table")}
            >
              {t("table")}
            </button>
          </div>
        </div>
      </div>,
    dockSlot,
  );
}
