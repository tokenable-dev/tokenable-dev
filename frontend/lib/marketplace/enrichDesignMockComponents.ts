import type { CollectionComponents } from "@/lib/marketplace/collectionDetailComponents";
import type { PsaPopulationByGrade } from "@/lib/market/psaPopulationByGrade";
import { leadingYearFromSetLine } from "@/lib/marketplace/collectionFullDetailsTitle";

/** Typical PSA grade mix — peak grade keeps seed `psaTotalPopulation` (cert-line pop). */
const GRADE_WEIGHTS: Record<number, number> = {
  10: 22,
  9: 28,
  8: 20,
  7: 12,
  6: 8,
  5: 5,
  4: 3,
  3: 1.5,
  2: 0.8,
  1: 0.4,
};

function corpusFrom(comp: CollectionComponents): string {
  return [
    comp.listingDisplayTitle,
    comp.cardNameDisplay,
    comp.cardName,
    comp.cardSetDisplay,
    comp.cardSet,
    comp.psaSubject,
    comp.psaBrand,
    comp.psaVariety,
    comp.variant,
  ]
    .filter((x): x is string => typeof x === "string" && Boolean(x.trim()))
    .join(" ");
}

function parsePeakGradeScore(gradeScore: string | undefined): number {
  const n = Number.parseFloat(String(gradeScore ?? "10").trim());
  if (!Number.isFinite(n) || n < 1) return 10;
  return Math.min(10, Math.max(1, Math.floor(n)));
}

export function buildMockPsaPopulationByGrade(
  peakGradeScore: string | undefined,
  peakPop: number,
): { byGrade: PsaPopulationByGrade; specTotal: number } {
  const peak = parsePeakGradeScore(peakGradeScore);
  const peakCount = Math.max(0, Math.floor(peakPop));
  const wPeak = GRADE_WEIGHTS[peak] ?? 22;
  const byGrade: PsaPopulationByGrade = {};
  let specTotal = 0;

  for (let g = 1; g <= 10; g++) {
    const key = String(g) as keyof PsaPopulationByGrade;
    let n: number;
    if (g === peak) {
      n = peakCount;
    } else if (peakCount <= 0) {
      n = 0;
    } else {
      const raw = Math.round((peakCount * (GRADE_WEIGHTS[g]! / wPeak)));
      // Tiny cert-line pops still need a visible ladder for the POP tab.
      n = peakCount <= 20 ? Math.max(g === peak - 1 || g === peak + 1 ? 1 : 0, raw) : Math.max(1, raw);
    }
    byGrade[key] = n;
    specTotal += n;
  }

  if (specTotal < peakCount) {
    byGrade[String(peak) as keyof PsaPopulationByGrade] = peakCount;
    specTotal = Object.values(byGrade).reduce((a, b) => a + (b ?? 0), 0);
  }

  return { byGrade, specTotal: Math.max(specTotal, peakCount) };
}

function inferCardNumber(corpus: string): string | null {
  const hash = /#\s*(\d+[A-Za-z]?)\b/.exec(corpus);
  if (hash?.[1]) return hash[1];
  const slash = /\b(\d{1,4})\s*\/\s*\d{1,4}\b/.exec(corpus);
  if (slash?.[1]) return slash[1];
  return null;
}

function inferYear(comp: CollectionComponents, corpus: string): number | null {
  const fromComp =
    typeof comp.year === "number" && Number.isFinite(comp.year)
      ? comp.year
      : typeof comp.year === "string" && /^\d{4}$/.test(comp.year.trim())
        ? Number(comp.year.trim())
        : null;
  if (fromComp != null && fromComp >= 1880 && fromComp <= 2100) return fromComp;

  for (const line of [comp.cardSetDisplay, comp.cardSet, corpus]) {
    if (!line) continue;
    const y = leadingYearFromSetLine(line) ?? (() => {
      const m = /\b(19|20)\d{2}\b/.exec(line);
      return m ? Number(m[0]) : null;
    })();
    if (y != null && y >= 1880 && y <= 2100) return y;
  }
  return null;
}

function inferLanguage(corpus: string): string {
  if (/\bjapanese\b|\bjp\b|\bjpn\b/i.test(corpus)) return "Japanese";
  if (/\bkorean\b|\bkr\b/i.test(corpus)) return "Korean";
  if (/\bchinese\b|\bchn?\b/i.test(corpus)) return "Chinese";
  if (/\bindonesia/i.test(corpus)) return "English · Indonesian (card)";
  return "English";
}

function inferVariant(comp: CollectionComponents, corpus: string): string | null {
  const existing = (comp.variant ?? comp.psaVariety)?.trim();
  if (existing) return existing;

  const named = [
    /\b(special illustration rare)\b/i,
    /\b(special art rare)\b/i,
    /\b(illustration rare)\b/i,
    /\b(stellar rare)\b/i,
    /\b(blue ice)\b/i,
    /\b(silver prizm)\b/i,
    /\b(gold refractor)\b/i,
    /\b(rookie refractor)\b/i,
    /\b(refractor)\b/i,
    /\b(rookie auto)\b/i,
  ];
  for (const re of named) {
    const m = re.exec(corpus);
    if (m?.[1]) return m[1];
  }
  if (/\bSAR\b/.test(corpus)) return "SAR";
  return null;
}

function inferCategory(comp: CollectionComponents, corpus: string): string | null {
  const existing = comp.psaCategory?.trim();
  if (existing) return existing;
  if (/\bpokemon\b|\bpikachu\b|\bnidoking\b|\bcharizard\b|\bmega dream\b/i.test(corpus)) {
    return "Pokemon";
  }
  if (
    /\bbasketball\b|\bnba\b|\bprizm\b|\bdon[cč]i[cć]\b|\blebron\b|\bjames\b/i.test(
      corpus,
    )
  ) {
    return "Basketball";
  }
  if (/\bbaseball\b|\bmlb\b|\btopps chrome\b/i.test(corpus)) {
    return "Baseball";
  }
  return null;
}

/**
 * Fill sparse design-mock `components` so Details + POP tabs look complete.
 * Only fills missing fields — never overwrites real/enriched values.
 */
export function enrichDesignMockComponents(
  comp: CollectionComponents,
): CollectionComponents {
  const out: CollectionComponents = { ...comp };
  const corpus = corpusFrom(out);

  if (!out.cardNumber?.trim()) {
    const n = inferCardNumber(corpus);
    if (n) out.cardNumber = n;
  }

  if (out.year == null || out.year === "") {
    const y = inferYear(out, corpus);
    if (y != null) out.year = y;
  }

  if (!out.language?.trim()) {
    out.language = inferLanguage(corpus);
  }

  if (!out.variant?.trim() && !out.psaVariety?.trim()) {
    const v = inferVariant(out, corpus);
    if (v) out.variant = v;
  }

  if (!out.psaCategory?.trim()) {
    const cat = inferCategory(out, corpus);
    if (cat) out.psaCategory = cat;
  }

  const peakPop =
    typeof out.psaTotalPopulation === "number" && Number.isFinite(out.psaTotalPopulation)
      ? Math.floor(out.psaTotalPopulation)
      : null;

  const hasByGrade =
    out.psaPopulationByGrade != null &&
    Object.keys(out.psaPopulationByGrade).length > 0;

  if (!hasByGrade && peakPop != null && peakPop >= 0) {
    const { byGrade, specTotal } = buildMockPsaPopulationByGrade(
      out.gradeScore,
      peakPop,
    );
    out.psaPopulationByGrade = byGrade;
    if (
      out.psaSpecTotalPopulation == null ||
      !Number.isFinite(out.psaSpecTotalPopulation)
    ) {
      out.psaSpecTotalPopulation = specTotal;
    }
  }

  return out;
}
