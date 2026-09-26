"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

/**
 * Portfolio.html `.pf-tbar__search` — icon by default; expands in-place.
 * On mobile (CSS) the open state overlays the full toolbar row.
 */
export function PortfolioToolbarSearch({
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  "aria-label": string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(() => value.trim().length > 0);

  useEffect(() => {
    if (value.trim().length > 0) setOpen(true);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.focus(), 10);
    return () => window.clearTimeout(id);
  }, [open]);

  function closeSearch() {
    onChange("");
    setOpen(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Escape") return;
    e.preventDefault();
    if (value.trim()) {
      onChange("");
      return;
    }
    setOpen(false);
    inputRef.current?.blur();
  }

  return (
    <div
      className={`pf-tbar__search${open ? " open" : ""}`}
      onClick={() => {
        if (!open) setOpen(true);
      }}
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        aria-hidden
      >
        <circle cx="11" cy="11" r="7" />
        <line x1="16.5" y1="16.5" x2="21" y2="21" />
      </svg>
      <input
        ref={inputRef}
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (!value.trim()) setOpen(false);
        }}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="pf-search-x"
        aria-label="Close search"
        tabIndex={open ? 0 : -1}
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          closeSearch();
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          aria-hidden
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}
