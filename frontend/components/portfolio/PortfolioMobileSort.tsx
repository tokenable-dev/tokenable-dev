"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/ds/cn";

export type PortfolioMobileSortOption = {
  key: string;
  label: string;
};

export function PortfolioMobileSort({
  options,
  value,
  onChange,
}: {
  options: PortfolioMobileSortOption[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const items = useMemo(
    () =>
      options.flatMap((opt) => [
        { value: `${opt.key}:asc`, label: `${opt.label} ↑` },
        { value: `${opt.key}:desc`, label: `${opt.label} ↓` },
      ]),
    [options],
  );

  const selectedLabel =
    items.find((item) => item.value === value)?.label ?? items[0]?.label ?? "";

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onPointer(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open]);

  return (
    <div className="pf-mobile-sort" ref={rootRef}>
      <span className="pf-mobile-sort__label">Sort by</span>
      <div className="pf-mobile-sort__wrap">
        <button
          type="button"
          className="pf-mobile-sort__trigger"
          aria-label="Sort assets"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {selectedLabel}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
        {open ? (
          <div className="pf-mobile-sort__menu" role="listbox" aria-label="Sort options">
            {items.map((item) => {
              const selected = item.value === value;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={cn(
                    "pf-mobile-sort__option",
                    selected && "pf-mobile-sort__option--sel",
                  )}
                  onClick={() => {
                    onChange(item.value);
                    setOpen(false);
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
