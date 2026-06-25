import type {
  AiInsightConfidenceLevel,
  AiInsightLiquidityLevel,
  AiInsightMarketCycleLabel,
  AiInsightPriceTrendLabel,
  AiInsightScoredComponent,
  AiInsightSectionInput,
  AiInsightVolatilityLevel,
  CollectionAiInsightSections,
} from './cardhedger-ai-insight.types';
import type { CardhedgerCardRow } from './cardhedger-market-data.types';

function n(v: number | null | undefined): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  return v;
}

function clamp100(v: number): number {
  return Math.min(100, Math.max(0, Math.round(v)));
}

function medianUsd(values: number[]): number | null {
  const sorted = values
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const m = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[m]
    : (sorted[m - 1] + sorted[m]) / 2;
}

function pctChangeSentence(window: string, pct: number | null): string | null {
  if (pct == null) return null;
  const dir = pct > 1 ? 'positive' : pct < -1 ? 'negative' : 'flat';
  return `Price momentum is ${dir} over the last ${window} (${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%).`;
}

function volumeNote(
  sales7d: number | null,
  sales30d: number | null,
): string | null {
  if (sales7d == null || sales30d == null) return null;
  const prev7 = sales30d - sales7d;
  if (prev7 <= 0) {
    if (sales7d > 0) {
      return `Recent 7-day sales (${sales7d}) account for all indexed 30-day volume.`;
    }
    return null;
  }
  const pct = ((sales7d - prev7 / 3) / Math.max(prev7 / 3, 1)) * 100;
  if (!Number.isFinite(pct)) return null;
  const dir = pct >= 5 ? 'increased' : pct <= -5 ? 'decreased' : 'held steady';
  return `Transaction volume ${dir} in the recent 7-day window versus the prior weeks (${pct >= 0 ? '+' : ''}${pct.toFixed(0)}% vs prior-week pace).`;
}

function classifyPriceTrend(
  stats: AiInsightSectionInput['stats'],
  history90: Array<{ t: number; v: number }>,
): AiInsightPriceTrendLabel | null {
  const c30 = n(stats.change30dPct);
  const c90 = n(stats.change90dPct);
  const vals = history90.map((p) => p.v).filter((v) => v > 0);
  if (c30 == null && c90 == null && vals.length < 3) return null;

  if (vals.length >= 4) {
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const variance =
      vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length;
    const cv = Math.sqrt(variance) / mean;
    if (cv > 0.12) return 'volatile';
  }

  if (c30 != null && c90 != null && c30 > 8 && c90 > 5) return 'breakout';
  if (c30 != null && c30 < -5) return 'cooling';
  if (
    (c30 == null || Math.abs(c30) <= 4) &&
    (c90 == null || Math.abs(c90) <= 8)
  ) {
    return 'consolidation';
  }
  if (
    c30 != null &&
    c90 != null &&
    Math.abs(c30) <= 3 &&
    Math.abs(c90) <= 6
  ) {
    return 'stable';
  }
  if (c30 != null && c30 > 3) return 'breakout';
  if (c30 != null && c30 < -2) return 'cooling';
  return 'consolidation';
}

function avgDaysBetweenSales(
  comps: AiInsightSectionInput['compsRaw'],
): number | null {
  const times = comps
    .map((c) => c.t)
    .filter((t) => Number.isFinite(t) && t > 0)
    .sort((a, b) => a - b);
  if (times.length < 2) return null;
  let totalGap = 0;
  for (let i = 1; i < times.length; i++) {
    totalGap += times[i] - times[i - 1];
  }
  return totalGap / (times.length - 1) / 86_400;
}

function liquidityLevel(
  sales30d: number | null,
): AiInsightLiquidityLevel | null {
  if (sales30d == null) return null;
  if (sales30d >= 40) return 'healthy';
  if (sales30d >= 15) return 'moderate';
  if (sales30d >= 5) return 'thin';
  return 'very_thin';
}

function classifyVolatilityLevel(
  volPct: number,
): AiInsightVolatilityLevel {
  if (volPct < 8) return 'low';
  if (volPct < 18) return 'medium';
  return 'high';
}

function volatilityFromHistory(
  history: Array<{ t: number; v: number }>,
  windowDays: number,
): { volPct: number | null; level: AiInsightVolatilityLevel | null } {
  if (history.length < 8) return { volPct: null, level: null };
  const sorted = [...history]
    .filter((p) => p.v > 0 && Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
  if (sorted.length < 8) return { volPct: null, level: null };

  const latestT = sorted[sorted.length - 1].t;
  const cutoff = latestT - windowDays * 86_400;
  const slice = sorted.filter((p) => p.t >= cutoff);
  if (slice.length < 8) return { volPct: null, level: null };

  const logReturns: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    const r = Math.log(slice[i].v / slice[i - 1].v);
    if (Number.isFinite(r)) logReturns.push(r);
  }
  if (logReturns.length < 7) return { volPct: null, level: null };

  const mean = logReturns.reduce((a, b) => a + b, 0) / logReturns.length;
  const variance =
    logReturns.reduce((a, b) => a + (b - mean) ** 2, 0) / logReturns.length;
  const volPct = Math.round(Math.sqrt(variance) * 1000) / 10;
  return { volPct, level: classifyVolatilityLevel(volPct) };
}

function parsePrice(raw: unknown): number | null {
  const v =
    typeof raw === 'number'
      ? raw
      : typeof raw === 'string'
        ? parseFloat(raw)
        : NaN;
  return Number.isFinite(v) && v > 0 ? v : null;
}

function readGradePriceFromRow(
  row: CardhedgerCardRow | null,
  grade: string,
): number | null {
  if (!row) return null;
  const prices = row.prices;
  if (!Array.isArray(prices)) return null;
  const want = grade.trim().toUpperCase();
  for (const p of prices) {
    if (typeof p !== 'object' || p == null) continue;
    const pg = String((p as { grade?: unknown }).grade ?? '')
      .trim()
      .toUpperCase();
    if (pg === want) {
      return parsePrice((p as { price?: unknown }).price);
    }
  }
  return null;
}

function parsePsaCertFields(snapshot: Record<string, unknown> | null): {
  isValidRequest: boolean | null;
  certNumber: string | null;
  cardGrade: string | null;
} {
  if (!snapshot) {
    return { isValidRequest: null, certNumber: null, cardGrade: null };
  }
  const isValidRequest =
    typeof snapshot.IsValidRequest === 'boolean'
      ? snapshot.IsValidRequest
      : null;
  const psaCert = snapshot.PSACert as Record<string, unknown> | undefined;
  const certRaw = psaCert?.CertNumber ?? snapshot.CertNumber;
  const gradeRaw = psaCert?.CardGrade ?? snapshot.CardGrade;
  const certNumber =
    typeof certRaw === 'string'
      ? certRaw.trim()
      : typeof certRaw === 'number' && Number.isFinite(certRaw)
        ? String(Math.trunc(certRaw))
        : null;
  const cardGrade =
    typeof gradeRaw === 'string'
      ? gradeRaw.trim()
      : typeof gradeRaw === 'number' && Number.isFinite(gradeRaw)
        ? String(gradeRaw)
        : null;
  return { isValidRequest, certNumber, cardGrade };
}

function normalizeCertDigits(cert: string | null): string | null {
  if (!cert?.trim()) return null;
  const digits = cert.replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

function gradesMatch(
  listingGrade: string | null,
  psaGrade: string | null,
): boolean | null {
  if (!listingGrade?.trim() || !psaGrade?.trim()) return null;
  const norm = (g: string) =>
    g
      .trim()
      .toUpperCase()
      .replace(/^PSA\s*/i, '')
      .replace(/[^0-9.]/g, '');
  return norm(listingGrade) === norm(psaGrade);
}

function buildScoredComponents(
  entries: Array<{
    key: string;
    label: string;
    score: number;
    weight: number;
  }>,
): AiInsightScoredComponent[] {
  const active = entries.filter((e) => e.weight > 0);
  const weightSum = active.reduce((a, e) => a + e.weight, 0);
  if (weightSum <= 0) return [];
  return active.map((e) => ({
    key: e.key,
    label: e.label,
    score: clamp100(e.score),
    weight: Math.round((e.weight / weightSum) * 1000) / 1000,
    contribution: clamp100((e.score * e.weight) / weightSum),
  }));
}

function demandScore(input: AiInsightSectionInput): {
  score: number;
  components: AiInsightScoredComponent[];
  reasoning: string[];
} | null {
  const s30 = n(input.stats.sales30d);
  const s7 = n(input.stats.sales7d);
  if (s30 == null && s7 == null) return null;

  const activity = clamp100(
    Math.log10((s30 ?? 0) + 1) * 38 + Math.log10((s7 ?? 0) + 1) * 22,
  );
  const c30 = n(input.stats.change30dPct) ?? 0;
  const momentum = clamp100(50 + c30 * 2.5);

  let scarcity = 50;
  const pop = input.population.psa10 ?? input.stats.psaTotalPopulation;
  if (pop != null && pop > 0) {
    scarcity = clamp100(100 - Math.log10(pop + 1) * 28);
  }

  const activeListings = input.enrichment.platform.activeListingCount ?? 0;
  const listingActivity = clamp100(Math.log10(activeListings + 1) * 42);

  const watchlistCount = input.enrichment.watchlistCount;
  const hasWatchlist = watchlistCount > 0;
  const watchlist = hasWatchlist
    ? clamp100(Math.log10(watchlistCount + 1) * 38)
    : 0;

  const rawWeights = {
    activity: 0.35,
    momentum: 0.25,
    scarcity: 0.15,
    listingActivity: 0.15,
    watchlist: hasWatchlist ? 0.1 : 0,
  };

  const components = buildScoredComponents([
    { key: 'activity', label: 'Activity', score: activity, weight: rawWeights.activity },
    { key: 'momentum', label: 'Momentum', score: momentum, weight: rawWeights.momentum },
    { key: 'scarcity', label: 'Scarcity', score: scarcity, weight: rawWeights.scarcity },
    {
      key: 'listingActivity',
      label: 'Listing Activity',
      score: listingActivity,
      weight: rawWeights.listingActivity,
    },
    ...(hasWatchlist
      ? [{ key: 'watchlist', label: 'Watchlist', score: watchlist, weight: rawWeights.watchlist }]
      : []),
  ]);

  const score = clamp100(
    components.reduce((a, c) => a + c.contribution, 0),
  );

  const reasoning: string[] = [];
  if (s30 != null) reasoning.push(`30-day indexed sales: ${s30}.`);
  if (s7 != null) reasoning.push(`7-day indexed sales: ${s7}.`);
  if (c30 !== 0) {
    reasoning.push(
      `30-day price change ${c30 >= 0 ? '+' : ''}${c30.toFixed(1)}% feeds momentum.`,
    );
  }
  if (pop != null) {
    reasoning.push(`PSA 10 population: ${pop.toLocaleString('en-US')}.`);
  }
  if (activeListings > 0) {
    reasoning.push(`${activeListings} active Tokenable listing(s).`);
  }
  if (hasWatchlist) {
    reasoning.push(`${watchlistCount} user watchlist entr${watchlistCount === 1 ? 'y' : 'ies'}.`);
  }

  return { score, components, reasoning };
}

function opportunityScore(input: AiInsightSectionInput): {
  score: number;
  components: AiInsightScoredComponent[];
} | null {
  const s30 = n(input.stats.sales30d);
  const c30 = n(input.stats.change30dPct);
  const spot = n(input.stats.psa10SpotUsd);
  const fmvUsd = input.fmv?.price ?? null;
  const hasFmv = fmvUsd != null && fmvUsd > 0 && spot != null;

  let scarcity = 50;
  const pop = input.population.psa10 ?? input.stats.psaTotalPopulation;
  if (pop != null && pop > 0) {
    scarcity = clamp100(100 - Math.log10(pop + 1) * 28);
  }

  const momentum = c30 != null ? clamp100(50 + c30 * 2.5) : null;
  const liquidity =
    s30 != null ? clamp100(Math.log10(s30 + 1) * 38) : null;

  let fmvDiscount: number | null = null;
  if (hasFmv && spot != null && fmvUsd != null) {
    const premiumPct = ((spot - fmvUsd) / fmvUsd) * 100;
    fmvDiscount = clamp100(50 - premiumPct * 0.75);
  }

  const entries: Array<{
    key: string;
    label: string;
    score: number;
    weight: number;
  }> = [];

  if (fmvDiscount != null) {
    entries.push({
      key: 'fmvDiscount',
      label: 'FMV Discount',
      score: fmvDiscount,
      weight: 0.3,
    });
  }
  if (momentum != null) {
    entries.push({
      key: 'momentum',
      label: 'Momentum',
      score: momentum,
      weight: 0.25,
    });
  }
  if (liquidity != null) {
    entries.push({
      key: 'liquidity',
      label: 'Liquidity',
      score: liquidity,
      weight: 0.25,
    });
  }
  entries.push({
    key: 'scarcity',
    label: 'Scarcity',
    score: scarcity,
    weight: 0.2,
  });

  const components = buildScoredComponents(entries);
  if (components.length === 0) return null;

  return {
    score: clamp100(components.reduce((a, c) => a + c.contribution, 0)),
    components,
  };
}

function mapMarketCycle(
  marketTone: string | null,
): { label: AiInsightMarketCycleLabel; reasoning: string[] } | null {
  if (!marketTone?.trim()) return null;
  const tone = marketTone.trim().toLowerCase();
  const reasoning: string[] = [`Market tone signal: ${marketTone}.`];

  if (tone.includes('accumulation') || tone.includes('consolidat')) {
    reasoning.push('Price action is range-bound with muted directional momentum.');
    return { label: 'accumulation', reasoning };
  }
  if (
    tone.includes('uptrend') ||
    tone.includes('breakout') ||
    tone.includes('overextended')
  ) {
    reasoning.push('Recent windows show upward price momentum.');
    return {
      label: tone.includes('overextended') ? 'distribution' : 'expansion',
      reasoning,
    };
  }
  if (tone.includes('distribution') || tone.includes('cooling')) {
    reasoning.push('Selling pressure or fading momentum dominates recent windows.');
    return { label: 'distribution', reasoning };
  }
  if (
    tone.includes('correction') ||
    tone.includes('dead cat') ||
    tone.includes('bounce')
  ) {
    reasoning.push('Sharp drawdown or reflex rally after a decline.');
    return { label: 'correction', reasoning };
  }
  if (tone.includes('volatile')) {
    reasoning.push('Wide price swings without a stable directional bias.');
    return { label: 'correction', reasoning };
  }
  if (tone.includes('illiquid') || tone.includes('niche')) {
    reasoning.push('Thin tape limits cycle clarity; treated as early accumulation.');
    return { label: 'accumulation', reasoning };
  }
  return { label: 'expansion', reasoning };
}

function confidenceFromData(input: AiInsightSectionInput): {
  level: AiInsightConfidenceLevel;
  score: number;
  reasoning: string[];
} | null {
  const s30 = input.stats.sales30d ?? 0;
  const points = input.stats.points365d;
  const comps = input.compsRaw.length;
  if (s30 <= 0 && points < 3 && comps < 2) return null;

  let score = 0.35;
  const reasoning: string[] = [];
  score += Math.min(0.25, Math.log10(s30 + 1) * 0.12);
  reasoning.push(`${s30} sales in the last 30 days.`);
  score += Math.min(0.2, points / 40);
  reasoning.push(`${points} price history observations over 365 days.`);
  score += Math.min(0.15, comps / 50);
  reasoning.push(`${comps} comp sales in the Cardhedger feed.`);
  if (input.matchConfidence === 'verified') {
    score += 0.08;
    reasoning.push('Card catalog match is verified.');
  }
  if (input.fmv?.price != null) {
    score += 0.04;
    reasoning.push('Cardhedger FMV reference is available.');
  }
  score = Math.min(0.97, Math.max(0.25, score));
  const level: AiInsightConfidenceLevel =
    score >= 0.72 ? 'high' : score >= 0.48 ? 'medium' : 'low';
  return { level, score: Math.round(score * 1000) / 1000, reasoning };
}

function buildSalesTimeline(
  input: AiInsightSectionInput,
): CollectionAiInsightSections['salesTimeline'] {
  const entries = input.compsRaw
    .filter((c) => Number.isFinite(c.v) && c.v > 0 && Number.isFinite(c.t))
    .sort((a, b) => b.t - a.t)
    .slice(0, 12)
    .map((c) => ({
      date: new Date(c.t * 1000).toISOString(),
      priceUsd: c.v,
      marketplace: c.platform ?? c.priceSource ?? null,
      grade: input.gradeLabel,
    }));
  if (entries.length === 0) return undefined;

  const prices = entries.map((e) => e.priceUsd);
  const recent = prices[0];
  const older = prices[Math.min(prices.length - 1, 3)];
  let trendSummary: string | null = null;
  if (recent != null && older != null && older > 0) {
    const chg = ((recent - older) / older) * 100;
    if (Math.abs(chg) >= 3) {
      trendSummary = `Recent comps ${chg >= 0 ? 'trend higher' : 'trend lower'} (${chg >= 0 ? '+' : ''}${chg.toFixed(1)}% vs older prints in this sample).`;
    } else {
      trendSummary = 'Recent comp prices cluster in a tight band.';
    }
  }
  return {
    dataSources: ['cardhedger:comps'],
    entries,
    trendSummary,
  };
}

function buildMarketStructure(
  input: AiInsightSectionInput,
): CollectionAiInsightSections['marketStructure'] {
  const { stats, enrichment } = input;
  const spotUsd = n(stats.psa10SpotUsd);
  const compPrices = input.compsRaw
    .map((c) => c.v)
    .filter((v) => Number.isFinite(v) && v > 0);
  const compLowUsd =
    n(input.compsLowUsd) ??
    (compPrices.length > 0 ? Math.min(...compPrices) : null);
  const compHighUsd =
    n(input.compsHighUsd) ??
    (compPrices.length > 0 ? Math.max(...compPrices) : null);
  const tokenableFloorUsd = n(enrichment.platform.floorUsd);

  let floorPremiumPct: number | null = null;
  if (spotUsd != null && spotUsd > 0 && tokenableFloorUsd != null) {
    floorPremiumPct =
      Math.round(((tokenableFloorUsd - spotUsd) / spotUsd) * 1000) / 10;
  }

  let listingConcentrationPct: number | null = null;
  const listingPrices = enrichment.platform.listingPricesUsd.filter(
    (p) => Number.isFinite(p) && p > 0,
  );
  if (
    tokenableFloorUsd != null &&
    tokenableFloorUsd > 0 &&
    listingPrices.length > 0
  ) {
    const nearFloor = listingPrices.filter(
      (p) => p <= tokenableFloorUsd * 1.05,
    ).length;
    listingConcentrationPct =
      Math.round((nearFloor / listingPrices.length) * 1000) / 10;
  }

  let marketplaceDistribution: Array<{ label: string; pct: number }> = [];
  if (input.compsRaw.length >= 3) {
    const counts = new Map<string, number>();
    for (const c of input.compsRaw) {
      const label = (c.platform ?? c.priceSource ?? 'Unknown').trim() || 'Unknown';
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const total = input.compsRaw.length;
    marketplaceDistribution = [...counts.entries()]
      .map(([label, count]) => ({
        label,
        pct: Math.round((count / total) * 1000) / 10,
      }))
      .sort((a, b) => b.pct - a.pct);
  }

  const commentary: string[] = [];
  if (spotUsd != null) {
    commentary.push(`PSA 10 spot: $${spotUsd.toLocaleString('en-US')}.`);
  }
  if (compLowUsd != null && compHighUsd != null) {
    commentary.push(
      `Comp range: $${compLowUsd.toLocaleString('en-US')} – $${compHighUsd.toLocaleString('en-US')}.`,
    );
  }
  if (tokenableFloorUsd != null) {
    commentary.push(
      `Tokenable floor: $${tokenableFloorUsd.toLocaleString('en-US')}.`,
    );
  }
  if (floorPremiumPct != null) {
    commentary.push(
      `Floor is ${floorPremiumPct >= 0 ? '+' : ''}${floorPremiumPct.toFixed(1)}% vs spot.`,
    );
  }
  if (listingConcentrationPct != null) {
    commentary.push(
      `${listingConcentrationPct.toFixed(0)}% of listings sit within 5% of floor.`,
    );
  }

  if (
    spotUsd == null &&
    compLowUsd == null &&
    compHighUsd == null &&
    tokenableFloorUsd == null
  ) {
    return undefined;
  }

  return {
    dataSources: ['cardhedger:stats', 'cardhedger:comps', 'tokenable:listings'],
    spotUsd,
    compLowUsd,
    compHighUsd,
    tokenableFloorUsd,
    floorPremiumPct,
    listingConcentrationPct,
    marketplaceDistribution,
    commentary,
  };
}

function buildPsaVerification(
  input: AiInsightSectionInput,
): CollectionAiInsightSections['psaVerification'] {
  const psaFields = parsePsaCertFields(input.enrichment.psaCertSnapshot);
  const listingCert = normalizeCertDigits(input.psaCertNumber);
  const snapshotCert = normalizeCertDigits(psaFields.certNumber);

  const psaVerified = psaFields.isValidRequest;
  const certMatch =
    listingCert != null && snapshotCert != null
      ? listingCert === snapshotCert
      : null;
  const gradeMatch = gradesMatch(
    input.enrichment.listingGradeScore ?? input.gradeLabel,
    psaFields.cardGrade,
  );
  const marketDataCoverage =
    (input.stats.sales30d ?? 0) > 0 || input.compsRaw.length >= 2;

  let trustScore = input.matchConfidence === 'verified' ? 68 : 52;
  const reasoning: string[] = [];

  if (psaVerified === true) {
    trustScore += 10;
    reasoning.push('PSA Public API cert request validated.');
  } else if (psaVerified === false) {
    trustScore -= 15;
    reasoning.push('PSA Public API reported an invalid cert request.');
  }

  if (snapshotCert) {
    trustScore += 8;
    reasoning.push(`PSA snapshot cert #${psaFields.certNumber}.`);
  }
  if (certMatch === true) {
    trustScore += 10;
    reasoning.push('Listing cert number matches PSA snapshot.');
  } else if (certMatch === false) {
    trustScore -= 12;
    reasoning.push('Listing cert number does not match PSA snapshot.');
  }
  if (gradeMatch === true) {
    trustScore += 6;
    reasoning.push('Listing grade aligns with PSA CardGrade.');
  } else if (gradeMatch === false) {
    trustScore -= 8;
    reasoning.push('Listing grade diverges from PSA CardGrade.');
  }
  if (marketDataCoverage) {
    trustScore += 6;
    reasoning.push('External comp/sales history is present.');
  }
  if (input.matchConfidence === 'verified') {
    reasoning.push('Cardhedger catalog match is verified.');
  } else {
    trustScore -= 6;
    reasoning.push('Cardhedger catalog match is approximate.');
  }

  const hasSignal =
    listingCert != null ||
    snapshotCert != null ||
    input.compsRaw.length >= 2 ||
    psaFields.isValidRequest != null;
  if (!hasSignal) return undefined;

  return {
    dataSources: ['psa:cert_snapshot', 'cardhedger:stats', 'cardhedger:comps'],
    psaVerified,
    certMatch,
    gradeMatch,
    marketDataCoverage,
    certification: input.psaCertNumber?.trim() || psaFields.certNumber,
    gradingLabel: input.gradeLabel,
    trustScore: clamp100(trustScore),
    reasoning,
  };
}

function buildFmvSection(
  input: AiInsightSectionInput,
): CollectionAiInsightSections['fmv'] {
  const fmv = input.fmv;
  if (!fmv || fmv.price == null || fmv.price <= 0) return undefined;

  const currentUsd = n(input.stats.psa10SpotUsd);
  let premiumVsFmvPct: number | null = null;
  if (currentUsd != null && currentUsd > 0) {
    premiumVsFmvPct =
      Math.round(((currentUsd - fmv.price) / fmv.price) * 1000) / 10;
  }

  return {
    dataSources: ['cardhedger:fmv', 'cardhedger:stats'],
    currentUsd,
    fmvUsd: fmv.price,
    premiumVsFmvPct,
    confidenceGrade: fmv.confidence_grade,
    method: fmv.method,
    freshnessDays: fmv.freshness_days,
  };
}

function buildGradePremium(
  input: AiInsightSectionInput,
): CollectionAiInsightSections['gradePremium'] {
  const row = input.allPricesRow;
  if (!row) return undefined;

  const gradeDefs = [
    { grade: 'Raw', label: 'Raw' },
    { grade: 'PSA 8', label: 'PSA 8' },
    { grade: 'PSA 9', label: 'PSA 9' },
    { grade: 'PSA 10', label: 'PSA 10' },
  ] as const;

  const grades = gradeDefs
    .map(({ grade, label }) => ({
      grade: label,
      priceUsd: readGradePriceFromRow(row, grade),
    }))
    .filter((g) => g.priceUsd != null);

  if (grades.length < 2) return undefined;

  const raw = grades.find((g) => g.grade === 'Raw')?.priceUsd ?? null;
  const psa8 = grades.find((g) => g.grade === 'PSA 8')?.priceUsd ?? null;
  const psa9 = grades.find((g) => g.grade === 'PSA 9')?.priceUsd ?? null;
  const psa10 = grades.find((g) => g.grade === 'PSA 10')?.priceUsd ?? null;

  let psa10VsRawPct: number | null = null;
  if (psa10 != null && raw != null && raw > 0) {
    psa10VsRawPct = Math.round(((psa10 - raw) / raw) * 1000) / 10;
  }
  let psa10VsPsa9Ratio: number | null = null;
  if (psa10 != null && psa9 != null && psa9 > 0) {
    psa10VsPsa9Ratio = Math.round((psa10 / psa9) * 100) / 100;
  }
  let psa10VsPsa8Ratio: number | null = null;
  if (psa10 != null && psa8 != null && psa8 > 0) {
    psa10VsPsa8Ratio = Math.round((psa10 / psa8) * 100) / 100;
  }

  return {
    dataSources: ['cardhedger:all_prices'],
    grades,
    psa10VsRawPct,
    psa10VsPsa9Ratio,
    psa10VsPsa8Ratio,
  };
}

function buildVolatility(
  input: AiInsightSectionInput,
): CollectionAiInsightSections['volatility'] {
  const v30 = volatilityFromHistory(input.history365, 30);
  const v90 = volatilityFromHistory(input.history90, 90);
  const v365 = volatilityFromHistory(input.history365, 365);

  if (
    v30.volPct == null &&
    v90.volPct == null &&
    v365.volPct == null
  ) {
    return undefined;
  }

  return {
    dataSources: ['cardhedger:history'],
    vol30dPct: v30.volPct,
    vol90dPct: v90.volPct,
    vol365dPct: v365.volPct,
    level30d: v30.level,
    level90d: v90.level,
    level365d: v365.level,
  };
}

function buildCardIdentity(
  input: AiInsightSectionInput,
): CollectionAiInsightSections['cardIdentity'] {
  const c = input.components;
  const facts: Array<{ label: string; value: string }> = [];

  const readStr = (key: string): string | null => {
    const raw = c[key];
    return typeof raw === 'string' && raw.trim() ? raw.trim() : null;
  };
  const readNum = (key: string): number | null => {
    const raw = c[key];
    if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
    return null;
  };

  const year = readNum('year');
  if (year != null && year >= 1880 && year <= 2100) {
    facts.push({ label: 'Year', value: String(Math.trunc(year)) });
  }

  const set =
    readStr('cardSetDisplay') ?? readStr('cardSet');
  if (set) facts.push({ label: 'Set', value: set });

  const company = readStr('gradingCompanyDisplay') ?? readStr('gradingCompany');
  const gradeScore = readStr('gradeScore');
  if (gradeScore) {
    facts.push({
      label: 'Grade',
      value: company ? `${company} ${gradeScore}` : gradeScore,
    });
  }

  const pop =
    readNum('psaGrade10Population') ??
    readNum('psaTotalPopulation') ??
    readNum('psaSpecTotalPopulation');
  if (pop != null && pop > 0) {
    facts.push({ label: 'Population', value: pop.toLocaleString('en-US') });
  }

  const sales7d = readNum('sales7d') ?? readNum('cardhedgerSales7d');
  const sales30d = readNum('sales30d') ?? readNum('cardhedgerSales30d');
  if (sales7d != null && sales7d >= 0) {
    facts.push({ label: '7-day sales', value: String(Math.trunc(sales7d)) });
  }
  if (sales30d != null && sales30d >= 0) {
    facts.push({ label: '30-day sales', value: String(Math.trunc(sales30d)) });
  }

  const category = readStr('psaCategory');
  if (category) facts.push({ label: 'Category', value: category });

  const specTotal = readNum('psaSpecTotalPopulation');
  const grade10 = readNum('psaGrade10Population');
  if (specTotal != null && specTotal > 0 && grade10 != null && grade10 > 0) {
    const share = (grade10 / specTotal) * 100;
    facts.push({
      label: 'Rarity',
      value: `PSA 10 is ${share.toFixed(1)}% of spec population`,
    });
  }

  if (facts.length === 0) return undefined;

  return {
    dataSources: ['tokenable:collection_components'],
    facts,
  };
}

export function buildAiInsightSections(
  input: AiInsightSectionInput,
): CollectionAiInsightSections {
  const sections: CollectionAiInsightSections = {};
  const { stats, enrichment } = input;

  const trendRows = [
    { window: '7d' as const, changePct: n(stats.change7dPct) },
    { window: '30d' as const, changePct: n(stats.change30dPct) },
    { window: '90d' as const, changePct: n(stats.change90dPct) },
    { window: '365d' as const, changePct: n(stats.change365dPct) },
  ].filter((t) => t.changePct != null);

  const perfCommentary: string[] = [];
  for (const t of trendRows) {
    const line = pctChangeSentence(t.window, t.changePct);
    if (line) perfCommentary.push(line);
  }
  const vol = volumeNote(n(stats.sales7d), n(stats.sales30d));
  if (vol) perfCommentary.push(vol);
  if (n(stats.sales30d) != null && (stats.sales30d ?? 0) >= 10) {
    perfCommentary.push('Recent sales indicate sustained marketplace participation.');
  } else if ((stats.sales30d ?? 0) > 0 && (stats.sales30d ?? 0) < 5) {
    perfCommentary.push('Sales are sparse — treat individual prints cautiously.');
  }
  if (perfCommentary.length > 0) {
    sections.marketPerformance = {
      dataSources: ['cardhedger:stats', 'cardhedger:history'],
      commentary: perfCommentary,
      trends: trendRows,
      volumeNote: vol,
    };
  }

  const compPrices = input.compsRaw
    .map((c) => c.v)
    .filter((v) => Number.isFinite(v) && v > 0);
  const lowestUsd =
    n(input.compsLowUsd) ??
    (compPrices.length > 0 ? Math.min(...compPrices) : n(stats.psa10SpotLowUsd));
  const highestUsd =
    n(input.compsHighUsd) ??
    (compPrices.length > 0 ? Math.max(...compPrices) : n(stats.psa10SpotHighUsd));
  const medianSaleUsd = medianUsd(compPrices);
  const sortedComps = [...input.compsRaw]
    .filter((c) => c.v > 0 && c.t > 0)
    .sort((a, b) => b.t - a.t);
  const recentSaleUsd = sortedComps[0]?.v ?? null;
  const priceLabel = classifyPriceTrend(stats, input.history90);
  const priceCommentary: string[] = [];
  if (priceLabel === 'breakout') {
    priceCommentary.push('Price action shows breakout momentum on recent windows.');
  } else if (priceLabel === 'cooling') {
    priceCommentary.push('Market is cooling on recent price windows.');
  } else if (priceLabel === 'consolidation') {
    priceCommentary.push('Prices are consolidating within a defined range.');
  } else if (priceLabel === 'stable') {
    priceCommentary.push('Pricing has remained relatively stable.');
  } else if (priceLabel === 'volatile') {
    priceCommentary.push('Price swings are elevated relative to recent history.');
  }
  if (medianSaleUsd != null && recentSaleUsd != null) {
    const diff = ((recentSaleUsd - medianSaleUsd) / medianSaleUsd) * 100;
    if (Math.abs(diff) >= 8) {
      priceCommentary.push(
        `Latest comp is ${diff >= 0 ? 'above' : 'below'} the sample median by ${Math.abs(diff).toFixed(0)}%.`,
      );
    }
  }
  if (
    priceCommentary.length > 0 ||
    lowestUsd != null ||
    highestUsd != null ||
    medianSaleUsd != null
  ) {
    sections.priceTrend = {
      dataSources: ['cardhedger:comps', 'cardhedger:stats', 'cardhedger:history'],
      label: priceLabel,
      commentary: priceCommentary,
      lowestUsd,
      highestUsd,
      medianSaleUsd,
      recentSaleUsd,
    };
  }

  const marketStructure = buildMarketStructure(input);
  if (marketStructure) sections.marketStructure = marketStructure;

  const s30 = n(stats.sales30d);
  const activeListings = enrichment.platform.activeListingCount ?? 0;
  const liqLevel = liquidityLevel(s30);
  const avgDays = avgDaysBetweenSales(input.compsRaw);
  let listingToSaleRatio: number | null = null;
  if (s30 != null) {
    listingToSaleRatio =
      Math.round((activeListings / Math.max(s30, 1)) * 100) / 100;
  }

  const liqCommentary: string[] = [];
  if (liqLevel === 'healthy') {
    liqCommentary.push('Liquidity remains healthy with frequent transaction activity.');
  } else if (liqLevel === 'moderate') {
    liqCommentary.push('Liquidity is moderate — adequate for price discovery with some gaps.');
  } else if (liqLevel === 'thin') {
    liqCommentary.push('Liquidity is thin — wider spreads and fewer reference prints.');
  } else if (liqLevel === 'very_thin') {
    liqCommentary.push('Liquidity is very thin — individual sales can skew readings.');
  }
  if (avgDays != null) {
    liqCommentary.push(
      `Average ${avgDays.toFixed(1)} days between indexed comp sales in the sample.`,
    );
  }
  if (activeListings > 0) {
    liqCommentary.push(
      `${activeListings} active listing${activeListings === 1 ? '' : 's'} on Tokenable.`,
    );
  }
  if (listingToSaleRatio != null) {
    if (listingToSaleRatio > 1.5) {
      liqCommentary.push(
        `Listing-to-sale ratio is ${listingToSaleRatio.toFixed(2)} — supply exceeds recent turnover.`,
      );
    } else if (listingToSaleRatio < 0.3) {
      liqCommentary.push(
        `Listing-to-sale ratio is ${listingToSaleRatio.toFixed(2)} — listings are scarce vs sales pace.`,
      );
    } else {
      liqCommentary.push(
        `Listing-to-sale ratio is ${listingToSaleRatio.toFixed(2)} — balanced listing supply vs sales.`,
      );
    }
  }
  if (liqCommentary.length > 0) {
    sections.liquidity = {
      dataSources: ['cardhedger:stats', 'cardhedger:comps', 'tokenable:listings'],
      level: liqLevel,
      commentary: liqCommentary,
      sales7d: n(stats.sales7d),
      sales30d: s30,
      avgDaysBetweenSales: avgDays,
      tokenableActiveListings: activeListings > 0 ? activeListings : null,
      listingToSaleRatio,
    };
  }

  const demand = demandScore(input);
  if (demand) {
    sections.demand = {
      dataSources: [
        'cardhedger:stats',
        'tokenable:listings',
        'db:user_watchlist',
        'psa:population',
      ],
      ...demand,
    };
  }

  const pops: { label: string; count: number }[] = [];
  if (input.population.psa10 != null && input.population.psa10 > 0) {
    pops.push({ label: 'PSA 10', count: input.population.psa10 });
  }
  if (input.population.psa9 != null && input.population.psa9 > 0) {
    pops.push({ label: 'PSA 9', count: input.population.psa9 });
  }
  let gradeDistribution: { label: string; count: number }[] = [];
  if (input.population.hasCompleteByGrade && input.population.byGrade) {
    gradeDistribution = Object.entries(input.population.byGrade)
      .filter(([, count]) => count > 0)
      .sort(([a], [b]) => Number(b) - Number(a))
      .map(([g, count]) => ({ label: `PSA ${g}`, count }));
  } else if (input.population.byGrade) {
    for (const [g, count] of Object.entries(input.population.byGrade)) {
      if (count > 0 && g !== '10' && g !== '9') {
        pops.push({ label: `PSA ${g}`, count });
      }
    }
  }

  let psa10SharePct: number | null = null;
  if (
    input.population.specTotal != null &&
    input.population.specTotal > 0 &&
    input.population.psa10 != null
  ) {
    psa10SharePct =
      Math.round(
        (input.population.psa10 / input.population.specTotal) * 1000,
      ) / 10;
  }

  let scarcityRatio10vs9: number | null = null;
  if (
    input.population.psa10 != null &&
    input.population.psa9 != null &&
    input.population.psa9 > 0
  ) {
    scarcityRatio10vs9 =
      Math.round((input.population.psa10 / input.population.psa9) * 1000) /
      1000;
  }

  const rarityCommentary: string[] = [];
  if (scarcityRatio10vs9 != null) {
    if (scarcityRatio10vs9 < 0.25) {
      rarityCommentary.push(
        `PSA 10 count is ${scarcityRatio10vs9.toFixed(2)}× PSA 9 — extremely constrained gem supply.`,
      );
    } else if (scarcityRatio10vs9 < 0.5) {
      rarityCommentary.push(
        `PSA 10 count is ${scarcityRatio10vs9.toFixed(2)}× PSA 9 — materially scarcer top grade.`,
      );
    } else {
      rarityCommentary.push(
        `PSA 10-to-9 population ratio: ${scarcityRatio10vs9.toFixed(2)}.`,
      );
    }
  }
  if (psa10SharePct != null && psa10SharePct < 20) {
    rarityCommentary.push(
      `PSA 10 represents ${psa10SharePct.toFixed(1)}% of graded copies for this spec.`,
    );
  }
  if (pops.length > 0 || gradeDistribution.length > 0) {
    sections.rarity = {
      dataSources: ['psa:population', 'tokenable:collection_components'],
      commentary: rarityCommentary,
      populations: pops,
      psa10SharePct,
      scarcityRatio10vs9,
      gradeDistribution,
    };
  }

  const fmvSection = buildFmvSection(input);
  if (fmvSection) sections.fmv = fmvSection;

  const gradePremium = buildGradePremium(input);
  if (gradePremium) sections.gradePremium = gradePremium;

  const bull: string[] = [];
  const bear: string[] = [];
  const risks: string[] = [];

  const c30 = n(stats.change30dPct);
  const c90 = n(stats.change90dPct);
  const c365 = n(stats.change365dPct);

  if (fmvSection?.premiumVsFmvPct != null && fmvSection.premiumVsFmvPct < -5) {
    bull.push(
      `Spot trades ${Math.abs(fmvSection.premiumVsFmvPct).toFixed(1)}% below Cardhedger FMV ($${fmvSection.fmvUsd?.toLocaleString('en-US')}).`,
    );
  }
  if (fmvSection?.premiumVsFmvPct != null && fmvSection.premiumVsFmvPct > 10) {
    bear.push(
      `Spot is ${fmvSection.premiumVsFmvPct.toFixed(1)}% above Cardhedger FMV ($${fmvSection.fmvUsd?.toLocaleString('en-US')}).`,
    );
  }
  if (marketStructure?.floorPremiumPct != null && marketStructure.floorPremiumPct < -3) {
    bull.push(
      `Tokenable floor is ${Math.abs(marketStructure.floorPremiumPct).toFixed(1)}% below spot.`,
    );
  }
  if (marketStructure?.floorPremiumPct != null && marketStructure.floorPremiumPct > 8) {
    bear.push(
      `Tokenable floor is ${marketStructure.floorPremiumPct.toFixed(1)}% above spot.`,
    );
  }
  if (c90 != null && c90 > 5) {
    bull.push(`90-day price change: +${c90.toFixed(1)}%.`);
  }
  if (c30 != null && c30 > 5) {
    bull.push(`30-day price change: +${c30.toFixed(1)}%.`);
  }
  if (c90 != null && c90 < -5) {
    bear.push(`90-day price change: ${c90.toFixed(1)}%.`);
  }
  if (c365 != null && c365 < -10) {
    bear.push(`365-day price change: ${c365.toFixed(1)}%.`);
  }
  if ((stats.sales30d ?? 0) >= 20) {
    bull.push(`${stats.sales30d} indexed sales in 30 days.`);
  }
  if (sections.liquidity?.listingToSaleRatio != null && sections.liquidity.listingToSaleRatio < 0.4) {
    bull.push(
      `Listing-to-sale ratio ${sections.liquidity.listingToSaleRatio.toFixed(2)} — demand outpaces listed supply.`,
    );
  }
  if (sections.liquidity?.listingToSaleRatio != null && sections.liquidity.listingToSaleRatio > 1.2) {
    bear.push(
      `Listing-to-sale ratio ${sections.liquidity.listingToSaleRatio.toFixed(2)} — listed supply exceeds recent sales.`,
    );
  }
  if (input.population.psa10 != null && input.population.psa10 < 500) {
    bull.push(`PSA 10 population: ${input.population.psa10.toLocaleString('en-US')}.`);
  }
  if (scarcityRatio10vs9 != null && scarcityRatio10vs9 < 0.35) {
    bull.push(`PSA 10/9 scarcity ratio: ${scarcityRatio10vs9.toFixed(2)}.`);
  }
  if ((stats.sales30d ?? 0) < 8) {
    bear.push(`30-day sales count: ${stats.sales30d ?? 0}.`);
  }
  if (input.riskLabel === 'High') {
    risks.push(`Tape risk rated High (${input.riskScore ?? 'n/a'}/100).`);
  }
  if (stats.psa10PriceConfidence === 'low') {
    risks.push('PSA 10 spot price confidence: low.');
  }
  if ((stats.sales30d ?? 0) < 5) {
    risks.push('Low 30-day sales volume.');
  }
  if (fmvSection?.confidenceGrade === 'D') {
    risks.push('Cardhedger FMV confidence grade: D.');
  }
  if (bull.length > 0 || bear.length > 0 || risks.length > 0) {
    sections.investmentThesis = {
      dataSources: [
        'cardhedger:fmv',
        'cardhedger:stats',
        'cardhedger:comps',
        'tokenable:listings',
        'psa:population',
      ],
      bullCase: bull,
      bearCase: bear,
      keyRisks: risks,
    };
  }

  const timeline = buildSalesTimeline(input);
  if (timeline) sections.salesTimeline = timeline;

  const psaVerification = buildPsaVerification(input);
  if (psaVerification) sections.psaVerification = psaVerification;

  const volatility = buildVolatility(input);
  if (volatility) sections.volatility = volatility;

  const cycle = mapMarketCycle(input.marketTone);
  if (cycle) {
    sections.marketCycle = {
      dataSources: ['cardhedger:stats', 'cardhedger:history'],
      label: cycle.label,
      reasoning: cycle.reasoning,
    };
  }

  const top100 = enrichment.top100Rank;
  if (top100) {
    sections.marketRank = {
      dataSources: ['db:card_top100_daily_snapshots'],
      rank: top100.rank,
      category: top100.category,
      rankChange30d: top100.rankChange30d,
      percentile: Math.round(((101 - top100.rank) / 100) * 100),
    };
  }

  const opportunity = opportunityScore(input);
  if (opportunity) {
    sections.opportunity = {
      dataSources: [
        'cardhedger:fmv',
        'cardhedger:stats',
        'tokenable:listings',
        'psa:population',
      ],
      ...opportunity,
    };
  }

  const cardIdentity = buildCardIdentity(input);
  if (cardIdentity) sections.cardIdentity = cardIdentity;

  const paragraphs: string[] = [];
  if (input.marketTone) {
    paragraphs.push(
      `${input.displayLabel}: market tone is ${input.marketTone} based on Cardhedger price and sales windows.`,
    );
  }
  if (sections.marketCycle) {
    paragraphs.push(
      `Cycle phase: ${sections.marketCycle.label} — ${sections.marketCycle.reasoning[0]}`,
    );
  }
  if (sections.marketPerformance?.commentary[0]) {
    paragraphs.push(sections.marketPerformance.commentary[0]);
  }
  if (sections.marketStructure?.commentary[0]) {
    paragraphs.push(sections.marketStructure.commentary[0]);
  }
  if (fmvSection?.premiumVsFmvPct != null) {
    paragraphs.push(
      `FMV premium vs spot: ${fmvSection.premiumVsFmvPct >= 0 ? '+' : ''}${fmvSection.premiumVsFmvPct.toFixed(1)}% (FMV $${fmvSection.fmvUsd?.toLocaleString('en-US')}).`,
    );
  }
  if (sections.liquidity?.commentary[0]) {
    paragraphs.push(sections.liquidity.commentary[0]);
  }
  if (sections.rarity?.commentary[0]) {
    paragraphs.push(sections.rarity.commentary[0]);
  }
  if (demand) {
    paragraphs.push(`Collector demand score: ${demand.score}/100.`);
  }
  if (opportunity) {
    paragraphs.push(`Opportunity score: ${opportunity.score}/100.`);
  }
  if (sections.marketRank) {
    paragraphs.push(
      `Top-100 rank #${sections.marketRank.rank} in ${sections.marketRank.category}.`,
    );
  }
  if (input.riskLabel) {
    paragraphs.push(`Risk assessment: ${input.riskLabel} (${input.riskScore ?? 'n/a'}/100).`);
  }
  if (paragraphs.length > 0) {
    sections.executiveSummary = {
      dataSources: ['cardhedger:stats', 'cardhedger:comps', 'cardhedger:fmv'],
      paragraphs: paragraphs.slice(0, 6),
    };
  }

  const conf = confidenceFromData(input);
  if (conf) {
    sections.confidence = {
      dataSources: ['cardhedger:stats', 'cardhedger:comps', 'cardhedger:history'],
      ...conf,
    };
  }

  return sections;
}

/** Normalize 365d history into up to 12 chart points (real data, not synthetic). */
export function historyToMiniSeries(
  history365: Array<{ t: number; v: number }>,
): number[] {
  const pts = history365.filter((p) => p.v > 0);
  if (pts.length < 2) return [];
  if (pts.length <= 12) return pts.map((p) => p.v);
  const buckets: number[] = [];
  const step = pts.length / 12;
  for (let i = 0; i < 12; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    const slice = pts.slice(start, Math.max(start + 1, end));
    const avg = slice.reduce((a, p) => a + p.v, 0) / slice.length;
    buckets.push(Math.round(avg * 100) / 100);
  }
  return buckets;
}
