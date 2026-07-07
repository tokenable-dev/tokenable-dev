"use client";

import { useMemo, useState } from "react";

export type PortfolioSortDir = "asc" | "desc";

export function usePortfolioTableSort<T extends string>(defaultKey: T) {
  const [sortKey, setSortKey] = useState<T>(defaultKey);
  const [sortDir, setSortDir] = useState<PortfolioSortDir>("asc");

  function toggleSort(key: T) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
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
