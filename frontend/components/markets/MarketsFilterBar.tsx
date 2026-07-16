"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/ds/cn";
import {
  MARKETS_SORT_OPTIONS,
  type MarketsSortId,
} from "@/lib/markets/marketsCollectionSort";
import {
  MARKETS_DEFAULT_PRICE_FILTER,
  MARKETS_GRADE_FILTER_OPTIONS,
  MARKETS_PRICE_FILTER_OPTIONS,
  type MarketsGradeFilterId,
  type MarketsPriceFilterId,
} from "@/lib/markets/marketsFilters";
import {
  MARKETS_CATEGORY_FILTERS,
  type CategoryFilterOption,
  type CollectionCategoryFilterId,
} from "@/lib/market";
import { useGnbMobile } from "@/hooks/layout/useGnbMobile";
import { TkButton } from "@/components/ds";
import { trackEvent } from "@/lib/analytics/googleAnalytics";

const MARKETS_SORT_UI_IDS: MarketsSortId[] = [
  "pct_change_high",
  "low_price",
  "high_price",
  "recent_listed",
  "population_low",
];

export const SORT_DS_LABELS: Record<MarketsSortId, string> = {
  pct_change_high: "Top gainers",
  recent_listed: "Newest listings",
  high_price: "Price: high → low",
  low_price: "Price: low → high",
  population_low: "Population: low → high",
  recent_sold: "Recent sold",
};

const SORT_DRAWER_LABELS: Partial<Record<MarketsSortId, string>> = {
  recent_listed: "Newest",
  population_low: "Population",
};

function categoryChipLabel(f: CategoryFilterOption): string {
  if (f.id === "all") return "All";
  return f.label;
}

function FilterIcon({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      shapeRendering="crispEdges"
      fill="currentColor"
      aria-hidden
    >
      <rect x={1} y={2} width={10} height={2} />
      <rect x={3} y={5} width={6} height={2} />
      <rect x={5} y={8} width={2} height={2} />
    </svg>
  );
}

function useDropdownDismiss(open: boolean, onClose: () => void, rootRef: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    function onMouse(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouse);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouse);
    };
  }, [open, onClose, rootRef]);
}

function SortDropdown({
  sortId,
  onSortChange,
  className,
}: {
  sortId: MarketsSortId;
  onSortChange: (id: MarketsSortId) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const label = SORT_DS_LABELS[sortId] ?? "Sort";
  useDropdownDismiss(open, () => setOpen(false), rootRef);

  return (
    <div ref={rootRef} className={cn("markets-dd", open && "open", className)}>
      <button
        type="button"
        className="markets-pchip markets-dd__trig"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Sort: <span className="markets-dd__val">{label}</span>{" "}
        <span className="tkl-mono markets-dd__caret">▾</span>
      </button>
      <div className="markets-dd__menu" role="menu">
        <div className="markets-dd__label">Sort by</div>
        {MARKETS_SORT_UI_IDS.map((id) => {
          const selected = sortId === id;
          return (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              className={cn("markets-dd__item", selected && "markets-dd__item--sel")}
              onClick={() => {
                trackEvent("filter_applied", { filter_type: "sort", filter_value: id });
                onSortChange(id);
                setOpen(false);
              }}
            >
              {SORT_DS_LABELS[id]}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PriceDropdown({
  priceFilter,
  onPriceFilterChange,
  className,
}: {
  priceFilter: MarketsPriceFilterId;
  onPriceFilterChange: (id: MarketsPriceFilterId) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const active =
    MARKETS_PRICE_FILTER_OPTIONS.find((o) => o.id === priceFilter) ??
    MARKETS_PRICE_FILTER_OPTIONS[0];
  useDropdownDismiss(open, () => setOpen(false), rootRef);

  return (
    <div ref={rootRef} className={cn("markets-dd", open && "open", className)}>
      <button
        type="button"
        className="markets-pchip markets-dd__trig"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Price: <span className="markets-dd__val">{active.chipLabel}</span>{" "}
        <span className="tkl-mono markets-dd__caret">▾</span>
      </button>
      <div className="markets-dd__menu" role="menu">
        <div className="markets-dd__label">Price range</div>
        {MARKETS_PRICE_FILTER_OPTIONS.map((opt) => {
          const selected = priceFilter === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              className={cn("markets-dd__item", selected && "markets-dd__item--sel")}
              onClick={() => {
                trackEvent("filter_applied", { filter_type: "price", filter_value: opt.id });
                onPriceFilterChange(opt.id);
                setOpen(false);
              }}
            >
              {opt.menuLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GradeFiltersDropdown({
  gradeFilters,
  onGradeToggle,
  className,
}: {
  gradeFilters: ReadonlySet<MarketsGradeFilterId>;
  onGradeToggle: (id: MarketsGradeFilterId) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useDropdownDismiss(open, () => setOpen(false), rootRef);

  return (
    <div ref={rootRef} className={cn("markets-dd", open && "open", className)}>
      <button
        type="button"
        className="markets-pchip markets-dd__trig"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <FilterIcon size={13} />
        Filters
      </button>
      <div className={cn("markets-dd__menu", "markets-dd__menu--wide")} role="menu">
        <div className="markets-dd__label">Grade</div>
        {MARKETS_GRADE_FILTER_OPTIONS.map((grade) => {
          const selected = gradeFilters.has(grade);
          return (
            <button
              key={grade}
              type="button"
              role="menuitemcheckbox"
              aria-checked={selected}
              className={cn(
                "markets-dd__item",
                "markets-dd__item--togg",
                selected && "markets-dd__item--sel",
              )}
              onClick={(e) => {
                e.stopPropagation();
                trackEvent("filter_applied", { filter_type: "grade", filter_value: grade });
                onGradeToggle(grade);
              }}
            >
              <span className="markets-dd__chk" aria-hidden />
              {grade}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MarketsFilterBar({
  categoryFilter,
  onCategoryChange,
  sortId,
  onSortChange,
  priceFilter,
  onPriceFilterChange,
  gradeFilters,
  onGradeToggle,
  onGradeFiltersChange,
  filters = MARKETS_CATEGORY_FILTERS,
}: {
  categoryFilter: CollectionCategoryFilterId;
  onCategoryChange: (id: CollectionCategoryFilterId) => void;
  sortId: MarketsSortId;
  onSortChange: (id: MarketsSortId) => void;
  priceFilter: MarketsPriceFilterId;
  onPriceFilterChange: (id: MarketsPriceFilterId) => void;
  gradeFilters: ReadonlySet<MarketsGradeFilterId>;
  onGradeToggle: (id: MarketsGradeFilterId) => void;
  onGradeFiltersChange: (grades: Set<MarketsGradeFilterId>) => void;
  filters?: CategoryFilterOption[];
}) {
  const gnbMobile = useGnbMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState(categoryFilter);
  const [draftSort, setDraftSort] = useState(sortId);
  const [draftPrice, setDraftPrice] = useState(priceFilter);
  const [draftGrades, setDraftGrades] = useState<Set<MarketsGradeFilterId>>(new Set(gradeFilters));

  const activeFilter = filters.find((f) => f.id === categoryFilter);
  const categoryLabel = activeFilter ? categoryChipLabel(activeFilter) : "All";
  const sortLabel = SORT_DS_LABELS[sortId];

  useEffect(() => {
    if (!drawerOpen) return;
    setDraftCategory(categoryFilter);
    setDraftSort(sortId);
    setDraftPrice(priceFilter);
    setDraftGrades(new Set(gradeFilters));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen, categoryFilter, sortId, priceFilter, gradeFilters]);

  function applyDrawer() {
    if (draftCategory !== categoryFilter) {
      trackEvent("filter_applied", { filter_type: "category", filter_value: draftCategory });
    }
    if (draftSort !== sortId) {
      trackEvent("filter_applied", { filter_type: "sort", filter_value: draftSort });
    }
    if (draftPrice !== priceFilter) {
      trackEvent("filter_applied", { filter_type: "price", filter_value: draftPrice });
    }
    const gradesChanged =
      draftGrades.size !== gradeFilters.size ||
      [...draftGrades].some((g) => !gradeFilters.has(g));
    if (gradesChanged) {
      trackEvent("filter_applied", {
        filter_type: "grade",
        filter_value: [...draftGrades].join(",") || "none",
      });
    }
    onCategoryChange(draftCategory);
    onSortChange(draftSort);
    onPriceFilterChange(draftPrice);
    onGradeFiltersChange(new Set(draftGrades));
    setDrawerOpen(false);
  }

  function toggleDraftGrade(grade: MarketsGradeFilterId) {
    setDraftGrades((prev) => {
      const next = new Set(prev);
      if (next.has(grade)) next.delete(grade);
      else next.add(grade);
      return next;
    });
  }

  return (
    <div className="markets-filter-sticky">
      <div className="tkl-wrap markets-filter-bar-mobile">
        <span className="markets-filter-bar-mobile__summary">
          <b>{categoryLabel === "ALL" ? "All" : categoryLabel}</b> · {sortLabel}
        </span>
        <button
          type="button"
          className="markets-pchip"
          onClick={() => setDrawerOpen(true)}
        >
          <FilterIcon />
          Filters
        </button>
      </div>

      <div className="tkl-wrap markets-filter-bar-desktop">
        {filters.map((f) => {
          const active = categoryFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              className={cn("markets-pchip", active && "markets-pchip--active")}
              aria-pressed={active}
              onClick={() => {
                trackEvent("filter_applied", { filter_type: "category", filter_value: f.id });
                onCategoryChange(f.id);
              }}
            >
              {categoryChipLabel(f)}
            </button>
          );
        })}
        <div className="markets-filter-spacer" aria-hidden />
        <PriceDropdown priceFilter={priceFilter} onPriceFilterChange={onPriceFilterChange} />
        <GradeFiltersDropdown gradeFilters={gradeFilters} onGradeToggle={onGradeToggle} />
        <SortDropdown sortId={sortId} onSortChange={onSortChange} />
      </div>

      {gnbMobile ? (
        <div
          className={cn("markets-filter-drawer", drawerOpen && "open")}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDrawerOpen(false);
          }}
        >
          <div className="markets-filter-drawer__panel">
            <div className="markets-filter-drawer__head">
              <span className="markets-filter-drawer__title">Filters</span>
              <button
                type="button"
                className="markets-filter-drawer__close"
                aria-label="Close filters"
                onClick={() => setDrawerOpen(false)}
              >
                <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <line x1={6} y1={6} x2={18} y2={18} />
                  <line x1={18} y1={6} x2={6} y2={18} />
                </svg>
              </button>
            </div>

            <div className="markets-fd-section">
              <span className="markets-fd-label">Category</span>
              <div className="markets-fd-chips">
                {filters.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    className={cn(
                      "markets-fd-option",
                      draftCategory === f.id && "markets-fd-option--sel",
                    )}
                    onClick={() => setDraftCategory(f.id)}
                  >
                    {categoryChipLabel(f)}
                  </button>
                ))}
              </div>
            </div>

            <div className="markets-fd-section">
              <span className="markets-fd-label">Price range</span>
              <div className="markets-fd-chips">
                {MARKETS_PRICE_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={cn(
                      "markets-fd-option",
                      draftPrice === opt.id && "markets-fd-option--sel",
                    )}
                    onClick={() => setDraftPrice(opt.id)}
                  >
                    {opt.chipLabel}
                  </button>
                ))}
              </div>
            </div>

            <div className="markets-fd-section">
              <span className="markets-fd-label">Grade</span>
              <div className="markets-fd-chips">
                {MARKETS_GRADE_FILTER_OPTIONS.map((grade) => (
                  <button
                    key={grade}
                    type="button"
                    className={cn(
                      "markets-fd-option",
                      draftGrades.has(grade) && "markets-fd-option--sel",
                    )}
                    onClick={() => toggleDraftGrade(grade)}
                  >
                    {grade}
                  </button>
                ))}
              </div>
            </div>

            <div className="markets-fd-section">
              <span className="markets-fd-label">Sort by</span>
              <div className="markets-fd-chips">
                {MARKETS_SORT_UI_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={cn(
                      "markets-fd-option",
                      draftSort === id && "markets-fd-option--sel",
                    )}
                    onClick={() => setDraftSort(id)}
                  >
                    {SORT_DRAWER_LABELS[id] ?? SORT_DS_LABELS[id]}
                  </button>
                ))}
              </div>
            </div>

            <div className="markets-filter-drawer__footer">
              <TkButton
                type="button"
                variant="primary"
                className="markets-filter-apply-btn"
                onClick={applyDrawer}
              >
                Apply filters
              </TkButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
