"use client";

import { useState } from "react";

export type PortfolioSortDir = "asc" | "desc";

export function usePortfolioTableSort<T extends string>(
  defaultKey: T,
  defaultDir: PortfolioSortDir = "asc",
  opts?: { dirWhenSelecting?: (key: T) => PortfolioSortDir },
) {
  const [sortKey, setSortKey] = useState<T>(defaultKey);
  const [sortDir, setSortDir] = useState<PortfolioSortDir>(defaultDir);

  function toggleSort(key: T) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir(opts?.dirWhenSelecting?.(key) ?? "asc");
  }

  function setSort(key: T, dir?: PortfolioSortDir) {
    setSortKey(key);
    setSortDir(dir ?? opts?.dirWhenSelecting?.(key) ?? "asc");
  }

  return {
    sortKey,
    sortDir,
    toggleSort,
    setSort,
  };
}
