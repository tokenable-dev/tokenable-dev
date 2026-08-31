import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";

/** Normalize bucket / Cardhedger raw tokens to a short language label (English UI). */
export function displayEditionLanguage(raw: string | null | undefined): string | null {
  const t = raw?.trim();
  if (!t) return null;
  if (/^(us|usa|north\s*america|english|eng|en)$/i.test(t)) return "English";
  if (/^(jp|japan|japanese|ja)$/i.test(t) || /日本|日本語|にほん/.test(t)) {
    return "Japanese";
  }
  if (/^(kr|korea|korean|ko)$/i.test(t) || /한국|한국어/.test(t)) {
    return "Korean";
  }
  if (/^(cn|china|chinese|zh)$/i.test(t) || /中文|简体|繁体/.test(t)) {
    return "Chinese";
  }
  return t;
}

/**
 * Guess print language from catalog copy only when we see actual JP/KR/CN script
 * or unambiguous CJK keywords — not Latin-only regional words alone.
 */
export function inferLanguageFromCorpus(corpus: string): string | null {
  const c = corpus.trim();
  if (!c) return null;
  if (/日本|日本語|にほん/.test(c)) return "Japanese";
  if (/[\u3040-\u30ff]/.test(c)) return "Japanese";
  if (/한국|한국어/.test(c)) return "Korean";
  if (/[\uac00-\ud7af]/.test(c)) return "Korean";
  if (/中文|简体|繁体|简体中文版|繁體中文/.test(c)) return "Chinese";
  return null;
}

/**
 * Latin-only Pokémon catalog lines often spell region in English ("POKEMON CHINESE 25TH …",
 * "POKEMON JAPANESE SV2A …"). Only fire when the haystack looks like graded/TCG metadata.
 */
export function inferLanguageFromLatinPokemonRegion(corpus: string): string | null {
  const c = corpus.trim();
  if (!c) return null;
  const h = c.toLowerCase().replace(/\s+/g, " ");

  const looksGradedOrTcg =
    /\bpokemon\b/i.test(c) ||
    /\btcgs?\b/i.test(c) ||
    /\bpsa\b/i.test(c) ||
    /\b(black\s*star|holo|promo|booster)\b/i.test(h);

  if (!looksGradedOrTcg) return null;

  if (/\bpokemon\s+chinese\b/i.test(c) || /\btcgs?\s+chinese\b/i.test(c)) return "Chinese";
  if (
    /\bchinese\s+(25th|24th|26th|27th|28th|29th|30th|\d{1,2}(?:st|nd|rd|th))\s+anniversary\b/i.test(
      h,
    ) ||
    /\bchinese\s+(classic|celebration)\s+collection\b/i.test(h) ||
    /\bchinese\s+(scarlet|violet|sun|moon|sword|shield|legends)\b/i.test(h) ||
    /\bchinese\s+(promo|collection|booster\s*box)\b/i.test(h)
  ) {
    return "Chinese";
  }

  if (/\bpokemon\s+korean\b/i.test(c) || /\btcgs?\s+korean\b/i.test(c)) return "Korean";

  const latinNamesNonJpRetail =
    /\bindonesia(?:n)?\b/i.test(c) ||
    /\bsingapore\b/i.test(h) ||
    /\bphilippines?\b/i.test(h) ||
    /\bthailand\b/i.test(h) ||
    /\bvietnam\b/i.test(h) ||
    /\bmalaysia\b/i.test(h);
  if (
    !latinNamesNonJpRetail &&
    (/\bpokemon\s+japanese\b/i.test(c) || /\btcgs?\s+japanese\b/i.test(c))
  ) {
    return "Japanese";
  }

  return null;
}

export function resolveCollectionDisplayLanguage(params: {
  comp: Pick<CollectionComponents, "language">;
  marketPreview?: {
    card?: { market?: string | null; setName?: string | null; name?: string | null } | null;
  } | null;
  corpusLines: (string | null | undefined)[];
  /** Details KV defaults Latin catalog cards to English; hero meta omits that default. */
  includeDefaultEnglish?: boolean;
}): string | null {
  const { comp, marketPreview, corpusLines, includeDefaultEnglish = false } = params;
  const ch = marketPreview?.card ?? null;
  const fromComp =
    typeof comp.language === "string" && comp.language.trim()
      ? comp.language.trim()
      : null;
  const fromMarket = ch?.market?.trim() ?? null;
  const corpus = corpusLines
    .filter((x): x is string => typeof x === "string" && Boolean(x.trim()))
    .join(" ");

  let lang: string | null = null;
  if (fromComp) lang = displayEditionLanguage(fromComp) ?? fromComp;
  if (!lang && fromMarket) lang = displayEditionLanguage(fromMarket) ?? fromMarket;
  if (!lang) lang = inferLanguageFromCorpus(corpus);
  if (!lang) lang = inferLanguageFromLatinPokemonRegion(corpus);
  if (
    !lang &&
    includeDefaultEnglish &&
    ch != null &&
    !/[\u3000-\u9fff\uac00-\ud7af]/.test(corpus)
  ) {
    lang = "English";
  }
  if (lang === "English" && /\bindonesia(?:n)?\b/i.test(corpus)) {
    lang = "English · Indonesian (card)";
  }
  return lang;
}
