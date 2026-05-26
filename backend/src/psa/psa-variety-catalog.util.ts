/**
 * Cardhedger catalog rows (e.g. `variant: "Base"`) vs inserts — align with **PSA PSACert.Variety**
 * only. Do not infer parallels from marketplace titles or mint `cardhedger.searchQuery`.
 */

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
 */
export function psaVarietyIsPackagingDescriptor(
  psaVariety: string | null | undefined,
): boolean {
  const t = String(psaVariety ?? '').trim().toLowerCase();
  if (!t) return false;
  if (t === 'etb' || /\belite\s+trainer\s+box\b/.test(t)) return true;
  if (/\bblister\b/.test(t)) return true;
  if (/\bposter\s+collection\b/.test(t)) return true;
  if (/\bultra[\s-]*premium\s+collection\b/.test(t)) return true;
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
