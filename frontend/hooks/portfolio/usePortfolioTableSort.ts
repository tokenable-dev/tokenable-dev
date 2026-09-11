"use client";

import { useMemo, useState } from "react";

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

  function applyMobileSort(value: string) {
    const [key, dir] = value.split(":") as [T, PortfolioSortDir];
    if (!key || (dir !== "asc" && dir !== "desc")) return;
    setSortKey(key);
    setSortDir(dir);
  }

  const mobileSortValue = useMemo(() => `${sortKey}:${sortDir}`, [sortKey, sortDir]);

  return {
    sortKey,
    sortDir,
    toggleSort,
    applyMobileSort,
    mobileSortValue,
  };
}
