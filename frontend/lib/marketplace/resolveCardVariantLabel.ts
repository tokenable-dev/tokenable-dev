import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import { shouldHideDuplicateVariant } from "@/lib/marketplace/cardDisplayName";

/** Parallel / edition label — drives bucket split and market pricing. */
export function resolveCardVariantLabel(sources: {
  variant?: string | null;
  psaVariety?: string | null;
  marketVariant?: string | null;
  mintCardVariant?: string | null;
}): string | null {
  for (const raw of [
    sources.variant,
    sources.psaVariety,
    sources.marketVariant,
    sources.mintCardVariant,
  ]) {
    const t = typeof raw === "string" ? raw.trim() : "";
    if (t) return t;
  }
  return null;
}

export function resolveCollectionComponentVariant(
  comp: CollectionComponents,
  marketVariant?: string | null,
): string | null {
  const set =
    (typeof comp.cardSetDisplay === "string" && comp.cardSetDisplay.trim()) ||
    (typeof comp.cardSet === "string" && comp.cardSet.trim()) ||
    (typeof comp.psaBrand === "string" && comp.psaBrand.trim()) ||
    null;
  const brand =
    typeof comp.psaBrand === "string" && comp.psaBrand.trim()
      ? comp.psaBrand.trim()
      : null;
  for (const raw of [comp.variant, comp.psaVariety, marketVariant]) {
    const t = typeof raw === "string" ? raw.trim() : "";
    if (!t) continue;
    if (
      shouldHideDuplicateVariant({
        variant: t,
        displayedSetName: set,
        psaBrand: brand,
      })
    ) {
      continue;
    }
    return t;
  }
  return null;
}

/** `properties.graded` mirror on RWA metadata. */
export function resolveRwaMetadataVariant(
  graded: Record<string, unknown> | undefined,
): string | null {
  if (!graded || typeof graded !== "object") return null;
  const psa =
    graded.psa && typeof graded.psa === "object"
      ? (graded.psa as Record<string, unknown>)
      : undefined;
  const card =
    graded.card && typeof graded.card === "object"
      ? (graded.card as Record<string, unknown>)
      : undefined;
  return resolveCardVariantLabel({
    variant: typeof card?.variant === "string" ? card.variant : null,
    psaVariety:
      typeof psa?.variety === "string"
        ? psa.variety
        : typeof psa?.Variety === "string"
          ? psa.Variety
          : null,
    mintCardVariant: typeof card?.variant === "string" ? card.variant : null,
  });
}
