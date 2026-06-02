import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import {
  formatCollectionHeroCardTitle,
  toCardDisplayUppercase,
} from "@/lib/marketplace/collectionFullDetailsTitle";
import { listingDisplayTitleFromComp } from "@/lib/marketplace/collectionListingUtils";
import { bucketCardNameForDisplay } from "@/lib/marketplace/bucketKey";

/** Strip trailing `PSA 10` / `PSA GEM MT 10` suffixes from legacy mint `metadata.name` values. */
export function stripListingTitlePsaGradeSuffix(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";

  let s = trimmed;
  s = s.replace(/\s+PSA\s+GEM\s*MT\s*\d+(?:\.\d+)?\s*$/i, "").trim();
  s = s.replace(/\s+PSA\s+MINT\s*\d+(?:\.\d+)?\s*$/i, "").trim();
  s = s.replace(/\s+PSA\s*NM\s*[- ]?\s*MT\s*\d+\s*$/i, "").trim();
  s = s.replace(/\s+PSA\s*\d+(?:\.\d+)?\s*$/i, "").trim();

  return s.length > 0 ? s : trimmed;
}

/**
 * Card name for collection hero / markets grid — prefer PSA slab Subject (what is printed on the label).
 */
export function resolveCollectionSlabCardTitle(
  comp: CollectionComponents,
  fallback?: { displayLabel?: string | null; collectionKey?: string },
): string {
  const psaSubject =
    typeof comp.psaSubject === "string" ? comp.psaSubject.trim() : "";
  if (psaSubject.length > 0) return toCardDisplayUppercase(psaSubject);

  const listingTitle = stripListingTitlePsaGradeSuffix(listingDisplayTitleFromComp(comp));
  if (listingTitle.length > 0) return toCardDisplayUppercase(listingTitle);

  const bucketName = bucketCardNameForDisplay(comp).trim();
  if (bucketName.length > 0) {
    return toCardDisplayUppercase(formatCollectionHeroCardTitle(comp));
  }

  const dl =
    typeof fallback?.displayLabel === "string" ? fallback.displayLabel.trim() : "";
  if (dl.length > 0) return toCardDisplayUppercase(dl);

  const key = fallback?.collectionKey ?? "";
  if (key.length > 0) {
    return toCardDisplayUppercase(key.slice(0, 18) + (key.length > 18 ? "…" : ""));
  }

  return toCardDisplayUppercase("Collection");
}

/** Set line from PSA Brand + Year when the slab mirror is available. */
export function resolveCollectionSlabSetLine(comp: CollectionComponents): string | null {
  const brand = typeof comp.psaBrand === "string" ? comp.psaBrand.trim() : "";
  if (!brand) return null;

  const yearRaw = comp.psaYear;
  let year: string | null = null;
  if (typeof yearRaw === "number" && Number.isFinite(yearRaw)) {
    const y = Math.trunc(yearRaw);
    if (y >= 1880 && y <= 2100) year = String(y);
  } else if (typeof yearRaw === "string") {
    const m = /(\d{4})/.exec(yearRaw.trim());
    if (m) {
      const y = Number(m[1]);
      if (y >= 1880 && y <= 2100) year = String(y);
    }
  }

  const line = year && !/^\s*\d{4}\b/.test(brand) ? `${year} ${brand}` : brand;
  return toCardDisplayUppercase(line);
}
