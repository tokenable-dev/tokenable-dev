import type { CollectionDetailCard } from "@/lib/marketplace/collectionDetailTypes";
import type { CollectionMarketPreview } from "@/lib/core";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import {
  bucketCardSetForDisplay,
  bucketGradingCompanyForDisplay,
} from "@/lib/marketplace/bucketKey";
import {
  displayVariantIfNotSetDuplicate,
  extractCatalogSetCodeFromDisplay,
  extractLeadingTcgSeriesFromSetDisplay,
  formatCardDisplayLanguageLong,
  formatCardDisplayLanguageShort,
  formatCardDisplaySetLabel,
  formatDetailExpansionSetName,
} from "@/lib/marketplace/cardDisplayName";
import { resolveCollectionDisplayLanguage } from "@/lib/marketplace/collectionEditionLanguage";
import { listingDisplayTitleFromComp } from "@/lib/marketplace/collectionListingUtils";
import { labelMentionsPokemon } from "@/lib/market";
import { resolveCollectionComponentVariant } from "@/lib/marketplace/resolveCardVariantLabel";
import {
  formatDetailsCardNumber,
  leadingYearFromSetLine,
  splitTcgCollectorNumber,
  toCardDisplayCase,
  yearFromComponents,
} from "@/lib/marketplace/collectionFullDetailsTitle";
import { resolveCollectionSetFacetLabel } from "@/lib/markets/marketsFilters";

const SEALED_BOX_LANGUAGE_WORD =
  /^(japanese|english|korean|chinese|jp|ja|en|eng|kr|ko|cn|zh)$/i;

function sealedBoxTokens(
  consoleName: string | null | undefined,
  opts?: { keepFranchise?: boolean },
): string[] {
  return (consoleName ?? "")
    .replace(/\s*&\s*/g, " & ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) =>
      opts?.keepFranchise ? true : !/^pok[eé]mon$/i.test(token),
    )
    .filter((token) => !SEALED_BOX_LANGUAGE_WORD.test(token));
}

/** PriceCharting set line without franchise or language. `Scarlet & Violet` stays intact. */
export function sealedBoxCatalogSet(consoleName: string | null | undefined): string {
  return sealedBoxTokens(consoleName)
    .join(" ")
    .replace(/ & /g, " and ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Breadcrumb trail set: keep franchise (Pokemon …), drop embedded language words
 * so `(JP)` / `(KR)` can be appended separately.
 */
export function sealedBoxBreadcrumbSet(
  consoleName: string | null | undefined,
): string {
  return sealedBoxTokens(consoleName, { keepFranchise: true })
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Details rows for a PriceCharting sealed-box collection. Omits fields we do not have. */
export function buildSealedBoxDetailCards(
  comp: CollectionComponents,
  extras?: { vaultLabel?: string | null },
): CollectionDetailCard[] {
  const rows: CollectionDetailCard[] = [];
  const push = (id: string, label: string, value: string | null | undefined) => {
    const text = value?.trim();
    if (!text) return;
    rows.push({ id, label, value: text });
  };

  push("product", "Product", comp.productName);
  push("category", "Category", comp.genre);
  push("set", "Set", sealedBoxCatalogSet(comp.consoleName));

  const year =
    yearFromComponents(comp) ??
    (/^(\d{4})/.exec(comp.releaseDate?.trim() ?? "")
      ? Number(comp.releaseDate!.trim().slice(0, 4))
      : null);
  if (year != null && year >= 1880 && year <= 2100) {
    push("year", "Year", String(year));
  }

  const language = formatCardDisplayLanguageLong(
    resolveCollectionDisplayLanguage({
      comp,
      corpusLines: [comp.consoleName, comp.productName, comp.genre],
    }),
  );
  push("language", "Language", language);

  if (
    comp.salesVolume != null &&
    Number.isFinite(comp.salesVolume) &&
    comp.salesVolume > 0
  ) {
    push("sales-volume", "Sales 1Yr", comp.salesVolume.toLocaleString("en-US"));
  }

  const productId = comp.pricechartingProductId?.trim();
  if (productId) push("pricecharting-id", "PriceCharting ID", `#${productId}`);

  push("upc", "UPC", comp.upc);
  push("vault", "Vault", extras?.vaultLabel);

  return rows;
}

export function buildCollectionMarketDetailCards(params: {
  key: string;
  hasCollection: boolean;
  marketPreview: CollectionMarketPreview | null;
  comp: CollectionComponents;
  headlineCardNumberToken: string | null | undefined;
  headlineSetLine: string | null;
  collectionCategoryBadge: string | null | undefined;
  /**
   * Same language token as breadcrumb (`JP` / `EN` / `English`).
   * Details KV renders the long form (`English`). Unknown → omit, unless
   * Latin Pokémon catalog copy can default to English.
   */
  languageLabel?: string | null;
}): CollectionDetailCard[] {
  const {
    key,
    hasCollection,
    marketPreview,
    comp,
    headlineCardNumberToken,
    headlineSetLine,
    collectionCategoryBadge,
    languageLabel,
  } = params;

  if (!key.trim() || !hasCollection) return [];
  const ch = marketPreview?.card ?? null;
  const np = comp.normalizedPokemon ?? null;

  const rows: CollectionDetailCard[] = [];

  const cardNumCandidates = [
    np?.cardNumber?.trim() || "",
    headlineCardNumberToken?.trim() || "",
    typeof comp.cardNumber === "string" && comp.cardNumber.trim()
      ? comp.cardNumber.trim()
      : "",
  ].filter(Boolean);
  const cardNumRaw =
    cardNumCandidates.find((s) => s.includes("/")) ||
    cardNumCandidates[0] ||
    "";
  const splitNum = splitTcgCollectorNumber(cardNumRaw);

  /*
   * Details Set = expansion only (one source). Prefer normalized / Cardhedger
   * setName, else PSA/set line. Strip year + franchise / set-code / language.
   * `filterValue` is the same string Markets set chips use (`set=`).
   */
  const setLineRaw =
    headlineSetLine?.trim() || bucketCardSetForDisplay(comp).trim();
  const setSourceRaw =
    np?.setName?.trim() || ch?.setName?.trim() || setLineRaw;
  const setFilterValue = resolveCollectionSetFacetLabel(comp);

  const listingLine = listingDisplayTitleFromComp(comp);
  let lang = languageLabel?.trim() || "";
  if (!lang) {
    const raw = resolveCollectionDisplayLanguage({
      comp,
      marketPreview,
      corpusLines: [
        listingLine,
        headlineSetLine,
        ch?.setName,
        ch?.name,
        bucketCardSetForDisplay(comp),
      ],
      includeDefaultEnglish: labelMentionsPokemon(collectionCategoryBadge),
    });
    if (raw) lang = raw.trim();
  }
  const langLong = formatCardDisplayLanguageLong(lang) || lang;
  const langShort = formatCardDisplayLanguageShort(lang) ?? lang;

  const setDisplay = formatDetailExpansionSetName({
    setName: setSourceRaw,
    setLine: setLineRaw,
    categoryLabel: collectionCategoryBadge,
    language: langShort,
  });

  const series =
    np?.series?.trim() ||
    extractLeadingTcgSeriesFromSetDisplay(setLineRaw) ||
    extractLeadingTcgSeriesFromSetDisplay(setSourceRaw) ||
    "";

  const variantStr = displayVariantIfNotSetDuplicate(
    resolveCollectionComponentVariant(comp, marketPreview?.card?.variant),
    setDisplay,
    {
      psaBrand: comp.psaBrand ?? bucketCardSetForDisplay(comp),
      language: resolveCollectionDisplayLanguage({
        comp,
        marketPreview,
        corpusLines: [headlineSetLine, ch?.setName, bucketCardSetForDisplay(comp)],
      }),
    },
  );
  const cat = collectionCategoryBadge?.trim();
  if (cat) {
    rows.push({
      id: "category",
      label: "Category",
      value: cat,
    });
  }

  rows.push({
    id: "series",
    label: "Series",
    value: series || "-",
  });

  if (setDisplay) {
    rows.push({
      id: "set",
      label: "Set",
      value: setDisplay,
      ...(setFilterValue
        ? { filterValue: toCardDisplayCase(setFilterValue) }
        : {}),
    });
  }

  const setCode =
    formatCardDisplaySetLabel(np?.setCode) ||
    extractCatalogSetCodeFromDisplay(setSourceRaw) ||
    extractCatalogSetCodeFromDisplay(setLineRaw);
  rows.push({
    id: "set-code",
    label: "Set code",
    value: setCode || "-",
  });

  if (splitNum.number) {
    rows.push({
      id: "card-number",
      label: "Card number",
      value: formatDetailsCardNumber(
        cardNumRaw.includes("/") ? cardNumRaw : splitNum.number,
      ),
    });
  }

  if (variantStr) {
    rows.push({
      id: "variant",
      label: "Variant",
      value: variantStr,
    });
  }

  const yrFromComp = yearFromComponents(comp);
  let yr: number | null = yrFromComp;
  if (yr == null) {
    const setCandidates = [
      listingLine,
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

  if (langLong) {
    rows.push({
      id: "language",
      label: "Language",
      value: langLong,
    });
  }

  return rows.map((row) => ({
    ...row,
    value:
      row.value === "-" || row.value === "—"
        ? row.value
        : row.id === "card-number" ||
            row.id === "set" ||
            row.id === "set-code" ||
            row.id === "language" ||
            row.id === "grade"
          ? row.value
          : toCardDisplayCase(row.value),
  }));
}
