"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/ds/cn";
import {
  MARKETS_SORT_OPTIONS,
  MARKETS_SORT_UI_IDS,
  type MarketsSortId,
} from "@/lib/markets/marketsCollectionSort";
import {
  groupGradeFilterOptions,
  MARKETS_GRADE_FILTER_OPTIONS,
  MARKETS_PRICE_PRESET_CHIPS,
  MARKETS_VAULT_FILTER_OPTIONS,
  marketsPriceChipLabel,
  type MarketsGradeFilterId,
  type MarketsVaultFilterId,
} from "@/lib/markets/marketsFilters";
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
  priceMin,
  priceMax,
  onPriceRangeChange,
  gradeFilters,
  onGradeToggle,
  onGradeFiltersChange,
  vaultFilters,
  onVaultToggle,
  onVaultFiltersChange,
  filters = MARKETS_CATEGORY_FILTERS,
}: {
  categoryFilter: CollectionCategoryFilterId;
  onCategoryChange: (id: CollectionCategoryFilterId) => void;
  sortId: MarketsSortId;
  onSortChange: (id: MarketsSortId) => void;
  priceMin: string;
  priceMax: string;
  onPriceRangeChange: (min: string, max: string) => void;
  gradeFilters: ReadonlySet<MarketsGradeFilterId>;
  onGradeToggle: (id: MarketsGradeFilterId) => void;
  onGradeFiltersChange: (grades: Set<MarketsGradeFilterId>) => void;
  vaultFilters?: ReadonlySet<MarketsVaultFilterId>;
  onVaultToggle?: (id: MarketsVaultFilterId) => void;
  onVaultFiltersChange?: (vaults: Set<MarketsVaultFilterId>) => void;
  filters?: CategoryFilterOption[];
}) {
  const [openPop, setOpenPop] = useState<PopId>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState(categoryFilter);
  const [draftSort, setDraftSort] = useState(sortId);
  const [draftPriceMin, setDraftPriceMin] = useState(priceMin);
  const [draftPriceMax, setDraftPriceMax] = useState(priceMax);
  const [draftGrades, setDraftGrades] = useState<Set<MarketsGradeFilterId>>(
    () => new Set(gradeFilters),
  );
  const [draftVaults, setDraftVaults] = useState<Set<MarketsVaultFilterId>>(
    () => new Set(vaultFilters ?? []),
  );

  const catRef = useRef<HTMLDivElement>(null);
  const gradeRef = useRef<HTMLDivElement>(null);
  const priceRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  useDropdownDismiss(openPop === "category", () => setOpenPop(null), catRef);
  useDropdownDismiss(openPop === "grade", () => setOpenPop(null), gradeRef);
  useDropdownDismiss(openPop === "price", () => setOpenPop(null), priceRef);
  useDropdownDismiss(openPop === "sort", () => setOpenPop(null), sortRef);

  const activeFilter = filters.find((f) => f.id === categoryFilter);
  const categoryLabel = activeFilter ? categoryChipLabel(activeFilter) : "All";
  const categoryActive = categoryFilter !== "all";

  const priceLabel = marketsPriceChipLabel(priceMin, priceMax);
  const priceActive = Boolean(priceMin.trim() || priceMax.trim());

  const gradeActive = gradeFilters.size > 0;
  const gradeValue =
    gradeFilters.size === 0
      ? undefined
      : gradeFilters.size === 1
        ? [...gradeFilters][0]
        : `${gradeFilters.size}`;

  const vaultActive = (vaultFilters?.size ?? 0) > 0;

  const moreCount = useMemo(() => {
    let n = 0;
    if (categoryActive) n += 1;
    if (priceActive) n += 1;
    if (gradeActive) n += 1;
    if (vaultActive) n += 1;
    return n;
  }, [categoryActive, priceActive, gradeActive, vaultActive]);

  useEffect(() => {
    if (!drawerOpen) return;
    setDraftCategory(categoryFilter);
    setDraftSort(sortId);
    setDraftPriceMin(priceMin);
    setDraftPriceMax(priceMax);
    setDraftGrades(new Set(gradeFilters));
    setDraftVaults(new Set(vaultFilters ?? []));
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen, categoryFilter, sortId, priceMin, priceMax, gradeFilters, vaultFilters]);

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
    if (draftPriceMin !== priceMin || draftPriceMax !== priceMax) {
      trackEvent("filter_applied", {
        filter_type: "price",
        filter_value: marketsPriceChipLabel(draftPriceMin, draftPriceMax) || "any",
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
    onPriceRangeChange(draftPriceMin, draftPriceMax);
    onGradeFiltersChange(new Set(draftGrades));
    onVaultFiltersChange?.(new Set(draftVaults));
    setDrawerOpen(false);
  }

  function clearAllFilters() {
    onCategoryChange("all");
    onPriceRangeChange("", "");
    onGradeFiltersChange(new Set());
    onVaultFiltersChange?.(new Set());
    setDraftCategory("all");
    setDraftPriceMin("");
    setDraftPriceMax("");
    setDraftGrades(new Set());
    setDraftVaults(new Set());
  }

  function toggleDraftGrade(grade: MarketsGradeFilterId) {
    setDraftGrades((prev) => {
      const next = new Set(prev);
      if (next.has(grade)) next.delete(grade);
      else next.add(grade);
      return next;
    });
  }

  function toggleDraftVault(id: MarketsVaultFilterId) {
    setDraftVaults((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
      label: priceLabel ?? "Price",
      onClear: () => onPriceRangeChange("", ""),
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
  for (const opt of MARKETS_VAULT_FILTER_OPTIONS) {
    if (vaultFilters?.has(opt.id)) {
      activeChips.push({
        key: `vault-${opt.id}`,
        label: opt.chipLabel,
        onClear: () => onVaultToggle?.(opt.id),
      });
    }
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
            {groupGradeFilterOptions(MARKETS_GRADE_FILTER_OPTIONS).map((group) => (
              <div key={group.label} className="markets-fgroup">
                <div className="markets-fgroup-lbl">{group.label}</div>
                <div className="markets-fchips">
                  {group.items.map((grade) => {
                    const selected = gradeFilters.has(grade);
                    return (
                      <button
                        key={grade}
                        type="button"
                        className={cn("markets-fchip", selected && "markets-fchip--on")}
                        aria-pressed={selected}
                        onClick={(e) => {
                          e.stopPropagation();
                          trackEvent("filter_applied", {
                            filter_type: "grade",
                            filter_value: grade,
                          });
                          onGradeToggle(grade);
                        }}
                      >
                        {grade}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
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
            value={priceActive ? priceLabel : undefined}
            active={priceActive}
            open={openPop === "price"}
            onClick={() => setOpenPop((p) => (p === "price" ? null : "price"))}
          />
          <div
            className={cn(
              "markets-pop",
              openPop === "price" && "markets-pop--open",
            )}
            role="dialog"
            aria-label="Price"
          >
            <div className="markets-frange">
              <input
                type="number"
                inputMode="numeric"
                placeholder="Min $"
                value={priceMin}
                onChange={(e) => onPriceRangeChange(e.target.value, priceMax)}
              />
              <span>–</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Max $"
                value={priceMax}
                onChange={(e) => onPriceRangeChange(priceMin, e.target.value)}
              />
            </div>
            <div className="markets-fchips">
              {MARKETS_PRICE_PRESET_CHIPS.map((preset) => {
                const selected = priceMin === preset.min && priceMax === preset.max;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={cn("markets-fchip", selected && "markets-fchip--on")}
                    aria-pressed={selected}
                    onClick={() => {
                      const next = selected
                        ? { min: "", max: "" }
                        : { min: preset.min, max: preset.max };
                      trackEvent("filter_applied", {
                        filter_type: "price",
                        filter_value: next.min || next.max ? preset.id : "any",
                      });
                      onPriceRangeChange(next.min, next.max);
                    }}
                  >
                    {preset.chipLabel}
                  </button>
                );
              })}
            </div>
            <PopFooter
              clearDisabled={!priceActive}
              onClear={() => {
                onPriceRangeChange("", "");
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
            <div className="markets-frange">
              <input
                type="number"
                inputMode="numeric"
                placeholder="Min $"
                value={draftPriceMin}
                onChange={(e) => setDraftPriceMin(e.target.value)}
              />
              <span>–</span>
              <input
                type="number"
                inputMode="numeric"
                placeholder="Max $"
                value={draftPriceMax}
                onChange={(e) => setDraftPriceMax(e.target.value)}
              />
            </div>
            <div className="markets-fd-chips">
              {MARKETS_PRICE_PRESET_CHIPS.map((preset) => {
                const selected =
                  draftPriceMin === preset.min && draftPriceMax === preset.max;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    className={cn(
                      "markets-fd-option",
                      selected && "markets-fd-option--sel",
                    )}
                    onClick={() => {
                      if (selected) {
                        setDraftPriceMin("");
                        setDraftPriceMax("");
                      } else {
                        setDraftPriceMin(preset.min);
                        setDraftPriceMax(preset.max);
                      }
                    }}
                  >
                    {preset.chipLabel}
                  </button>
                );
              })}
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

          {onVaultFiltersChange ? (
            <div className="markets-fd-section">
              <span className="markets-fd-label">Vault</span>
              <div className="markets-fd-chips">
                {MARKETS_VAULT_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={cn(
                      "markets-fd-option",
                      draftVaults.has(opt.id) && "markets-fd-option--sel",
                    )}
                    onClick={() => toggleDraftVault(opt.id)}
                  >
                    {opt.chipLabel}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

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
