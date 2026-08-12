/**
 * Markets bar typeahead — mirrors `markets-nav.js` typeaheadHTML groups:
 * Categories / Sets / Cards with match counts from the loaded collection index.
 */
import type {
  CollectionListMarketSnapshot,
  MarketplaceCollectionSummary,
} from "@/lib/core";
import {
  collectionMatchesCategoryFilter,
  MARKETS_CATEGORY_FILTERS,
  type CollectionCategoryFilterId,
} from "@/lib/market";
import { parseCollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import {
  resolveCollectionSlabCardTitle,
  resolveCollectionSlabSetLine,
} from "@/lib/marketplace/slabDisplayTitle";
import { bucketCardSetForDisplay } from "@/lib/marketplace/bucketKey";
import { buildMarketsCollectionTitle } from "@/lib/markets/marketsCollectionTitle";
import { collectionKeyLower } from "@/lib/markets/marketsCollectionSort";

export type MarketsTypeaheadRow =
  | {
      kind: "category";
      id: CollectionCategoryFilterId;
      label: string;
      count: number;
    }
  | { kind: "set"; label: string; count: number }
  | {
      kind: "card";
      label: string;
      collectionKey: string;
      count: number | null;
    };

export type MarketsTypeaheadGroup = {
  key: "categories" | "sets" | "cards";
  label: string;
  total: number;
  rows: MarketsTypeaheadRow[];
};

function collectionSetLabel(c: MarketplaceCollectionSummary): string {
  const comp = parseCollectionComponents(c.components);
  const setLine =
    resolveCollectionSlabSetLine(comp) ?? bucketCardSetForDisplay(comp).trim();
  if (setLine) return setLine;
  const display = typeof c.displayLabel === "string" ? c.displayLabel.trim() : "";
  return display;
}

function collectionCardLabel(c: MarketplaceCollectionSummary): string {
  const comp = parseCollectionComponents(c.components);
  return (
    buildMarketsCollectionTitle({ collection: c, comp }) ||
    resolveCollectionSlabCardTitle(comp, {
      displayLabel: c.displayLabel,
      collectionKey: c.collectionKey,
    })
  );
}

function collectionMatchesText(
  c: MarketplaceCollectionSummary,
  snapshot: CollectionListMarketSnapshot | undefined,
  q: string,
): boolean {
  const ql = q.toLowerCase();
  const comp = parseCollectionComponents(c.components);
  const hay = [
    c.displayLabel,
    c.queryUsed,
    collectionSetLabel(c),
    collectionCardLabel(c),
    comp.cardNameDisplay,
    comp.cardName,
    comp.cardSetDisplay,
    comp.cardSet,
    comp.psaSubject,
    comp.psaBrand,
    snapshot?.categoryLabel,
  ]
    .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    .join(" ")
    .toLowerCase();
  return hay.includes(ql);
}

export function buildMarketsTypeaheadGroups(
  query: string,
  collections: MarketplaceCollectionSummary[],
  snapshotByKey: Map<string, CollectionListMarketSnapshot>,
): MarketsTypeaheadGroup[] {
  const q = query.trim();
  if (!q) return [];
  const ql = q.toLowerCase();
  const groups: MarketsTypeaheadGroup[] = [];

  const catRows: MarketsTypeaheadRow[] = [];
  for (const f of MARKETS_CATEGORY_FILTERS) {
    if (f.id === "all") continue;
    if (!f.label.toLowerCase().includes(ql)) continue;
    let count = 0;
    for (const c of collections) {
      if (
        collectionMatchesCategoryFilter(
          f.id,
          c,
          snapshotByKey.get(collectionKeyLower(c)),
        )
      ) {
        count += 1;
      }
    }
    catRows.push({
      kind: "category",
      id: f.id,
      label: f.label,
      count,
    });
  }
  if (catRows.length) {
    groups.push({
      key: "categories",
      label: "Categories",
      total: catRows.length,
      rows: catRows.slice(0, 4),
    });
  }

  const setCounts = new Map<string, number>();
  for (const c of collections) {
    const set = collectionSetLabel(c);
    if (!set || !set.toLowerCase().includes(ql)) continue;
    setCounts.set(set, (setCounts.get(set) ?? 0) + 1);
  }
  const setRows = [...setCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 6)
    .map(
      ([label, count]): MarketsTypeaheadRow => ({
        kind: "set",
        label,
        count,
      }),
    );
  if (setRows.length) {
    groups.push({
      key: "sets",
      label: "Sets",
      total: setCounts.size,
      rows: setRows,
    });
  }

  const cardSeen = new Set<string>();
  const cardRows: MarketsTypeaheadRow[] = [];
  for (const c of collections) {
    const label = collectionCardLabel(c);
    if (!label || !label.toLowerCase().includes(ql)) continue;
    const key = label.toLowerCase();
    if (cardSeen.has(key)) continue;
    cardSeen.add(key);
    cardRows.push({
      kind: "card",
      label,
      collectionKey: c.collectionKey,
      count: c.activeListingCount > 0 ? c.activeListingCount : null,
    });
    if (cardRows.length >= 6) break;
  }
  if (cardRows.length) {
    groups.push({
      key: "cards",
      label: "Cards",
      total: cardSeen.size,
      rows: cardRows,
    });
  }

  return groups;
}

export function collectionMatchesMarketsSearch(
  c: MarketplaceCollectionSummary,
  snapshot: CollectionListMarketSnapshot | undefined,
  opts: { q?: string; setLabel?: string },
): boolean {
  const setLabel = opts.setLabel?.trim();
  if (setLabel) {
    if (collectionSetLabel(c).toLowerCase() !== setLabel.toLowerCase()) {
      return false;
    }
  }
  const q = opts.q?.trim();
  if (q && !collectionMatchesText(c, snapshot, q)) return false;
  return true;
}

export { collectionSetLabel, collectionCardLabel };
