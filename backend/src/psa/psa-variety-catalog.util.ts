/**
 * Cardhedger catalog rows (e.g. `variant: "Base"`) vs inserts — align with **PSA PSACert.Variety**
 * only. Do not infer parallels from marketplace titles or mint `cardhedger.searchQuery`.
 */

const CHROME_PARALLEL_COLOR_TOKENS = [
  'orange',
  'gold',
  'green',
  'purple',
  'blue',
  'red',
  'pink',
  'black',
  'superfractor',
  'sepia',
  'aqua',
  'yellow',
] as const;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Color words in Topps Chrome-style parallel names (mint `card.variant` often has these when PSA does not). */
export function chromeColorTokensIn(text: string | null | undefined): string[] {
  const t = String(text ?? '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return [];
  const found: string[] = [];
  for (const c of CHROME_PARALLEL_COLOR_TOKENS) {
    if (new RegExp(`\\b${escapeRegExp(c)}\\b`).test(t)) found.push(c);
  }
  return found;
}

/**
 * PSA Variety is authoritative for the parallel family; mint `card.variant` often adds color
 * (e.g. ORANGE) when PSA only prints `{SPORT} REFRACTOR`.
 */
export function mergePsaVarietyWithMintVariant(
  psaVariety: string | null | undefined,
  mintVariant: string | null | undefined,
): string {
  const p = String(psaVariety ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  const m = String(mintVariant ?? '')
    .trim()
    .replace(/\s+/g, ' ');
  if (!p) return m;
  if (!m) return p;
  const pLow = p.toLowerCase();
  const mLow = m.toLowerCase();
  if (mLow.includes(pLow)) return m;
  if (pLow.includes(mLow)) return p.length >= m.length ? p : m;
  const mintColors = chromeColorTokensIn(m);
  const psaColors = chromeColorTokensIn(p);
  if (mintColors.some((c) => !psaColors.includes(c))) return m;
  return p.length >= m.length ? p : m;
}

/** PSA sometimes duplicates the card # in Variety when CardNumber is empty. */
export function psaVarietyIsCardNumberOnly(variety: string): boolean {
  const v = variety.trim();
  return v.length > 0 && /^#?\d+$/.test(v.replace(/\s/g, ''));
}

/**
 * True when PSA's Variety line describes the flagship / non-insert line for that spec
 * (sport-only label, explicit BASE, etc.). In that case a Cardhedger `variant: Base` row is appropriate.
 *
 * Unknown multi-token varieties default to **not** generic base so we prefer differentiated rows
 * when PSA names an insert.
 */
/** PSA `Variety` line is print language only — not a Cardhedger parallel (do not reject `variant: Base`). */
export function psaVarietyIsLanguageOnlyLabel(
  psaVariety: string | null | undefined,
): boolean {
  const v = String(psaVariety ?? '').trim();
  if (!v) return false;
  return /^(english|japanese|korean|chinese|french|german|italian|spanish|portuguese)$/i.test(
    v,
  );
}

/**
 * PSA names the product/sku (ETB, poster tin, …) in Variety while Cardhedger keeps `variant: Base`.
 *
 * Covers compound variety strings like "OBSIDIAN FLAMES ETB", "CELEBRATIONS COLLECTION",
 * "PIKACHU V-UNION ETB", etc. — the word token "ETB" or known product-collection suffixes
 * always indicate packaging, not a card parallel.
 */
export function psaVarietyIsPackagingDescriptor(
  psaVariety: string | null | undefined,
): boolean {
  const t = String(psaVariety ?? '').trim().toLowerCase();
  if (!t) return false;
  // Any variety containing "ETB" as a word covers "OBSIDIAN FLAMES ETB",
  // "CELEBRATIONS ETB", "PIKACHU V-UNION ETB", etc.
  if (/\betb\b/.test(t)) return true;
  if (/\belite\s+trainer\s+box\b/.test(t)) return true;
  if (/\bblister\b/.test(t)) return true;
  if (/\bposter\s+collection\b/.test(t)) return true;
  if (/\bultra[\s-]*premium\s+collection\b/.test(t)) return true;
  if (/\bcelebrations?\s+collection\b/.test(t)) return true;
  // Generic "[product name] COLLECTION" packaging (e.g. "CHAMPIONS PATH COLLECTION")
  // but only when paired with a known expansion/set word before "collection".
  if (/\b(collection\s+box|gift\s+collection|premium\s+collection|special\s+collection)\b/.test(t)) return true;
  if (/\btin\b/.test(t) && /\bpromo/.test(t)) return true;
  return false;
}

/**
 * PSA often copies the expansion / Brand into Variety (e.g. `VSTAR UNIVERSE` on
 * `POKEMON JAPANESE SWORD & SHIELD VSTAR UNIVERSE`). That is not a parallel.
 */
export function psaVarietyIsBrandOrSetDuplicate(
  psaVariety: string | null | undefined,
  brandOrSet: string | null | undefined,
): boolean {
  const v = String(psaVariety ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  const b = String(brandOrSet ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  if (!v || !b) return false;
  if (v === b) return true;
  // Single short tokens are real parallels (RED, GOLD) or noise, not set names.
  if (!v.includes(' ') && v.length < 5) return false;
  const phrase = new RegExp(`(?:^|\\s)${escapeRegExp(v)}(?:\\s|$)`);
  return phrase.test(b);
}

export function psaVarietyIndicatesGenericBaseLine(
  psaVariety: string | null | undefined,
  brandOrSet?: string | null,
): boolean {
  if (psaVariety == null) return true;
  const v = psaVariety.trim();
  if (!v) return true;
  if (psaVarietyIsCardNumberOnly(v)) return true;
  if (psaVarietyIsLanguageOnlyLabel(v)) return true;
  if (psaVarietyIsPackagingDescriptor(v)) return true;
  if (psaVarietyIsPokemonRarityLabel(v)) return true;
  if (psaVarietyIsBrandOrSetDuplicate(v, brandOrSet)) return true;
  const t = v.toLowerCase();
  if (/\bbase\b/.test(t)) return true;
  if (
    /^(basketball|baseball|football|hockey|soccer)(\s+cards)?$/i.test(v.trim())
  ) {
    return true;
  }
  return false;
}

/**
 * When true, a Cardhedger hit whose catalog row omits PSA's Variety wording is incompatible
 * for that cert line.
 */
export function psaVarietyRequiresNonBaseCardhedgerRow(
  psaVariety: string | null | undefined,
  brandOrSet?: string | null,
): boolean {
  if (psaVariety == null || !String(psaVariety).trim()) return false;
  return !psaVarietyIndicatesGenericBaseLine(psaVariety, brandOrSet);
}

/**
 * PSA often prints only **`{SPORT} REFRACTOR`** for several distinct Chrome parallels
 * (flagship "Refractor" vs RayWave / RWB / Pulsar / …). Cardhedger splits them by `variant`.
 * When this is true, search tie-breaks should prefer **more specific** `variant` labels.
 */
export function psaVarietyIsGenericSportRefractorLine(
  psaVariety: string | null | undefined,
): boolean {
  const v = String(psaVariety ?? '').trim();
  if (!v) return false;
  const t = v.toLowerCase().replace(/\s+/g, ' ').trim();
  return /^(basketball|baseball|football|hockey|soccer)(\s+cards)?\s+refractor$/i.test(
    t,
  );
}

/**
 * Pokémon TCG — PSA `Variety` often lists **SPECIAL ILLUSTRATION RARE** (SIR) while Cardhedger
 * still uses `variant: "Base"` for that print (rarity is not repeated in `description`).
 */
export function psaVarietyIsSpecialIllustrationRareLabel(
  psaVariety: string | null | undefined,
): boolean {
  for (const v of psaVarietyLabelPhrases(psaVariety)) {
    if (/\bsir\b/.test(v)) return true;
    if (/special\s+illustration\s+rare/.test(v)) return true;
    if (/special\s+illustration/.test(v) && /\brare\b/.test(v)) return true;
  }
  return false;
}

/**
 * Pokémon TCG **Illustration Rare** (IR) — PSA lists **ILLUSTRATION RARE** (distinct from SIR).
 * Cardhedger often catalogs the slot as **`variant: "Base"`** like SIR; treat overlap with SIR first.
 */
export function psaVarietyIsIllustrationRareLabel(
  psaVariety: string | null | undefined,
): boolean {
  if (psaVarietyIsSpecialIllustrationRareLabel(psaVariety)) return false;
  return psaVarietyLabelPhrases(psaVariety).some((v) =>
    /\billustration\s+rare\b/.test(v),
  );
}

/**
 * PSA often concatenates rarity and subject on one Variety line
 * (`FULL ART/UMBREON VMAX-HYPER`). Rarity matching must use each `/`-separated
 * phrase, not only the whole string.
 */
export function psaVarietyLabelPhrases(
  psaVariety: string | null | undefined,
): string[] {
  const raw = String(psaVariety ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!raw) return [];
  const parts = raw
    .split(/[|/]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  return [...new Set([raw, ...parts])];
}

/**
 * Cardhedger splits these Pokémon prints onto non-Base `variant` rows.
 * Do not treat them as rarity-slot Base even if the line also says "rare".
 */
function psaVarietyNamesPokemonPrintParallel(
  psaVariety: string | null | undefined,
): boolean {
  const t = String(psaVariety ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!t) return false;
  if (/\bmaster\s+ball\b/.test(t)) return true;
  if (/\bpoke\s*ball\b/.test(t)) return true;
  if (/\breverse\s+(holo|foil|holofoil)\b/.test(t)) return true;
  return false;
}

/**
 * Pokémon TCG **Art Rare** (AR) — PSA lists **ART RARE** while Cardhedger catalogs the slot as
 * `variant: "Base"`. Art Rare cards occupy unique card numbers in the secret-rare range, so
 * there is no parallel conflict with Base prints — treating as Base is safe.
 */
export function psaVarietyIsArtRareLabel(
  psaVariety: string | null | undefined,
): boolean {
  for (const v of psaVarietyLabelPhrases(psaVariety)) {
    if (/^art\s+rare$/.test(v)) return true;
    if (/\bar\b/.test(v) && /\brare\b/.test(v)) return true;
  }
  return false;
}

/**
 * Pokémon TCG **Special Art Rare** (SAR, Japanese secret-rare slot) — PSA lists
 * **SPECIAL ART RARE** while Cardhedger catalogs the slot as `variant: "Base"`
 * (same pattern as SIR / Art Rare; the card number is unique, e.g. Mega Dream `#240`).
 */
export function psaVarietyIsSpecialArtRareLabel(
  psaVariety: string | null | undefined,
): boolean {
  for (const v of psaVarietyLabelPhrases(psaVariety)) {
    if (/special\s+art\s+rare/.test(v)) return true;
    if (/^sar$/.test(v)) return true;
    if (/\bsar\b/.test(v) && !/illustration/.test(v)) return true;
  }
  return false;
}

function phraseIsPokemonRaritySlot(phrase: string): boolean {
  const v = phrase.trim().toLowerCase().replace(/\s+/g, ' ');
  if (!v) return false;
  if (psaVarietyIsSpecialIllustrationRareLabel(v)) return true;
  if (psaVarietyIsIllustrationRareLabel(v)) return true;
  if (psaVarietyIsSpecialArtRareLabel(v)) return true;
  if (psaVarietyIsArtRareLabel(v)) return true;
  if (/^full\s+art$/.test(v)) return true;
  if (/^(mega\s+)?(ultra|hyper|secret|amazing)\s+rare$/.test(v)) return true;
  if (
    /^(double|triple|character|rainbow|gold|shiny)\s+rare$/.test(v)
  ) {
    return true;
  }
  if (/^(ace\s+spec|trainer\s+gallery)$/.test(v)) return true;
  if (
    /^(sar|sir|ir|hr|ur|sr|rr|rrr|csr|ssr|mur|ar)$/.test(v)
  ) {
    return true;
  }
  return false;
}

/**
 * Pokémon TCG rarity labels where PSA names the card's rarity slot while
 * Cardhedger still uses `variant: "Base"` (Art Rare, Full Art, Hyper Rare, …).
 * PSA often appends the subject after a slash (`FULL ART/UMBREON VMAX-HYPER`);
 * that is still a rarity slot, not a Cardhedger parallel.
 * Print finishes (Master Ball, Reverse Holo) stay non-base.
 */
export function psaVarietyIsPokemonRarityLabel(
  psaVariety: string | null | undefined,
): boolean {
  const raw = String(psaVariety ?? '').trim();
  if (!raw) return false;
  if (psaVarietyNamesPokemonPrintParallel(raw)) return false;
  return psaVarietyLabelPhrases(raw).some((p) => phraseIsPokemonRaritySlot(p));
}
