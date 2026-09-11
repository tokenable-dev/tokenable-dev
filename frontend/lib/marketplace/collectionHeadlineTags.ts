import {
  bucketCardSetForDisplay,
  bucketGradingCompanyForDisplay,
} from "@/lib/marketplace/bucketKey";
import {
  extractCardNumberFromDisplayText,
  formatHeadlineCardNumber,
  leadingYearFromSetLine,
} from "@/lib/marketplace/collectionFullDetailsTitle";
import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import { listingDisplayTitleFromComp } from "@/lib/marketplace/collectionListingUtils";
import { resolveCollectionComponentVariant } from "@/lib/marketplace/resolveCardVariantLabel";

export type CollectionHeadlineInfoTag = { id: string; text: string; title?: string };

export type HeadlineCardNumberMarketPreview = {
  card?: { cardNumber?: string | null; name?: string | null } | null;
} | null;

/** Normalize chips for duplicate detection (against set/title lines). */
export function normTagDedupeKey(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ").replace(/^#/, "");
}

/** True when this chip repeats the hero set line / year-stripped variant (upstream often mirrors set into “variant”). */
export function tagEchoesSetLine(fragment: string, setLineRaw: string): boolean {
  const f = normTagDedupeKey(fragment);
  if (!f) return true;
  const lineRaw = setLineRaw.trim();
  if (!lineRaw) return false;
  const line = normTagDedupeKey(lineRaw);
  const noYear = normTagDedupeKey(lineRaw.replace(/^\s*\d{4}\s+/, ""));
  if (line && (f === line || f === noYear)) return true;
  const minLong = 12;
  if (noYear.length >= minLong && (f.includes(noYear) || noYear.includes(f))) return true;
  if (line.length >= minLong && (f.includes(line) || line.includes(f))) return true;
  return false;
}

/** Omit variant chip when the meta line already states the same phrase (any collab / set qualifier). */
export function variantAlreadyRepresentedInMetaStrip(
  metaStrip: string,
  variantFull: string,
): boolean {
  const m = normTagDedupeKey(metaStrip);
  const v = normTagDedupeKey(variantFull);
  if (!m || !v || v.length < 5) return false;
  return m.includes(v);
}

function componentCardNumberRaw(comp: CollectionComponents): string {
  const v = comp.cardNumber as unknown;
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return "";
}

/** Display card number from preview, components, or listing title (shared by hero title + chips). */
export function resolveHeadlineFormattedCardNumber(
  marketPreview: HeadlineCardNumberMarketPreview,
  comp: CollectionComponents,
  extraHaystack?: string | null,
): string | null {
  const direct = [
    marketPreview?.card?.cardNumber,
    componentCardNumberRaw(comp),
  ];
  for (const raw of direct) {
    const formatted = formatHeadlineCardNumber(raw);
    if (formatted) return formatted;
  }
  const haystacks = [
    extraHaystack ?? "",
    listingDisplayTitleFromComp(comp),
    typeof comp.psaSubject === "string" ? comp.psaSubject : "",
    typeof comp.cardNameDisplay === "string" ? comp.cardNameDisplay : "",
    typeof comp.cardName === "string" ? comp.cardName : "",
    typeof comp.variant === "string" ? comp.variant : "",
    typeof comp.psaVariety === "string" ? comp.psaVariety : "",
    marketPreview?.card?.name ?? "",
  ];
  for (const hay of haystacks) {
    const extracted = extractCardNumberFromDisplayText(hay);
    if (extracted) return extracted;
  }
  return null;
}

export function headlineContainsFormattedCardNumber(
  headline: string,
  numTokFmt: string | null,
): boolean {
  const h = headline.trim();
  const num = (numTokFmt ?? "").trim();
  if (!num) return false;
  if (!h) return false;
  const hay = normTagDedupeKey(h);
  const numNorm = normTagDedupeKey(num);
  return numNorm.length > 0 && hay.includes(numNorm);
}

/** Append formatted card # to the hero title when it is not already present in the base string. */
export function mergeHeadlineCardNumberIntoTitle(
  headlineBase: string,
  numTokFmt: string | null,
): string {
  const base = headlineBase.trim();
  const num = (numTokFmt ?? "").trim();
  if (!num) return base;
  if (headlineContainsFormattedCardNumber(base, num)) return base;
  if (!base) return num;
  return `${base} ${num}`;
}

export type BuildCollectionHeadlineInfoTagsInput = {
  headlineSetLine: string | null;
  comp: CollectionComponents;
  marketPreview: {
    card?: {
      cardNumber?: string | null;
      variant?: string | null;
      setType?: string | null;
      market?: string | null;
    } | null;
  } | null;
  /** Visible hero title (includes formatted card number when applicable). */
  collectionHeadlineTitle: string;
  collectionHeadlineMetaStrip: string | null;
  pokeTierLabel: string | null;
};

/**
 * Identifier chips under the headline — same de-dupe rules for every collection bucket.
 */
export function buildCollectionHeadlineInfoTags(
  input: BuildCollectionHeadlineInfoTagsInput,
): CollectionHeadlineInfoTag[] | null {
  const {
    headlineSetLine,
    comp,
    marketPreview,
    collectionHeadlineTitle,
    collectionHeadlineMetaStrip,
    pokeTierLabel,
  } = input;

  const setLine = headlineSetLine?.trim() ?? "";
  const setFromComp = bucketCardSetForDisplay(comp).trim();
  const anchorLines = [setLine, setFromComp].filter((s) => s.length > 0);
  const titleKey = normTagDedupeKey(collectionHeadlineTitle);
  const setYear = setLine ? leadingYearFromSetLine(setLine) : null;
  const metaStripForDedupe = collectionHeadlineMetaStrip?.trim() ?? "";

  const seen = new Set<string>();
  const tags: CollectionHeadlineInfoTag[] = [];

  const pushUnique = (id: string, display: string, title?: string) => {
    const d = display.trim();
    if (!d) return;
    if (anchorLines.some((a) => tagEchoesSetLine(d, a))) return;
    const k = normTagDedupeKey(d);
    if (!k || seen.has(k)) return;
    if (titleKey.length >= 3 && k === titleKey) return;
    seen.add(k);
    tags.push({
      id,
      text: d.length > 44 ? `${d.slice(0, 41)}…` : d,
      title: title ?? (d.length > 44 ? d : undefined),
    });
  };

  const numTokFmt = resolveHeadlineFormattedCardNumber(marketPreview, comp);
  if (numTokFmt && !headlineContainsFormattedCardNumber(collectionHeadlineTitle, numTokFmt)) {
    pushUnique("cardno", numTokFmt, "Card number");
  }

  const varFull =
    resolveCollectionComponentVariant(comp, marketPreview?.card?.variant) ?? "";
  const variantKey = normTagDedupeKey(varFull);
  if (
    varFull &&
    !variantAlreadyRepresentedInMetaStrip(metaStripForDedupe, varFull) &&
    !(variantKey.length >= 5 && titleKey.includes(variantKey))
  ) {
    pushUnique("variant", varFull, varFull);
  }

  const grader = bucketGradingCompanyForDisplay(comp).trim();
  const gradeRaw = comp["gradeScore"];
  const gradeStr = typeof gradeRaw === "string" ? gradeRaw.trim() : "";
  const tier = pokeTierLabel?.trim();
  if (!tier) {
    if (grader && gradeStr) pushUnique("gradecombo", `${grader} ${gradeStr}`, "Grade");
    else if (gradeStr) pushUnique("grade", gradeStr, "Grade");
    else if (grader) pushUnique("grader", grader, "Grader");
  }

  const setType = marketPreview?.card?.setType?.trim();
  if (setType) pushUnique("settype", setType, "Set type");

  const rarityRaw = comp.rarity;
  const rarity = typeof rarityRaw === "string" ? rarityRaw.trim() : "";
  if (rarity) pushUnique("rarity", rarity, "Rarity");

  const yearRaw = comp.year ?? null;
  const yearNum =
    typeof yearRaw === "number" && Number.isFinite(yearRaw)
      ? yearRaw
      : typeof yearRaw === "string" && /^\d{4}$/.test(yearRaw.trim())
        ? Number(yearRaw.trim())
        : null;
  if (yearNum != null && yearNum >= 1880 && yearNum <= 2100 && setYear !== yearNum) {
    pushUnique("year", String(yearNum), "Release year");
  }

  const mkt = marketPreview?.card?.market?.trim();
  if (
    mkt &&
    !/^(US|USA|EN|ENG|ENGLISH)$/i.test(mkt) &&
    !tagEchoesSetLine(mkt, setLine || setFromComp || "")
  ) {
    pushUnique("market", mkt, "Market / region");
  }

  return tags.length > 0 ? tags : null;
}
