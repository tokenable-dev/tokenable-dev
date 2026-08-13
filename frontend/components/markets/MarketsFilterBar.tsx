"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/ds/cn";
import type {
  CollectionListMarketSnapshot,
  MarketplaceCollectionSummary,
} from "@/lib/core";
import {
  MARKETS_SORT_OPTIONS,
  MARKETS_SORT_UI_IDS,
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
  buildMarketsTypeaheadGroups,
  type MarketsTypeaheadRow,
} from "@/lib/markets/marketsTypeahead";
import {
  MARKETS_CATEGORY_FILTERS,
  type CategoryFilterOption,
  type CollectionCategoryFilterId,
} from "@/lib/market";
import { TkButton } from "@/components/ds";
import { trackEvent } from "@/lib/analytics/googleAnalytics";

const SORT_LABELS: Record<MarketsSortId, string> = Object.fromEntries(
  MARKETS_SORT_OPTIONS.map((o) => [o.id, o.label]),
) as Record<MarketsSortId, string>;

const SORT_DRAWER_LABELS: Partial<Record<MarketsSortId, string>> = {
  recent_listed: "Newest",
  population_low: "Population",
};

type PopId = "category" | "grade" | "price" | "sort" | null;

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

function useDropdownDismiss(
  open: boolean,
  onClose: () => void,
  rootRef: React.RefObject<HTMLElement | null>,
) {
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

function DdChip({
  label,
  value,
  active,
  open,
  count,
  onClick,
  ariaHaspopup = "menu",
}: {
  label: string;
  value?: string;
  active?: boolean;
  open?: boolean;
  count?: number;
  onClick: () => void;
  ariaHaspopup?: "menu" | "dialog";
}) {
  return (
    <button
      type="button"
      className={cn(
        "markets-ddchip",
        active && "markets-ddchip--on",
        open && "markets-ddchip--open",
      )}
      aria-haspopup={ariaHaspopup}
      aria-expanded={Boolean(open)}
      onClick={onClick}
    >
      <span className="markets-ddchip__text">
        {label}
        {value ? (
          <>
            {" "}
            <span className="markets-ddchip__val">{value}</span>
          </>
        ) : null}
      </span>
      {count != null && count > 0 ? (
        <i className="markets-ddchip__count">{count}</i>
      ) : null}
      <span className="markets-ddchip__caret tkl-mono" aria-hidden>
        ▾
      </span>
    </button>
  );
}

function PopFooter({
  onClear,
  onDone,
  clearDisabled,
}: {
  onClear: () => void;
  onDone: () => void;
  clearDisabled?: boolean;
}) {
  return (
    <div className="markets-pop__foot">
      <button
        type="button"
        className="markets-pop__clear"
        disabled={clearDisabled}
        onClick={onClear}
      >
        Clear
      </button>
      <button type="button" className="markets-pop__done" onClick={onDone}>
        Done
      </button>
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
  searchQuery = "",
  onSearchQueryChange,
  setFilter = null,
  onSetFilterChange,
  collections = [],
  snapshotByKey,
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
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  setFilter?: string | null;
  onSetFilterChange?: (setLabel: string | null) => void;
  collections?: MarketplaceCollectionSummary[];
  snapshotByKey?: Map<string, CollectionListMarketSnapshot>;
}) {
  const router = useRouter();
  const [openPop, setOpenPop] = useState<PopId>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState(categoryFilter);
  const [draftSort, setDraftSort] = useState(sortId);
  const [draftPrice, setDraftPrice] = useState(priceFilter);
  const [draftGrades, setDraftGrades] = useState<Set<MarketsGradeFilterId>>(
    () => new Set(gradeFilters),
  );
  const [draftSearch, setDraftSearch] = useState(searchQuery);
  const [taOpen, setTaOpen] = useState(false);

  const catRef = useRef<HTMLDivElement>(null);
  const gradeRef = useRef<HTMLDivElement>(null);
  const priceRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  useDropdownDismiss(openPop === "category", () => setOpenPop(null), catRef);
  useDropdownDismiss(openPop === "grade", () => setOpenPop(null), gradeRef);
  useDropdownDismiss(openPop === "price", () => setOpenPop(null), priceRef);
  useDropdownDismiss(openPop === "sort", () => setOpenPop(null), sortRef);
  useDropdownDismiss(taOpen, () => setTaOpen(false), searchRef);

  useEffect(() => {
    setDraftSearch(searchQuery);
  }, [searchQuery]);

  const typeaheadGroups = useMemo(
    () =>
      buildMarketsTypeaheadGroups(
        draftSearch,
        collections,
        snapshotByKey ?? new Map(),
      ),
    [draftSearch, collections, snapshotByKey],
  );

  const searchEnabled = Boolean(onSearchQueryChange);

  const activeFilter = filters.find((f) => f.id === categoryFilter);
  const categoryLabel = activeFilter ? categoryChipLabel(activeFilter) : "All";
  const categoryActive = categoryFilter !== "all";

  const priceOpt =
    MARKETS_PRICE_FILTER_OPTIONS.find((o) => o.id === priceFilter) ??
    MARKETS_PRICE_FILTER_OPTIONS[0]!;
  const priceActive = priceFilter !== MARKETS_DEFAULT_PRICE_FILTER;

  const gradeActive = gradeFilters.size > 0;
  const gradeValue =
    gradeFilters.size === 0
      ? undefined
      : gradeFilters.size === 1
        ? [...gradeFilters][0]
        : `${gradeFilters.size}`;

  const moreCount = useMemo(() => {
    let n = 0;
    if (categoryActive) n += 1;
    if (priceActive) n += 1;
    if (gradeActive) n += 1;
    return n;
  }, [categoryActive, priceActive, gradeActive]);

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
      trackEvent("filter_applied", {
        filter_type: "category",
        filter_value: draftCategory,
      });
    }
    if (draftSort !== sortId) {
      trackEvent("filter_applied", {
        filter_type: "sort",
        filter_value: draftSort,
      });
    }
    if (draftPrice !== priceFilter) {
      trackEvent("filter_applied", {
        filter_type: "price",
        filter_value: draftPrice,
      });
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

  function clearAllFilters() {
    onCategoryChange("all");
    onPriceFilterChange(MARKETS_DEFAULT_PRICE_FILTER);
    onGradeFiltersChange(new Set());
    onSearchQueryChange?.("");
    onSetFilterChange?.(null);
    setDraftSearch("");
    setDraftCategory("all");
    setDraftPrice(MARKETS_DEFAULT_PRICE_FILTER);
    setDraftGrades(new Set());
  }

  function applySearchText(q: string) {
    const next = q.trim();
    onSearchQueryChange?.(next);
    onSetFilterChange?.(null);
    setTaOpen(false);
    trackEvent("filter_applied", {
      filter_type: "search",
      filter_value: next || "cleared",
    });
  }

  function onTypeaheadSelect(row: MarketsTypeaheadRow) {
    if (row.kind === "category") {
      onCategoryChange(row.id);
      onSearchQueryChange?.("");
      onSetFilterChange?.(null);
      setDraftSearch("");
      trackEvent("filter_applied", {
        filter_type: "category",
        filter_value: row.id,
      });
    } else if (row.kind === "set") {
      onSetFilterChange?.(row.label);
      onSearchQueryChange?.("");
      setDraftSearch(row.label);
      trackEvent("filter_applied", {
        filter_type: "set",
        filter_value: row.label,
      });
    } else {
      router.push(
        `/marketplace/collections/${encodeURIComponent(row.collectionKey)}`,
      );
    }
    setTaOpen(false);
    setOpenPop(null);
  }

  function toggleDraftGrade(grade: MarketsGradeFilterId) {
    setDraftGrades((prev) => {
      const next = new Set(prev);
      if (next.has(grade)) next.delete(grade);
      else next.add(grade);
      return next;
    });
  }

  const activeChips: { key: string; label: string; onClear: () => void }[] = [];
  if (categoryActive) {
    activeChips.push({
      key: "cat",
      label: categoryLabel,
      onClear: () => onCategoryChange("all"),
    });
  }
  if (priceActive) {
    activeChips.push({
      key: "price",
      label: priceOpt.chipLabel,
      onClear: () => onPriceFilterChange(MARKETS_DEFAULT_PRICE_FILTER),
    });
  }
  for (const g of MARKETS_GRADE_FILTER_OPTIONS) {
    if (gradeFilters.has(g)) {
      activeChips.push({
        key: `grade-${g}`,
        label: g,
        onClear: () => onGradeToggle(g),
      });
    }
  }
  if (setFilter) {
    activeChips.push({
      key: "set",
      label: setFilter,
      onClear: () => {
        onSetFilterChange?.(null);
        setDraftSearch("");
      },
    });
  } else if (searchQuery.trim()) {
    activeChips.push({
      key: "q",
      label: `“${searchQuery.trim()}”`,
      onClear: () => {
        onSearchQueryChange?.("");
        setDraftSearch("");
      },
    });
  }

  return (
    <div className="markets-filter-sticky">
      <div className="tkl-wrap markets-slim-bar">
        <div ref={catRef} className="markets-fw">
          <DdChip
            label="Category"
            value={categoryActive ? categoryLabel : undefined}
            active={categoryActive}
            open={openPop === "category"}
            onClick={() =>
              setOpenPop((p) => (p === "category" ? null : "category"))
            }
          />
          <div
            className={cn(
              "markets-pop",
              openPop === "category" && "markets-pop--open",
            )}
            role="menu"
          >
            <div className="markets-pop__label">Category</div>
            {filters.map((f) => {
              const selected = categoryFilter === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  className={cn(
                    "markets-pop__item",
                    selected && "markets-pop__item--sel",
                  )}
                  onClick={() => {
                    trackEvent("filter_applied", {
                      filter_type: "category",
                      filter_value: f.id,
                    });
                    onCategoryChange(f.id);
                    setOpenPop(null);
                  }}
                >
                  {categoryChipLabel(f)}
                </button>
              );
            })}
            <PopFooter
              clearDisabled={!categoryActive}
              onClear={() => {
                onCategoryChange("all");
                setOpenPop(null);
              }}
              onDone={() => setOpenPop(null)}
            />
          </div>
        </div>

        <div ref={gradeRef} className="markets-fw">
          <DdChip
            label="Grade"
            value={gradeValue}
            active={gradeActive}
            open={openPop === "grade"}
            count={gradeFilters.size > 1 ? gradeFilters.size : undefined}
            onClick={() => setOpenPop((p) => (p === "grade" ? null : "grade"))}
          />
          <div
            className={cn(
              "markets-pop",
              openPop === "grade" && "markets-pop--open",
            )}
            role="menu"
          >
            <div className="markets-pop__label">Grade</div>
            {MARKETS_GRADE_FILTER_OPTIONS.map((grade) => {
              const selected = gradeFilters.has(grade);
              return (
                <button
                  key={grade}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={selected}
                  className={cn(
                    "markets-pop__item",
                    "markets-pop__item--togg",
                    selected && "markets-pop__item--sel",
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    trackEvent("filter_applied", {
                      filter_type: "grade",
                      filter_value: grade,
                    });
                    onGradeToggle(grade);
                  }}
                >
                  <span className="markets-pop__chk" aria-hidden />
                  {grade}
                </button>
              );
            })}
            <PopFooter
              clearDisabled={!gradeActive}
              onClear={() => {
                onGradeFiltersChange(new Set());
                setOpenPop(null);
              }}
              onDone={() => setOpenPop(null)}
            />
          </div>
        </div>

        <div ref={priceRef} className="markets-fw">
          <DdChip
            label="Price"
            value={priceActive ? priceOpt.chipLabel : undefined}
            active={priceActive}
            open={openPop === "price"}
            onClick={() => setOpenPop((p) => (p === "price" ? null : "price"))}
          />
          <div
            className={cn(
              "markets-pop",
              openPop === "price" && "markets-pop--open",
            )}
            role="menu"
          >
            <div className="markets-pop__label">Price range</div>
            {MARKETS_PRICE_FILTER_OPTIONS.map((opt) => {
              const selected = priceFilter === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  className={cn(
                    "markets-pop__item",
                    selected && "markets-pop__item--sel",
                  )}
                  onClick={() => {
                    trackEvent("filter_applied", {
                      filter_type: "price",
                      filter_value: opt.id,
                    });
                    onPriceFilterChange(opt.id);
                    setOpenPop(null);
                  }}
                >
                  {opt.menuLabel}
                </button>
              );
            })}
            <PopFooter
              clearDisabled={!priceActive}
              onClear={() => {
                onPriceFilterChange(MARKETS_DEFAULT_PRICE_FILTER);
                setOpenPop(null);
              }}
              onDone={() => setOpenPop(null)}
            />
          </div>
        </div>

        <button
          type="button"
          className={cn(
            "markets-ddchip",
            "markets-ddchip--more",
            moreCount > 0 && "markets-ddchip--on",
          )}
          aria-label="More filters"
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          onClick={() => {
            setOpenPop(null);
            setDrawerOpen(true);
          }}
        >
          <FilterIcon size={13} />
          <span className="markets-ddchip__label">More filters</span>
          {moreCount > 0 ? (
            <i className="markets-ddchip__count">{moreCount}</i>
          ) : null}
        </button>

        <div className="markets-slim-bar__sp" aria-hidden />

        <div className="markets-slim-bar__end">
        {searchEnabled ? (
          <div ref={searchRef} className="markets-usearch">
            <div className="markets-usearch__box">
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                aria-hidden
              >
                <circle cx={11} cy={11} r={7} />
                <line x1={16.5} y1={16.5} x2={21} y2={21} />
              </svg>
              <input
                type="search"
                value={draftSearch}
                autoComplete="off"
                placeholder="Search cards, sets, players…"
                aria-label="Search cards, sets, players"
                aria-expanded={taOpen && draftSearch.trim().length > 0}
                aria-controls="markets-typeahead"
                onFocus={() => {
                  setOpenPop(null);
                  if (draftSearch.trim()) setTaOpen(true);
                }}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraftSearch(v);
                  setTaOpen(v.trim().length > 0);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    applySearchText(draftSearch);
                  } else if (e.key === "Escape") {
                    setTaOpen(false);
                  }
                }}
              />
            </div>
            {taOpen && draftSearch.trim() ? (
              <div
                id="markets-typeahead"
                className="markets-ta markets-ta--open"
                role="listbox"
              >
                {typeaheadGroups.length === 0 ? (
                  <div className="markets-ta__none">
                    No matches for “{draftSearch.trim()}”
                  </div>
                ) : (
                  typeaheadGroups.map((g) => (
                    <div key={g.key} className="markets-ta__group">
                      <div className="markets-ta__head">
                        {g.label}{" "}
                        <span>{g.total.toLocaleString("en-US")}</span>
                      </div>
                      {g.rows.map((row) => (
                        <button
                          key={
                            row.kind === "card"
                              ? row.collectionKey
                              : `${row.kind}-${row.label}`
                          }
                          type="button"
                          role="option"
                          className="markets-ta__row"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => onTypeaheadSelect(row)}
                        >
                          <span className="markets-ta__label">{row.label}</span>
                          {row.count != null ? (
                            <span className="markets-ta__count">
                              {row.count.toLocaleString("en-US")}
                            </span>
                          ) : null}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="markets-ta__all"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          if (g.key === "sets" && g.rows[0]?.kind === "set") {
                            onTypeaheadSelect(g.rows[0]);
                          } else if (
                            g.key === "categories" &&
                            g.rows[0]?.kind === "category"
                          ) {
                            onTypeaheadSelect(g.rows[0]);
                          } else {
                            applySearchText(draftSearch);
                          }
                        }}
                      >
                        See all {g.label.toLowerCase()}
                      </button>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        <div ref={sortRef} className="markets-fw markets-fw--sort">
          <DdChip
            label="Sort:"
            value={SORT_LABELS[sortId]}
            open={openPop === "sort"}
            onClick={() => setOpenPop((p) => (p === "sort" ? null : "sort"))}
          />
          <div
            className={cn(
              "markets-pop",
              "markets-pop--right",
              openPop === "sort" && "markets-pop--open",
            )}
            role="menu"
          >
            <div className="markets-pop__label">Sort by</div>
            {MARKETS_SORT_UI_IDS.map((id) => {
              const selected = sortId === id;
              return (
                <button
                  key={id}
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected}
                  className={cn(
                    "markets-pop__item",
                    selected && "markets-pop__item--sel",
                  )}
                  onClick={() => {
                    trackEvent("filter_applied", {
                      filter_type: "sort",
                      filter_value: id,
                    });
                    onSortChange(id);
                    setOpenPop(null);
                  }}
                >
                  {SORT_LABELS[id]}
                </button>
              );
            })}
            <PopFooter
              clearDisabled
              onClear={() => setOpenPop(null)}
              onDone={() => setOpenPop(null)}
            />
          </div>
        </div>
        </div>
      </div>

      {activeChips.length > 0 ? (
        <div className="tkl-wrap markets-achips">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              type="button"
              className="markets-achip"
              onClick={chip.onClear}
            >
              {chip.label}
              <span aria-hidden>×</span>
            </button>
          ))}
          <button
            type="button"
            className="markets-achip markets-achip--clear"
            onClick={clearAllFilters}
          >
            Clear all
          </button>
        </div>
      ) : null}

      <div
        className={cn("markets-filter-drawer", drawerOpen && "open")}
        onClick={(e) => {
          if (e.target === e.currentTarget) setDrawerOpen(false);
        }}
      >
        <div
          className="markets-filter-drawer__panel"
          role="dialog"
          aria-modal="true"
          aria-label="More filters"
        >
          <div className="markets-filter-drawer__head">
            <span className="markets-filter-drawer__title">More filters</span>
            <button
              type="button"
              className="markets-filter-drawer__close"
              aria-label="Close filters"
              onClick={() => setDrawerOpen(false)}
            >
              <svg
                viewBox="0 0 24 24"
                width={20}
                height={20}
                fill="none"
                stroke="currentColor"
                strokeWidth={2.5}
              >
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
                  {SORT_DRAWER_LABELS[id] ?? SORT_LABELS[id]}
                </button>
              ))}
            </div>
          </div>

          <div className="markets-filter-drawer__footer">
            <TkButton
              type="button"
              variant="subtle"
              className="markets-filter-clear-btn"
              onClick={() => {
                clearAllFilters();
                setDraftSort(sortId);
                setDrawerOpen(false);
              }}
            >
              Clear all
            </TkButton>
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
    </div>
  );
}
