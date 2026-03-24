/**
 * Heuristic extraction of PSA slab label fields from noisy OCR text.
 * Not 100% accurate — user should verify before minting.
 */

export interface ParsedPsaLabel {
  certNumber?: string;
  /** e.g. "MINT 9", "GEM MT 10" */
  gradeLabel?: string;
  /** Numeric grade when inferable (9, 10, …) */
  gradeScore?: number;
  year?: string;
  /** Best-effort card name / character line */
  cardNameHint?: string;
  /** e.g. SV49 */
  cardNumberHint?: string;
  /** e.g. HIDDEN FATES */
  setHint?: string;
  /** PSA Public API `PublicPSACert` — cert lookup 시 병합 */
  gradeDescription?: string;
  labelType?: string;
  category?: string;
  autographGrade?: string;
  totalPopulation?: number;
  populationHigher?: number;
  totalPopulationWithQualifier?: number;
  reverseBarcode?: boolean;
  specId?: number;
}

/** Prefer 8-digit cert (most common PSA) */
export function extractCertNumber(text: string): string | undefined {
  const matches = text.replace(/\s+/g, ' ').match(/\b\d{7,10}\b/g);
  if (!matches?.length) return undefined;
  const eights = matches.filter((m) => m.length === 8);
  if (eights.length) return eights[eights.length - 1];
  return matches[matches.length - 1];
}

export function extractGrade(text: string): {
  label?: string;
  score?: number;
} {
  const upper = text.toUpperCase();
  const gem = upper.match(/GEM\s*MT\s*(\d+(?:\.\d+)?)/);
  if (gem) {
    const n = parseFloat(gem[1]);
    return { label: `GEM MT ${gem[1]}`, score: Number.isNaN(n) ? undefined : n };
  }
  const mint = upper.match(/MINT\s*(\d+(?:\.\d+)?)/);
  if (mint) {
    const n = parseFloat(mint[1]);
    return { label: `MINT ${mint[1]}`, score: Number.isNaN(n) ? undefined : n };
  }
  const nm = upper.match(/NM\s*-?\s*MT\s*(\d+)/);
  if (nm) {
    const n = parseInt(nm[1], 10);
    return { label: `NM-MT ${nm[1]}`, score: n };
  }
  const psaNum = upper.match(/PSA\s*(\d{1,2}(?:\.\d)?)/);
  if (psaNum) {
    const n = parseFloat(psaNum[1]);
    return { label: `PSA ${psaNum[1]}`, score: Number.isNaN(n) ? undefined : n };
  }
  return {};
}

export function extractYear(text: string): string | undefined {
  const m = text.match(/\b(19|20)\d{2}\b/);
  return m ? m[0] : undefined;
}

/** e.g. #SV49, SV49/SV94 */
export function extractCardNumber(text: string): string | undefined {
  const hash = text.match(/#?\s*([A-Z]{1,4}\d{1,4}[A-Z]?)(?:\/|\b)/i);
  if (hash) return hash[1].toUpperCase();
  const slash = text.match(/\b([A-Z]{1,4}\d{1,4})\s*\/\s*[A-Z]{0,4}\d{1,4}\b/i);
  if (slash) return slash[1].toUpperCase();
  return undefined;
}

/** Build JustTCG search query from OCR (Pokemon-focused) */
/**
 * After OCR + optional PSA API merge, prefer structured fields for JustTCG `q`.
 */
export function buildJustTcgSearchQueryFromParsed(parsed: ParsedPsaLabel): string {
  const parts = [
    parsed.cardNameHint,
    parsed.setHint,
    parsed.year,
    parsed.cardNumberHint ? `#${parsed.cardNumberHint}` : undefined,
  ]
    .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
    .map((s) => s.trim());
  const q = parts.join(' ').trim();
  if (q.length >= 4) {
    return q.slice(0, 120);
  }
  return 'pokemon';
}

export function buildJustTcgSearchQueryAfterMerge(
  parsed: ParsedPsaLabel,
  ocrFallbackText: string,
): string {
  const fromParsed = buildJustTcgSearchQueryFromParsed(parsed);
  if (fromParsed !== 'pokemon') {
    return fromParsed;
  }
  return buildJustTcgSearchQuery(ocrFallbackText);
}

export function buildJustTcgSearchQuery(fullText: string): string {
  const lines = fullText
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 2);

  const junk =
    /^(PSA|CERT|GRADE|GEM|MINT|WWW\.|HTTP|©|PO BOX|BECKETT)/i;
  const scored = lines.map((line) => {
    let s = 0;
    if (junk.test(line)) s -= 20;
    if (/GX|VMAX|VSTAR|EX\b|LV\.X|MEGA/i.test(line)) s += 5;
    if (/CHARIZARD|PIKACHU|EEVEE|LUGIA|MEW|POKEMON|POKÉMON/i.test(line)) s += 4;
    if (/HIDDEN FATES|EVOLUTION|BASE SET|CHAMPION/i.test(line)) s += 3;
    if (line.length >= 12 && line.length < 100) s += 2;
    if (/\d{7,10}/.test(line) && line.length < 30) s -= 5;
    return { line, s };
  });

  scored.sort((a, b) => b.s - a.s);
  const best = scored.find((x) => x.s > 0)?.line ?? scored[0]?.line;
  if (best && best.length > 3) {
    return best.slice(0, 120);
  }
  return 'pokemon';
}

export function parsePsaLabelFromOcr(fullText: string): ParsedPsaLabel {
  const certNumber = extractCertNumber(fullText);
  const { label: gradeLabel, score: gradeScore } = extractGrade(fullText);
  const year = extractYear(fullText);
  const cardNumberHint = extractCardNumber(fullText);

  const upper = fullText.toUpperCase();
  let setHint: string | undefined;
  if (/HIDDEN FATES/i.test(fullText)) setHint = 'Hidden Fates';
  else if (/EVOLUTION/i.test(fullText)) setHint = 'Evolutions';

  let cardNameHint: string | undefined;
  const fa = fullText.match(/F\.?\s*A\.?\s*\/?\s*([A-Z][A-Z0-9\s]{2,40}?)(?:\s+GX|\s+V\b)/i);
  if (fa) cardNameHint = fa[1].replace(/\s+/g, ' ').trim();
  else {
    const gx = fullText.match(
      /\b([A-Z][A-Z0-9\s]{2,35}?)\s+GX\b/i,
    );
    if (gx) cardNameHint = gx[1].replace(/\s+/g, ' ').trim();
  }

  return {
    certNumber,
    gradeLabel,
    gradeScore,
    year,
    cardNameHint,
    cardNumberHint,
    setHint,
  };
}

export function psaCertVerifyUrl(cert: string): string {
  return `https://www.psacard.com/cert/${cert}`;
}
