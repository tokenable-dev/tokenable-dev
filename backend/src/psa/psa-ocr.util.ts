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
  const spaced = text.replace(/\s+/g, ' ').trim();
  const matches = spaced.match(/\b\d{7,10}\b/g);
  if (matches?.length) {
    const eights = matches.filter((m) => m.length === 8);
    if (eights.length) return eights[eights.length - 1];
    return matches[matches.length - 1];
  }
  /** 공백·기호로 끊긴 숫자만 있는 OCR (예: "8 3 1 7 9 5 8 0", "831 795 80") */
  const onlyDigits = text.replace(/\D/g, '');
  if (onlyDigits.length >= 7 && onlyDigits.length <= 10) {
    return onlyDigits;
  }
  /** 바코드+Cert가 이어진 경우 — PSA Cert는 보통 마지막 8자리 */
  if (onlyDigits.length > 10) {
    const last8 = onlyDigits.slice(-8);
    if (/^\d{8}$/.test(last8)) return last8;
    const m = onlyDigits.match(/(\d{8})\d*$/);
    if (m) return m[1];
  }
  return undefined;
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
  /** 라벨에서 MINT 와 숫자 등급이 줄바꿈으로 나뉜 경우 (예: MINT \\n 9) */
  const mintNl = upper.match(/MINT\s*[\r\n]+\s*(\d{1,2}(?:\.\d+)?)\b/);
  if (mintNl) {
    const n = parseFloat(mintNl[1]);
    return { label: `MINT ${mintNl[1]}`, score: Number.isNaN(n) ? undefined : n };
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

/** e.g. #SV49, SV49/SV94, 라벨 #085 */
export function extractCardNumber(text: string): string | undefined {
  const hashLetters = text.match(/#?\s*([A-Z]{1,4}\d{1,4}[A-Z]?)(?:\/|\b)/i);
  if (hashLetters) return hashLetters[1].toUpperCase();
  const slash = text.match(/\b([A-Z]{1,4}\d{1,4})\s*\/\s*[A-Z]{0,4}\d{1,4}\b/i);
  if (slash) return slash[1].toUpperCase();
  const hashDigits = text.match(/#\s*(\d{2,4})\b/);
  if (hashDigits) return hashDigits[1];
  return undefined;
}

/** Build search query from OCR (Pokemon-focused) */
/**
 * After OCR + optional PSA API merge, prefer structured fields for external `q`.
 */
export function buildSearchQueryFromParsed(parsed: ParsedPsaLabel): string {
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

export function buildSearchQueryAfterMerge(
  parsed: ParsedPsaLabel,
  ocrFallbackText: string,
): string {
  try {
    const fromParsed = buildSearchQueryFromParsed(parsed);
    if (fromParsed !== 'pokemon') {
      return fromParsed;
    }
    return buildSearchQuery(ocrFallbackText);
  } catch {
    return 'pokemon';
  }
}

export function buildSearchQuery(fullText: string): string {
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

/** OCR 합친 문자열이 비정상적으로 길면 정규식·메모리 이슈 방지 */
const MAX_OCR_PARSE_CHARS = 120_000;

export function parsePsaLabelFromOcr(fullText: string): ParsedPsaLabel {
  const text =
    fullText.length > MAX_OCR_PARSE_CHARS
      ? fullText.slice(0, MAX_OCR_PARSE_CHARS)
      : fullText;
  try {
    const certNumber = extractCertNumber(text);
    const { label: gradeLabel, score: gradeScore } = extractGrade(text);
    const year = extractYear(text);
    const cardNumberHint = extractCardNumber(text);

    let setHint: string | undefined;
    if (/HIDDEN FATES/i.test(text)) setHint = 'Hidden Fates';
    else if (/EVOLUTION/i.test(text)) setHint = 'Evolutions';
    else if (/VAN\s*GOGH|POKEMON\s+X\s+VAN/i.test(text))
      setHint = 'Pokemon x Van Gogh';

    let cardNameHint: string | undefined;
    const fa = text.match(
      /F\.?\s*A\.?\s*\/?\s*([A-Z][A-Z0-9\s]{2,40}?)(?:\s+GX|\s+V\b)/i,
    );
    if (fa) cardNameHint = fa[1].replace(/\s+/g, ' ').trim();
    else {
      const gx = text.match(/\b([A-Z][A-Z0-9\s]{2,35}?)\s+GX\b/i);
      if (gx) cardNameHint = gx[1].replace(/\s+/g, ' ').trim();
    }
    /** PIKACHU/GREY FELT HAT 등 슬랩 라벨 2행 흔한 패턴 */
    if (!cardNameHint) {
      const slash = text.match(
        /\b([A-Z][A-Z0-9]{2,})\s*\/\s*([A-Z0-9][A-Z0-9\s\-]{2,45}?)(?=[\s,;]|$)/im,
      );
      if (slash) {
        cardNameHint = `${slash[1]}/${slash[2]}`.replace(/\s+/g, ' ').trim();
      }
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
  } catch {
    return {};
  }
}

export function psaCertVerifyUrl(cert: string): string {
  return `https://www.psacard.com/cert/${cert}`;
}

/**
 * 폼에 직접 넣은 Cert 또는 `psacard.com/cert/123` URL → PSA GetByCertNumber용 (7~10자리).
 * OCR보다 우선해 조회할 때 사용.
 */
export function resolveCertHintForLookup(raw?: string | null): string | undefined {
  if (raw == null || !String(raw).trim()) return undefined;
  const t = String(raw).trim();
  const fromUrl = t.match(/psacard\.com\/cert\/(\d{7,10})\b/i);
  if (fromUrl) return fromUrl[1];
  const digits = t.replace(/\D/g, '');
  if (digits.length >= 7 && digits.length <= 10) return digits;
  return undefined;
}
