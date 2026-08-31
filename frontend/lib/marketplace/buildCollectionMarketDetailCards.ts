import type { CollectionDetailCard } from "@/lib/marketplace/collectionDetailTypes";
import type { CollectionMarketPreview } from "@/lib/core";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import {
  bucketCardSetForDisplay,
  bucketGradingCompanyForDisplay,
} from "@/lib/marketplace/bucketKey";
import {
  displayVariantIfNotSetDuplicate,
  formatCardDisplaySetLabel,
  preferCatalogExpansionInBrandDisplay,
} from "@/lib/marketplace/cardDisplayName";
import { resolveCollectionDisplayLanguage } from "@/lib/marketplace/collectionEditionLanguage";
import { listingDisplayTitleFromComp } from "@/lib/marketplace/collectionListingUtils";
import { resolveCollectionComponentVariant } from "@/lib/marketplace/resolveCardVariantLabel";
import {
  formatHeadlineCardNumber,
  leadingYearFromSetLine,
  resolveCollectionSetFacetLabelFromLine,
  toCardDisplayCase,
  yearFromComponents,
} from "@/lib/marketplace/collectionFullDetailsTitle";

export function buildCollectionMarketDetailCards(params: {
  key: string;
  hasCollection: boolean;
  marketPreview: CollectionMarketPreview | null;
  comp: CollectionComponents;
  headlineCardNumberToken: string | null | undefined;
  headlineSetLine: string | null;
  collectionCategoryBadge: string | null | undefined;
}): CollectionDetailCard[] {
  const {
    key,
    hasCollection,
    marketPreview,
    comp,
    headlineCardNumberToken,
    headlineSetLine,
    collectionCategoryBadge,
  } = params;

  if (!key.trim() || !hasCollection) return [];
  const ch = marketPreview?.card ?? null;

  const rows: CollectionDetailCard[] = [];

  const cardNumRaw =
    headlineCardNumberToken?.trim() ||
    (typeof comp.cardNumber === "string" && comp.cardNumber.trim()
      ? comp.cardNumber.trim()
      : "");
  if (cardNumRaw) {
    rows.push({
      id: "card-number",
      label: "Card number",
      value:
        formatHeadlineCardNumber(
          headlineCardNumberToken?.trim() || cardNumRaw,
        ) ?? cardNumRaw,
    });
  }

  const setLineRaw =
    headlineSetLine?.trim() || bucketCardSetForDisplay(comp).trim();
  const setName = resolveCollectionSetFacetLabelFromLine(setLineRaw);
  const setDisplay = setName
    ? formatCardDisplaySetLabel(
        preferCatalogExpansionInBrandDisplay(
          toCardDisplayCase(setName),
          ch?.setName?.trim() ?? null,
        ),
      )
    : "";

  const variantStr = displayVariantIfNotSetDuplicate(
    resolveCollectionComponentVariant(comp, marketPreview?.card?.variant),
    setDisplay,
  );
  if (variantStr) {
    rows.push({
      id: "variant",
      label: "Variant",
      value: variantStr,
    });
  }

  const cat = collectionCategoryBadge?.trim();
  if (cat) {
    rows.push({
      id: "category",
      label: "Category",
      value: cat,
    });
  }

  const gradeStr = typeof comp.gradeScore === "string" ? comp.gradeScore.trim() : "";
  if (gradeStr) {
    rows.push({
      id: "grade",
      label: "Grade",
      value: gradeStr,
    });
  }

  const grader = bucketGradingCompanyForDisplay(comp).trim();
  if (grader) {
    rows.push({
      id: "grader",
      label: "Grader",
      value: grader,
    });
  }

  const cert = typeof comp.psaCertNumber === "string" ? comp.psaCertNumber.trim() : "";
  if (cert) {
    rows.push({
      id: "cert",
      label: "Cert #",
      value: cert,
    });
  }

  if (setDisplay) {
    rows.push({
      id: "set",
      label: "Set",
      value: setDisplay,
    });
  }

  const yrFromComp = yearFromComponents(comp);
  let yr: number | null = yrFromComp;
  if (yr == null) {
    const listingLineEarly = listingDisplayTitleFromComp(comp);
    const setCandidates = [
      listingLineEarly,
      headlineSetLine?.trim(),
      ch?.setName?.trim(),
      bucketCardSetForDisplay(comp).trim(),
    ];
    for (const s of setCandidates) {
      if (!s) continue;
      const y = leadingYearFromSetLine(s);
      if (y != null) {
        yr = y;
        break;
      }
    }
  }
  if (yr != null) {
    rows.push({
      id: "year",
      label: "Year",
      value: String(yr),
    });
  }

  const listingLine = listingDisplayTitleFromComp(comp);
  const lang = resolveCollectionDisplayLanguage({
    comp,
    marketPreview,
    corpusLines: [
      listingLine,
      headlineSetLine,
      ch?.setName,
      ch?.name,
      bucketCardSetForDisplay(comp),
    ],
    includeDefaultEnglish: true,
  });
  if (lang) {
    rows.push({
      id: "language",
      label: "Language",
      value: lang,
    });
  }

  return rows.map((row) => ({
    ...row,
    value:
      row.id === "cert" || row.id === "card-number"
        ? row.value
        : toCardDisplayCase(row.value),
  }));
}
