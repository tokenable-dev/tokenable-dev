"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  MARKETS_CATEGORY_SELECT_OPTIONS,
  type CategorySelectOption,
  type CollectionCategoryId,
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

type PopId = "set" | "grade" | "price" | "sort" | null;

const EMPTY_STRINGS: string[] = [];

function categoryOptionLabel(f: CategorySelectOption): string {
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

/** Markets.html `.ddi` + `.chk` — sort / category popover rows. */
function PopCheckItem({
  selected,
  onClick,
  children,
  role = "menuitemradio",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  role?: "menuitemradio" | "menuitemcheckbox";
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      className={cn("markets-pop__item", selected && "markets-pop__item--sel")}
      onClick={onClick}
    >
      <span className="markets-pop__chk" aria-hidden />
      {children}
    </button>
  );
}

/** Markets.html `.mk-frow` + `.mk-fbox` — More filters / set picker rows. */
function FilterCheckRow({
  selected,
  onClick,
  children,
  role = "checkbox",
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  role?: "checkbox" | "radio";
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      className={cn("markets-frow", selected && "markets-frow--on")}
      onClick={onClick}
    >
      <span className="markets-fbox" aria-hidden />
      <span className="markets-fname">{children}</span>
    </button>
  );
}

function useDropdownDismiss(
  open: boolean,
  onClose: () => void,
  rootRef: React.RefObject<HTMLElement | null>,
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onCloseRef.current();
    }
    function onMouse(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onCloseRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onMouse);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onMouse);
    };
  }, [open, rootRef]);
}

/**
 * Keep an absolutely-positioned `.markets-pop` inside the viewport.
 * Mobile sort sits mid/left in the bar but uses `--right` alignment, which
 * otherwise opens off-screen (and gets clipped by `.markets-page { overflow-x: clip }`).
 */
function useClampPopToViewport(
  open: boolean,
  rootRef: React.RefObject<HTMLElement | null>,
) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!open || !root) return;
    const pop = root.querySelector<HTMLElement>(".markets-pop--open");
    if (!pop) return;

    const margin = 12;
    const apply = () => {
      pop.style.transform = "";
      const rect = pop.getBoundingClientRect();
      let dx = 0;
      if (rect.right > window.innerWidth - margin) {
        dx = window.innerWidth - margin - rect.right;
      }
      if (rect.left + dx < margin) {
        dx = margin - rect.left;
      }
      pop.style.transform = dx ? `translateX(${dx}px)` : "";
    };

    apply();
    window.addEventListener("resize", apply);
    return () => {
      window.removeEventListener("resize", apply);
      pop.style.transform = "";
    };
  }, [open, rootRef]);
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
  categoryFilters,
  onCategoryToggle,
  onCategoryFiltersChange,
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
  sets = EMPTY_STRINGS,
  onSetsChange,
  onSetToggle,
  setFacetOptions = EMPTY_STRINGS,
  filters = MARKETS_CATEGORY_SELECT_OPTIONS,
}: {
  categoryFilters: ReadonlySet<CollectionCategoryId>;
  onCategoryToggle: (id: CollectionCategoryId) => void;
  onCategoryFiltersChange: (categories: Set<CollectionCategoryId>) => void;
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
  sets?: readonly string[];
  onSetsChange?: (sets: string[]) => void;
  onSetToggle?: (setName: string) => void;
  setFacetOptions?: readonly string[];
  filters?: readonly CategorySelectOption[];
}) {
  const [openPop, setOpenPop] = useState<PopId>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMounted, setDrawerMounted] = useState(false);
  const [setQuery, setSetQuery] = useState("");
  const [draftSetQuery, setDraftSetQuery] = useState("");
  const [draftCategories, setDraftCategories] = useState<Set<CollectionCategoryId>>(
    () => new Set(categoryFilters),
  );
  const [draftSort, setDraftSort] = useState(sortId);
  const [draftPriceMin, setDraftPriceMin] = useState(priceMin);
  const [draftPriceMax, setDraftPriceMax] = useState(priceMax);
  const [draftGrades, setDraftGrades] = useState<Set<MarketsGradeFilterId>>(
    () => new Set(gradeFilters),
  );
  const [draftVaults, setDraftVaults] = useState<Set<MarketsVaultFilterId>>(
    () => new Set(vaultFilters ?? []),
  );
  const [draftSets, setDraftSets] = useState<string[]>(() => [...sets]);

  const setRef = useRef<HTMLDivElement>(null);
  const gradeRef = useRef<HTMLDivElement>(null);
  const priceRef = useRef<HTMLDivElement>(null);
  const sortRef = useRef<HTMLDivElement>(null);

  useDropdownDismiss(openPop === "set", () => setOpenPop(null), setRef);
  useDropdownDismiss(openPop === "grade", () => setOpenPop(null), gradeRef);
  useDropdownDismiss(openPop === "price", () => setOpenPop(null), priceRef);
  useDropdownDismiss(openPop === "sort", () => setOpenPop(null), sortRef);

  useClampPopToViewport(openPop === "set", setRef);
  useClampPopToViewport(openPop === "grade", gradeRef);
  useClampPopToViewport(openPop === "price", priceRef);
  useClampPopToViewport(openPop === "sort", sortRef);

  const categoryActive = categoryFilters.size > 0;

  const priceLabel = marketsPriceChipLabel(priceMin, priceMax);
  const priceActive = Boolean(priceMin.trim() || priceMax.trim());

  const gradeActive = gradeFilters.size > 0;
  const gradeValue =
    gradeFilters.size === 0
      ? undefined
      : gradeFilters.size === 1
        ? [...gradeFilters][0]
        : `${gradeFilters.size}`;

  const setActive = sets.length > 0;
  const setValue =
    sets.length === 0 ? undefined : sets.length === 1 ? sets[0] : `${sets.length}`;

  const vaultActive = (vaultFilters?.size ?? 0) > 0;

  const filteredSetOptions = useMemo(() => {
    const q = setQuery.trim().toLowerCase();
    if (!q) return setFacetOptions;
    return setFacetOptions.filter((name) => name.toLowerCase().includes(q));
  }, [setFacetOptions, setQuery]);

  const filteredDraftSetOptions = useMemo(() => {
    const q = draftSetQuery.trim().toLowerCase();
    if (!q) return setFacetOptions;
    return setFacetOptions.filter((name) => name.toLowerCase().includes(q));
  }, [setFacetOptions, draftSetQuery]);

  const moreCount = useMemo(() => {
    let n = 0;
    if (categoryActive) n += 1;
    if (setActive) n += 1;
    if (priceActive) n += 1;
    if (gradeActive) n += 1;
    if (vaultActive) n += 1;
    return n;
  }, [categoryActive, setActive, priceActive, gradeActive, vaultActive]);

  useEffect(() => {
    setDrawerMounted(true);
  }, []);

  // Snapshot filter values when the drawer opens. Do not depend on `sets`:
  // the default `[]` is a new array every render and would loop setState.
  useEffect(() => {
    if (!drawerOpen) return;
    setDraftCategories(new Set(categoryFilters));
    setDraftSort(sortId);
    setDraftPriceMin(priceMin);
    setDraftPriceMax(priceMax);
    setDraftGrades(new Set(gradeFilters));
    setDraftVaults(new Set(vaultFilters ?? []));
    setDraftSets([...sets]);
    setDraftSetQuery("");
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerOpen]);

  function applySetQuery(raw: string, mode: "live" | "draft") {
    const trimmed = raw.trim();
    if (!trimmed || !onSetToggle) return;
    trackEvent("filter_applied", {
      filter_type: "set",
      filter_value: trimmed,
    });
    onSetToggle(trimmed);
    if (mode === "live") setSetQuery("");
    else setDraftSetQuery("");
  }

  function toggleDraftSet(setName: string) {
    setDraftSets((prev) => {
      const i = prev.findIndex((s) => s.toLowerCase() === setName.toLowerCase());
      if (i >= 0) return prev.filter((_, idx) => idx !== i);
      return [...prev, setName];
    });
  }

  function applyDrawer() {
    const catsChanged =
      draftCategories.size !== categoryFilters.size ||
      [...draftCategories].some((c) => !categoryFilters.has(c));
    if (catsChanged) {
      trackEvent("filter_applied", {
        filter_type: "category",
        filter_value: [...draftCategories].join(",") || "all",
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
    onCategoryFiltersChange(new Set(draftCategories));
    onSortChange(draftSort);
    onPriceRangeChange(draftPriceMin, draftPriceMax);
    onGradeFiltersChange(new Set(draftGrades));
    onVaultFiltersChange?.(new Set(draftVaults));
    onSetsChange?.([...draftSets]);
    setDrawerOpen(false);
  }

  function clearAllFilters() {
    onCategoryFiltersChange(new Set());
    onPriceRangeChange("", "");
    onGradeFiltersChange(new Set());
    onVaultFiltersChange?.(new Set());
    onSetsChange?.([]);
    setDraftCategories(new Set());
    setDraftPriceMin("");
    setDraftPriceMax("");
    setDraftGrades(new Set());
    setDraftVaults(new Set());
    setDraftSets([]);
    setSetQuery("");
    setDraftSetQuery("");
  }

  function toggleDraftCategory(id: CollectionCategoryId) {
    setDraftCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
  for (const [i, setName] of sets.entries()) {
    activeChips.push({
      key: `set-${setName}`,
      label: setName,
      onClear: () => onSetsChange?.(sets.filter((_, idx) => idx !== i)),
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
    <>
    <div className="markets-filter-sticky">
      <div className="tkl-wrap markets-slim-bar">
        <div className="markets-catchiprow" role="group" aria-label="Category">
          {filters.map((f) => {
            const selected = categoryFilters.has(f.id);
            return (
              <button
                key={f.id}
                type="button"
                className={cn(
                  "markets-catchip",
                  selected && "markets-catchip--on",
                )}
                aria-pressed={selected}
                onClick={() => {
                  trackEvent("filter_applied", {
                    filter_type: "category",
                    filter_value: f.id,
                  });
                  onCategoryToggle(f.id);
                }}
              >
                {categoryOptionLabel(f)}
              </button>
            );
          })}
        </div>

        {onSetToggle ? (
          <div ref={setRef} className="markets-fw markets-fw--chip">
            <DdChip
              label="Set"
              active={setActive}
              open={openPop === "set"}
              onClick={() => setOpenPop((p) => (p === "set" ? null : "set"))}
            />
            <div
              className={cn(
                "markets-pop",
                "markets-pop--wide",
                openPop === "set" && "markets-pop--open",
              )}
              role="dialog"
              aria-label="Set"
            >
              <div className="markets-pop__label">Search set</div>
              <div className="markets-fsearch">
                <input
                  type="search"
                  placeholder="Set name…"
                  value={setQuery}
                  onChange={(e) => setSetQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      applySetQuery(setQuery, "live");
                    }
                  }}
                />
                {setQuery.trim() ? (
                  <button
                    type="button"
                    className="markets-fsearch__apply"
                    onClick={() => applySetQuery(setQuery, "live")}
                  >
                    Apply
                  </button>
                ) : null}
              </div>
              {filteredSetOptions.length > 0 ? (
                <div className="markets-fresults">
                  {filteredSetOptions.map((setName) => {
                    const selected = sets.some(
                      (s) => s.toLowerCase() === setName.toLowerCase(),
                    );
                    return (
                      <FilterCheckRow
                        key={setName}
                        selected={selected}
                        role="checkbox"
                        onClick={() => {
                          trackEvent("filter_applied", {
                            filter_type: "set",
                            filter_value: setName,
                          });
                          onSetToggle(setName);
                        }}
                      >
                        {setName}
                      </FilterCheckRow>
                    );
                  })}
                </div>
              ) : (
                <p className="markets-pop__hint">
                  {setFacetOptions.length === 0
                    ? "Load collections to browse sets, or type a name and press Enter."
                    : "No matching sets in the current list."}
                </p>
              )}
              <PopFooter
                clearDisabled={!setActive}
                onClear={() => {
                  onSetsChange?.([]);
                  setSetQuery("");
                  setOpenPop(null);
                }}
                onDone={() => setOpenPop(null)}
              />
            </div>
          </div>
        ) : null}

        <div ref={gradeRef} className="markets-fw markets-fw--chip">
          <DdChip
            label="Grade"
            active={gradeActive}
            open={openPop === "grade"}
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

        <div ref={priceRef} className="markets-fw markets-fw--chip">
          <DdChip
            label="Price"
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
          aria-label="Filters"
          aria-haspopup="dialog"
          aria-expanded={drawerOpen}
          onClick={() => {
            setOpenPop(null);
            setDrawerOpen(true);
          }}
        >
          <FilterIcon size={13} />
          <span className="markets-ddchip__label markets-ddchip__label--desktop">
            More filters
          </span>
          <span className="markets-ddchip__label markets-ddchip__label--mobile">
            Filters
          </span>
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
                <PopCheckItem
                  key={id}
                  selected={selected}
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
                </PopCheckItem>
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
    </div>

      {drawerMounted
        ? createPortal(
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
            <div className="markets-fd-chips markets-fd-chips--stack">
              {filters.map((f) => (
                <FilterCheckRow
                  key={f.id}
                  selected={draftCategories.has(f.id)}
                  onClick={() => toggleDraftCategory(f.id)}
                >
                  {categoryOptionLabel(f)}
                </FilterCheckRow>
              ))}
            </div>
          </div>

          {onSetsChange ? (
            <div className="markets-fd-section">
              <span className="markets-fd-label">Set</span>
              <div className="markets-fsearch markets-fsearch--drawer">
                <input
                  type="search"
                  placeholder="Set name…"
                  value={draftSetQuery}
                  onChange={(e) => setDraftSetQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const trimmed = draftSetQuery.trim();
                      if (trimmed) toggleDraftSet(trimmed);
                      setDraftSetQuery("");
                    }
                  }}
                />
              </div>
              {filteredDraftSetOptions.length > 0 ? (
                <div className="markets-fresults markets-fresults--drawer">
                  {filteredDraftSetOptions.map((setName) => (
                    <FilterCheckRow
                      key={setName}
                      selected={draftSets.some(
                        (s) => s.toLowerCase() === setName.toLowerCase(),
                      )}
                      onClick={() => toggleDraftSet(setName)}
                    >
                      {setName}
                    </FilterCheckRow>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

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
            <div className="markets-fd-chips markets-fd-chips--stack">
              {MARKETS_GRADE_FILTER_OPTIONS.map((grade) => (
                <FilterCheckRow
                  key={grade}
                  selected={draftGrades.has(grade)}
                  onClick={() => toggleDraftGrade(grade)}
                >
                  {grade}
                </FilterCheckRow>
              ))}
            </div>
          </div>

          {onVaultFiltersChange ? (
            <div className="markets-fd-section">
              <span className="markets-fd-label">Vault</span>
              <div className="markets-fd-chips markets-fd-chips--stack">
                {MARKETS_VAULT_FILTER_OPTIONS.map((opt) => (
                  <FilterCheckRow
                    key={opt.id}
                    selected={draftVaults.has(opt.id)}
                    onClick={() => toggleDraftVault(opt.id)}
                  >
                    {opt.chipLabel}
                  </FilterCheckRow>
                ))}
              </div>
            </div>
          ) : null}

          <div className="markets-fd-section">
            <span className="markets-fd-label">Sort by</span>
            <div className="markets-fd-chips markets-fd-chips--stack">
              {MARKETS_SORT_UI_IDS.map((id) => (
                <FilterCheckRow
                  key={id}
                  selected={draftSort === id}
                  role="radio"
                  onClick={() => setDraftSort(id)}
                >
                  {SORT_DRAWER_LABELS[id] ?? SORT_LABELS[id]}
                </FilterCheckRow>
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
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
