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

export function psaVarietyIndicatesGenericBaseLine(
  psaVariety: string | null | undefined,
): boolean {
  if (psaVariety == null) return true;
  const v = psaVariety.trim();
  if (!v) return true;
  if (psaVarietyIsCardNumberOnly(v)) return true;
  if (psaVarietyIsLanguageOnlyLabel(v)) return true;
  if (psaVarietyIsPackagingDescriptor(v)) return true;
  if (psaVarietyIsPokemonRarityLabel(v)) return true;
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
): boolean {
  if (psaVariety == null || !String(psaVariety).trim()) return false;
  return !psaVarietyIndicatesGenericBaseLine(psaVariety);
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
  const v = String(psaVariety ?? '').trim().toLowerCase();
  if (!v) return false;
  if (/\bsir\b/.test(v)) return true;
  if (/special\s+illustration\s+rare/.test(v)) return true;
  if (/special\s+illustration/.test(v) && /\brare\b/.test(v)) return true;
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
  const v = String(psaVariety ?? '').trim().toLowerCase();
  if (!v) return false;
  return /\billustration\s+rare\b/.test(v);
}

/**
 * Pokémon TCG **Art Rare** (AR) — PSA lists **ART RARE** while Cardhedger catalogs the slot as
 * `variant: "Base"`. Art Rare cards occupy unique card numbers in the secret-rare range, so
 * there is no parallel conflict with Base prints — treating as Base is safe.
 */
export function psaVarietyIsArtRareLabel(
  psaVariety: string | null | undefined,
): boolean {
  const v = String(psaVariety ?? '').trim().toLowerCase();
  if (!v) return false;
  if (/^art\s+rare$/.test(v)) return true;
  if (/\bar\b/.test(v) && /\brare\b/.test(v)) return true;
  return false;
}

/**
 * Pokémon TCG rarity labels where PSA names the card's rarity slot while
 * Cardhedger still uses `variant: "Base"` (e.g. Art Rare, Illustration Rare,
 * Special Illustration Rare, Hyper Rare, Full Art, Amazing Rare, Ultra Rare).
 * These occupy unique card numbers in the secret-rare range — no parallel conflict.
 */
export function psaVarietyIsPokemonRarityLabel(
  psaVariety: string | null | undefined,
): boolean {
  const v = String(psaVariety ?? '').trim().toLowerCase();
  if (!v) return false;
  if (psaVarietyIsSpecialIllustrationRareLabel(psaVariety)) return true;
  if (psaVarietyIsIllustrationRareLabel(psaVariety)) return true;
  if (psaVarietyIsArtRareLabel(psaVariety)) return true;
  if (/^hyper\s+rare$/.test(v)) return true;
  if (/^full\s+art$/.test(v)) return true;
  if (/^amazing\s+rare$/.test(v)) return true;
  if (/^ultra\s+rare$/.test(v)) return true;
  if (/^trainer\s+gallery$/.test(v)) return true;
  if (/^secret\s+rare$/.test(v)) return true;
  return false;
}
