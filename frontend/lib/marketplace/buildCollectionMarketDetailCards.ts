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

/** Generic PriceCharting product-type labels — not a set name. */
const SEALED_BOX_PRODUCT_TYPE =
  /^(booster\s*box|elite\s*trainer\s*box|etb|tin|collection\s*box|blister|bundle|premium\s*collection|ultra\s*premium(\s*collection)?|display\s*box|case|booster\s*pack|theme\s*deck)$/i;

const SEALED_BOX_PRODUCT_TYPE_SUFFIX =
  /\s*(?:[·•]\s*)?(booster\s*box|elite\s*trainer\s*box|etb|tin|collection\s*box|blister|bundle|premium\s*collection|ultra\s*premium(?:\s*collection)?|display\s*box|case|booster\s*pack|theme\s*deck)\s*$/i;

function titleCaseProductType(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (/^etb$/i.test(t)) return "ETB";
  return t
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function stripSealedBoxProductTypeSuffix(value: string): string {
  return value.replace(SEALED_BOX_PRODUCT_TYPE_SUFFIX, "").replace(/\s+/g, " ").trim();
}

/**
 * Product-type label for sealed-box meta (`2023 · JP · Booster Box`).
 * Prefer an explicit PriceCharting type field; never invent pack counts.
 */
export function sealedBoxProductTypeLabel(comp: {
  productName?: string | null;
  consoleName?: string | null;
}): string {
  const product = (comp.productName ?? "").replace(/\s+/g, " ").trim();
  const console = (comp.consoleName ?? "").replace(/\s+/g, " ").trim();
  if (product && SEALED_BOX_PRODUCT_TYPE.test(product)) {
    return titleCaseProductType(product);
  }
  if (console && SEALED_BOX_PRODUCT_TYPE.test(console)) {
    return titleCaseProductType(console);
  }
  for (const raw of [product, console]) {
    const m = SEALED_BOX_PRODUCT_TYPE_SUFFIX.exec(raw);
    if (m?.[1]) return titleCaseProductType(m[1]);
  }
  return "Booster Box";
}

/**
 * Hero eyebrow — e.g. `POKÉMON · SEALED`.
 * PriceCharting `genre` is often bare `Sealed Product` — never use that as the
 * left token (avoids `SEALED PRODUCT · SEALED`). Prefer franchise from corpus.
 */
export function sealedBoxHeroEyebrow(comp: {
  genre?: string | null;
  consoleName?: string | null;
  productName?: string | null;
}): string {
  const corpus = [comp.genre, comp.consoleName, comp.productName]
    .map((s) => (s ?? "").trim())
    .filter(Boolean)
    .join(" ");
  if (/pok[eé]mon/i.test(corpus)) return "POKÉMON · SEALED";
  if (/one\s*piece/i.test(corpus)) return "ONE PIECE · SEALED";
  const genre = (comp.genre ?? "").trim();
  if (genre && !/sealed/i.test(genre)) {
    return `${genre.toUpperCase()} · SEALED`;
  }
  return "SEALED";
}

/**
 * Collection / markets hero title for a sealed box — set line only
 * (`Scarlet and Violet 151`), never a bare / trailing `Booster Box`.
 * Franchise + language stay out of the title (they live in eyebrow / meta).
 */
export function sealedBoxHeroSetTitle(comp: {
  productName?: string | null;
  consoleName?: string | null;
}): string {
  const product = (comp.productName ?? "").replace(/\s+/g, " ").trim();
  const console = (comp.consoleName ?? "").replace(/\s+/g, " ").trim();
  const productIsType = !product || SEALED_BOX_PRODUCT_TYPE.test(product);
  const consoleIsType = !console || SEALED_BOX_PRODUCT_TYPE.test(console);
  let raw = "";
  if (console && !consoleIsType) raw = console;
  else if (product && !productIsType) raw = product;
  else raw = console || product || "";
  const cleaned =
    sealedBoxCatalogSet(raw) || stripSealedBoxProductTypeSuffix(raw);
  const stripped = stripSealedBoxProductTypeSuffix(cleaned);
  const out = (stripped || cleaned || "Sealed box").replace(/\s*&\s*/g, " and ");
  return out.replace(/\s+/g, " ").trim() || "Sealed box";
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
