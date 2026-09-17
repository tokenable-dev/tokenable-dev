"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Portfolio.html `.pf-tbar__search` — icon by default, expands on click.
 * Collapses on blur when empty (Escape clears + collapses).
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
        type="search"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        aria-label={ariaLabel}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => {
          if (!value.trim()) setOpen(false);
        }}
        onKeyDown={(e) => {
          if (e.key !== "Escape") return;
          e.preventDefault();
          if (value.trim()) {
            onChange("");
            return;
          }
          setOpen(false);
          inputRef.current?.blur();
        }}
      />
    </div>
  );
}
