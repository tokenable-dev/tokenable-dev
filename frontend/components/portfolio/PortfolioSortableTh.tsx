"use client";

import type { PortfolioSortDir } from "@/hooks/portfolio/usePortfolioTableSort";

function SortArrow({ dir }: { dir: PortfolioSortDir | null }) {
  if (dir === "asc") {
    return (
      <span className="pf-sort-arrow" aria-hidden>
        <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 6l4-4 4 4H4z" opacity={1} />
          <path d="M4 10l4 4 4-4H4z" opacity={0.25} />
        </svg>
      </span>
    );
  }
  if (dir === "desc") {
    return (
      <span className="pf-sort-arrow" aria-hidden>
        <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor">
          <path d="M4 6l4-4 4 4H4z" opacity={0.25} />
          <path d="M4 10l4 4 4-4H4z" opacity={1} />
        </svg>
      </span>
    );
  }
  return (
    <span className="pf-sort-arrow pf-sort-arrow--idle" aria-hidden>
      <svg width={16} height={16} viewBox="0 0 16 16" fill="currentColor">
        <path d="M4 10l4 4 4-4H4z" />
        <path d="M4 6l4-4 4 4H4z" />
      </svg>
    </span>
  );
}

export function PortfolioSortableTh({
  label,
  sortKey,
  activeKey,
  sortDir,
  align = "left",
  onSort,
}: {
  label: string;
  sortKey: string;
  activeKey: string;
  sortDir: PortfolioSortDir;
  align?: "left" | "right" | "center";
  onSort: (key: string) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <th style={{ textAlign: align }}>
      <button
        type="button"
        className={`pf-th-sort pf-th-sort--${align}`}
        onClick={() => onSort(sortKey)}
      >
        <span>{label}</span>
        <SortArrow dir={active ? sortDir : null} />
      </button>
    </th>
  );
}
