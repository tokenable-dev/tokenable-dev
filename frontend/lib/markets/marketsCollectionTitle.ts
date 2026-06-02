import type { MarketplaceCollectionSummary } from "@/lib/core";
import { toCardDisplayUppercase } from "@/lib/marketplace/collectionFullDetailsTitle";
import {
  bucketCardNameForDisplay,
  bucketCardSetForDisplay,
} from "@/lib/marketplace/bucketKey";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";

export function buildMarketsCollectionTitle(params: {
  collection: MarketplaceCollectionSummary;
  comp: CollectionComponents;
}): string {
  const { collection, comp } = params;

  const extractYear = (s: string): number | null => {
    const m = /\b(18\d{2}|19\d{2}|20\d{2}|2100)\b/.exec(s);
    if (!m) return null;
    const y = Number(m[1]);
    return Number.isFinite(y) && y >= 1880 && y <= 2100 ? y : null;
  };

  const stripYearToken = (s: string, y: number | null): string => {
    const t = s.trim();
    if (!t || y == null) return t;
    return t.replace(new RegExp(`\\b${String(y)}\\b`), "").replace(/\s+/g, " ").trim();
  };

  let setName = bucketCardSetForDisplay(comp).trim();
  let cardName = bucketCardNameForDisplay(comp).trim();

  const dl =
    typeof collection.displayLabel === "string" ? collection.displayLabel.trim() : "";

  const yearFromCompRaw = comp.year;
  const yearFromComp =
    typeof yearFromCompRaw === "number" && Number.isFinite(yearFromCompRaw)
      ? yearFromCompRaw
      : typeof yearFromCompRaw === "string"
        ? extractYear(yearFromCompRaw)
        : null;

  if (!setName && dl) {
    const m = /^(.*?)\b(18\d{2}|19\d{2}|20\d{2}|2100)\b\s+(.+)$/.exec(dl);
    if (m) {
      const left = (m[1] ?? "").trim();
      const year = (m[2] ?? "").trim();
      const right = (m[3] ?? "").trim();
      if (!cardName && left) cardName = left;
      if (right) setName = year ? `${year} ${right}` : right;
    }
  }

  if (!setName && dl) {
    const parts = dl.split(/[-–·|]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 2) {
      const [left, right] = parts;
      if (!cardName && left) cardName = left;
      if (right) setName = right;
    }
  }

  const year =
    yearFromComp ??
    extractYear(setName) ??
    extractYear(dl) ??
    null;

  const setNoYear = stripYearToken(setName, year);
  const titleParts = [
    year != null ? String(year) : "",
    setNoYear,
    cardName,
  ].filter((s) => s && s.trim().length > 0);
  const out = titleParts.length > 0 ? titleParts.join(" ") : dl;
  return toCardDisplayUppercase(out);
}
