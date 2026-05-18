import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import sharp from 'sharp';
import { CardhedgerService } from '../cardhedger/cardhedger.service';
import {
  normalizeForExactCardNumberKey,
  normalizeForExactCatalogMatch,
  primaryCardNumber,
} from '../marketplace/utils/card-match.util';
import { normalizeImageUrl } from '../marketplace/utils/collection-image.util';
import { readPsaSpecIdCardhedgerMapFromConfig } from '../marketplace/utils/psa-spec-cardhedger-map.util';
import {
  psaCertVerifyUrl,
  resolveCertHintForLookup,
  type ParsedPsaLabel,
} from './utils/psa-ocr.util';
import {
  mergePsaApiIntoParsed,
  PsaPublicApiService,
  type PsaGetImagesLookupResult,
  type PsaPublicApiLookupResult,
} from './psa-public-api.service';
import {
  extractPsaCertImageUrlsFromApiBody,
  extractPsaCertImagesFromGetImagesBody,
} from './utils/psa-cert-images.util';

export interface CardhedgerOcrNormalized {
  raw_text: string;
  parsed_entities: {
    card_name: string;
    set: string;
    year: string;
    card_number: string;
    cert_number: string;
    grade: string;
    autograph_detected: boolean;
    signer_guess: string | null;
  };
  confidence: number; // 0..1
}

export interface PsaAnalyzeResult {
  ocr: {
    /** CardHedger OCR output only (no local OCR engines). */
    cardhedger: {
      front: CardhedgerOcrNormalized;
      back?: CardhedgerOcrNormalized;
      combined: CardhedgerOcrNormalized;
    };
    /** Back-compat: derived from CardHedger OCR (no Tesseract). */
    combinedText: string;
    /** Back-compat: derived from CardHedger OCR (no Tesseract). */
    frontText?: string;
    /** Back-compat: derived from CardHedger OCR (no Tesseract). */
    backText?: string;
  };
  psa: ParsedPsaLabel & {
    certVerifyUrl?: string;
    /** True when PSA Public API returned PSACert and fields were merged */
    enrichedFromOfficialApi?: boolean;
  };
  /**
   * Two-layer identity to prevent PSA vs PSA/DNA market collapse.
   * - `base_card` is used for Cardhedger matching (no autograph terms).
   * - `variant` classifies the collectible market (graded vs autograph).
   */
  identity?: {
    base_card: {
      year?: string;
      set?: string;
      card_number?: string;
      card_name?: string;
      base_identity: string;
    };
    variant: {
      variant_type: 'PSA' | 'PSA_DNA';
      has_autograph: boolean;
      signer?: string;
      auto_grade?: string;
    };
    market_type: 'graded' | 'autograph';
    pricing_source: 'CardHedger';
    confidence_split: {
      base_match: number; // 0..1
      variant_match: number; // 0..1
    };
  };
  /** PSA Public API (optional; needs PSA_PUBLIC_API_TOKEN). `lookup` includes full body on success. */
  psaApi: {
    lookup: PsaPublicApiLookupResult;
  };
  /** Cardhedger card id resolved after PSA metadata merge */
  cardhedgerMint?: {
    matchConfidence: 'verified' | 'approximate';
    cardId?: string;
    searchQuery?: string;
    imageUrl?: string;
  };
  /** PSA GetImages / GetByCertNumber에서 가져온 슬랩 사진 URL (앞면은 민팅 imageUrl 후보) */
  psaCertImages?: { front?: string; back?: string };
}

async function probeCertImageUrlReachable(url: string): Promise<boolean> {
  try {
    const headers = { 'User-Agent': 'TokenableBackend/1.0 (PSA image probe)' };
    const head = await fetch(url, {
      method: 'HEAD',
      signal: AbortSignal.timeout(10_000),
      headers,
    });
    if (head.ok) return true;
    const get = await fetch(url, {
      method: 'GET',
      headers: { ...headers, Range: 'bytes=0-2047' },
      signal: AbortSignal.timeout(12_000),
    });
    return get.ok;
  } catch {
    return false;
  }
}

@Injectable()
export class PsaService {
  private readonly logger = new Logger(PsaService.name);
  /** Lazy-cached PSA `specId` → Cardhedger `card_id` map (env JSON parsed once). */
  private psaSpecIdMap: Map<string, string> | null = null;

  constructor(
    private readonly psaPublicApi: PsaPublicApiService,
    private readonly cardhedgerService: CardhedgerService,
    private readonly config: ConfigService,
  ) {}

  private getPsaSpecIdMap(): Map<string, string> {
    if (!this.psaSpecIdMap) {
      this.psaSpecIdMap = readPsaSpecIdCardhedgerMapFromConfig(this.config);
    }
    return this.psaSpecIdMap;
  }

  private static readonly MAX_COMBINED_OCR_CHARS = 150_000;

  private async preprocess(buffer: Buffer): Promise<Buffer> {
    return sharp(buffer)
      .resize({
        width: 2200,
        height: 2200,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .greyscale()
      .normalize()
      .png()
      .toBuffer();
  }

  private static clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0;
    if (n < 0) return 0;
    if (n > 1) return 1;
    return n;
  }

  private static normalizeOcrEntitiesFromCardhedger(
    raw: unknown,
  ): CardhedgerOcrNormalized {
    const obj = (typeof raw === 'object' && raw != null ? raw : {}) as Record<
      string,
      unknown
    >;
    const certInfo =
      (typeof obj.cert_info === 'object' && obj.cert_info != null
        ? (obj.cert_info as Record<string, unknown>)
        : {}) ?? {};
    const card =
      (typeof obj.card === 'object' && obj.card != null
        ? (obj.card as Record<string, unknown>)
        : {}) ?? {};

    const cert_number =
      typeof certInfo.cert === 'string'
        ? certInfo.cert
        : typeof certInfo.cert === 'number'
          ? String(certInfo.cert)
          : '';

    const card_name =
      typeof card.name === 'string'
        ? card.name
        : typeof card.description === 'string'
          ? card.description
          : '';

    const set =
      typeof card.set === 'string'
        ? card.set
        : typeof (card.set as { name?: unknown } | undefined)?.name === 'string'
          ? String((card.set as { name?: unknown }).name)
          : '';

    const year =
      typeof card.year === 'string'
        ? card.year
        : typeof card.year === 'number'
          ? String(card.year)
          : '';

    const card_number =
      typeof card.number === 'string'
        ? card.number
        : typeof card.cardNumber === 'string'
          ? card.cardNumber
          : '';

    const grade =
      typeof certInfo.grade === 'string'
        ? certInfo.grade
        : typeof certInfo.grade_label === 'string'
          ? certInfo.grade_label
          : typeof certInfo.gradeScore === 'string'
            ? certInfo.gradeScore
            : typeof certInfo.gradeScore === 'number'
              ? String(certInfo.gradeScore)
              : '';

    const autograph_detected =
      Boolean(
        (typeof certInfo.psa_type === 'string' &&
          /DNA/i.test(certInfo.psa_type)) ||
        (typeof certInfo.label_type === 'string' &&
          /DNA/i.test(certInfo.label_type)) ||
        (typeof certInfo.autograph === 'boolean' &&
          certInfo.autograph === true) ||
        (typeof certInfo.autograph_grade === 'string' &&
          certInfo.autograph_grade.trim().length > 0),
      ) || false;

    const signer_guess =
      typeof certInfo.signer === 'string' && certInfo.signer.trim()
        ? certInfo.signer.trim()
        : null;

    const raw_text_parts = [
      cert_number ? `CERT ${cert_number}` : '',
      grade ? `GRADE ${grade}` : '',
      card_name,
      set,
      year,
      card_number ? `#${card_number}` : '',
      autograph_detected ? 'AUTO' : '',
      signer_guess ? `SIGNER ${signer_guess}` : '',
    ].filter(Boolean);
    const raw_text = raw_text_parts.join(' ').trim();

    // CardHedger endpoint doesn't currently return explicit confidence; keep deterministic.
    const confidence = PsaService.clamp01(
      autograph_detected || cert_number ? 0.9 : card_name ? 0.75 : 0.3,
    );

    return {
      raw_text,
      parsed_entities: {
        card_name: String(card_name ?? '').trim(),
        set: String(set ?? '').trim(),
        year: String(year ?? '').trim(),
        card_number: String(card_number ?? '')
          .replace(/^#/, '')
          .trim(),
        cert_number: String(cert_number ?? '')
          .replace(/\D/g, '')
          .trim(),
        grade: String(grade ?? '').trim(),
        autograph_detected,
        signer_guess,
      },
      confidence,
    };
  }

  private static combineNormalizedOcr(
    front: CardhedgerOcrNormalized,
    back?: CardhedgerOcrNormalized,
  ): CardhedgerOcrNormalized {
    const pick = (a: string, b: string): string => (a && a.trim() ? a : b);
    return {
      raw_text: [front.raw_text, back?.raw_text]
        .filter(Boolean)
        .join('\n---\n')
        .trim(),
      parsed_entities: {
        card_name: pick(
          front.parsed_entities.card_name,
          back?.parsed_entities.card_name ?? '',
        ),
        set: pick(front.parsed_entities.set, back?.parsed_entities.set ?? ''),
        year: pick(
          front.parsed_entities.year,
          back?.parsed_entities.year ?? '',
        ),
        card_number: pick(
          front.parsed_entities.card_number,
          back?.parsed_entities.card_number ?? '',
        ),
        cert_number: pick(
          front.parsed_entities.cert_number,
          back?.parsed_entities.cert_number ?? '',
        ),
        grade: pick(
          front.parsed_entities.grade,
          back?.parsed_entities.grade ?? '',
        ),
        autograph_detected:
          Boolean(front.parsed_entities.autograph_detected) ||
          Boolean(back?.parsed_entities.autograph_detected),
        signer_guess:
          front.parsed_entities.signer_guess ??
          back?.parsed_entities.signer_guess ??
          null,
      },
      confidence: PsaService.clamp01(
        Math.max(front.confidence, back?.confidence ?? 0),
      ),
    };
  }

  private static psaParsedFromNormalizedOcr(
    n: CardhedgerOcrNormalized,
  ): ParsedPsaLabel {
    const e = n.parsed_entities;
    const gradeLabel = e.grade || undefined;
    const digits = e.cert_number
      ? resolveCertHintForLookup(e.cert_number)
      : undefined;
    const year = e.year ? e.year.replace(/\D/g, '').slice(0, 4) : undefined;
    const cardNumberHint = e.card_number
      ? e.card_number.replace(/^#/, '').trim()
      : undefined;
    const cardNameHint = e.card_name || undefined;
    const setHint = e.set || undefined;

    // gradeScore is optional and should not be inferred beyond explicit numeric text.
    let gradeScore: number | undefined;
    const m = e.grade.match(/(\d+(?:\.\d+)?)/);
    if (m) {
      const num = parseFloat(m[1]);
      if (!Number.isNaN(num)) gradeScore = num;
    }

    return {
      ...(digits ? { certNumber: digits } : {}),
      ...(gradeLabel ? { gradeLabel } : {}),
      ...(gradeScore != null ? { gradeScore } : {}),
      ...(year ? { year } : {}),
      ...(cardNameHint ? { cardNameHint } : {}),
      ...(cardNumberHint ? { cardNumberHint } : {}),
      ...(setHint ? { setHint } : {}),
    };
  }

  private async tryResolveByCardhedgerCertOcr(image: Buffer): Promise<{
    certCandidates: string[];
    normalized: CardhedgerOcrNormalized;
    cardId?: string;
    searchQuery?: string;
    imageUrl?: string;
  }> {
    // HARD ENFORCEMENT: all OCR must be CardHedger OCR API.
    this.cardhedgerService.assertConfigured();
    try {
      const jpg = await sharp(image)
        .resize({ width: 1800, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();
      const b64 = jpg.toString('base64');

      const tryBodies: Array<Record<string, unknown>> = [
        { image_base64: b64 },
        { image_base64: `data:image/jpeg;base64,${b64}` },
      ];
      for (const body of tryBodies) {
        const raw = await this.cardhedgerService.forwardJson(
          'POST',
          '/v1/cards/details-by-cert-ocr',
          { body },
        );
        if (typeof raw !== 'object' || raw == null) continue;
        const normalized = PsaService.normalizeOcrEntitiesFromCardhedger(raw);
        const cert = resolveCertHintForLookup(
          normalized.parsed_entities.cert_number,
        );
        const card = (raw as { card?: unknown }).card as
          | Record<string, unknown>
          | undefined;
        const cardId =
          typeof card?.card_id === 'string' && card.card_id.trim()
            ? card.card_id.trim()
            : undefined;
        const searchQuery =
          typeof card?.description === 'string' && card.description.trim()
            ? card.description.trim()
            : undefined;
        const imageUrl =
          typeof card?.image === 'string' && card.image.trim()
            ? card.image.trim()
            : undefined;
        return {
          certCandidates: cert ? [cert] : [],
          normalized,
          ...(cardId ? { cardId } : {}),
          ...(searchQuery ? { searchQuery } : {}),
          ...(imageUrl ? { imageUrl } : {}),
        };
      }
      return {
        certCandidates: [],
        normalized: {
          raw_text: '',
          parsed_entities: {
            card_name: '',
            set: '',
            year: '',
            card_number: '',
            cert_number: '',
            grade: '',
            autograph_detected: false,
            signer_guess: null,
          },
          confidence: 0,
        },
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`Cardhedger OCR failed: ${msg}`);
      throw new InternalServerErrorException(
        'CardHedger OCR 처리에 실패했습니다. CARDHEDGER_API_KEY 설정 및 업스트림 상태를 확인하세요.',
      );
    }
  }

  private async tryResolveCardhedgerMint(
    searchQueryRaw: string,
    hints: { cardName: string; cardNumber: string; cardSet?: string },
  ): Promise<PsaAnalyzeResult['cardhedgerMint'] | undefined> {
    try {
      this.cardhedgerService.assertConfigured();
    } catch {
      return undefined;
    }

    const searchQuery = searchQueryRaw.trim();
    if (!searchQuery) return undefined;

    const cardNameWant = normalizeForExactCatalogMatch(hints.cardName);
    const cardSetWant = normalizeForExactCatalogMatch(hints.cardSet ?? '');
    const cardNumWant = normalizeForExactCardNumberKey(
      primaryCardNumber(hints.cardNumber),
    );
    if (!cardNameWant && !cardNumWant && !cardSetWant) return undefined;

    const body = await this.cardhedgerService.forwardJson(
      'POST',
      '/v1/cards/card-search',
      {
        body: { search: searchQuery, page: 1, page_size: 25 },
      },
    );
    const cards = Array.isArray((body as { cards?: unknown[] })?.cards)
      ? ((body as { cards: unknown[] }).cards ?? [])
      : [];
    if (cards.length === 0) return undefined;

    const scored = cards
      .filter(
        (x): x is Record<string, unknown> => typeof x === 'object' && x != null,
      )
      .map((row) => {
        const idRaw = row.card_id;
        const id = typeof idRaw === 'string' ? idRaw.trim() : '';
        const desc = normalizeForExactCatalogMatch(
          String(row.description ?? row.name ?? ''),
        );
        const set = normalizeForExactCatalogMatch(String(row.set ?? ''));
        const num = normalizeForExactCardNumberKey(
          primaryCardNumber(String(row.number ?? '')),
        );

        let score = 0;
        const numMatch = Boolean(cardNumWant && num && cardNumWant === num);
        const setMatch = Boolean(
          cardSetWant &&
          set &&
          (set.includes(cardSetWant) || cardSetWant.includes(set)),
        );
        // Fuzzy name match: all normalized words in cardNameWant appear in desc
        const nameWords = cardNameWant
          ? (cardNameWant.match(/[a-z0-9]+/g) ?? [])
          : [];
        const nameFuzzyMatch =
          nameWords.length > 0 && nameWords.every((w) => desc.includes(w));
        const nameExactMatch = Boolean(
          cardNameWant &&
          desc &&
          (desc.includes(cardNameWant) || cardNameWant.includes(desc)),
        );
        const nameMatch = nameExactMatch || nameFuzzyMatch;

        if (numMatch) score += 100;
        if (setMatch) score += 60;
        if (nameMatch) score += 50;

        // verified = number must match AND at least one of (set OR name) must match
        // This is more robust than requiring all three, because PSA and Cardhedger
        // use different set name conventions (e.g. "POKEMON JAPANESE BASIC" vs "Pokemon Japanese Base Set")
        const verified = numMatch && (setMatch || nameMatch);

        return { id, score, verified };
      })
      .filter((r) => r.id.length > 0 && r.score > 0)
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

    const pick = scored[0];
    if (!pick) return undefined;
    // Accuracy-first: persist Cardhedger id only for strict verified matches.
    if (!pick.verified) return undefined;

    // Extract image from the search result row if present
    const matchedRow = cards
      .filter(
        (x): x is Record<string, unknown> => typeof x === 'object' && x != null,
      )
      .find(
        (r) => typeof r.card_id === 'string' && r.card_id.trim() === pick.id,
      );
    const imageUrl =
      typeof matchedRow?.image === 'string' && matchedRow.image.trim()
        ? normalizeImageUrl(matchedRow.image)
        : undefined;

    return {
      matchConfidence: 'verified',
      cardId: pick.id,
      searchQuery,
      ...(imageUrl ? { imageUrl } : {}),
    };
  }

  /**
   * Curated {@link readPsaSpecIdCardhedgerMapFromConfig}: when PSA Public API returns `specId`
   * and it is mapped to a Cardhedger catalog id, mint metadata can persist a stable `cardId`.
   */
  private async tryResolveCardhedgerMintFromPsaSpecMap(
    psaParsed: ParsedPsaLabel,
    fallbackSearchQuery: string,
  ): Promise<PsaAnalyzeResult['cardhedgerMint'] | undefined> {
    const rawSpec = psaParsed.specId;
    if (rawSpec == null || !Number.isFinite(Number(rawSpec))) return undefined;
    try {
      this.cardhedgerService.assertConfigured();
    } catch {
      return undefined;
    }
    const specKey = String(Math.floor(Number(rawSpec)));
    const cardIdMapped = this.getPsaSpecIdMap().get(specKey);
    if (!cardIdMapped) return undefined;
    try {
      const body = await this.cardhedgerService.forwardJson(
        'POST',
        '/v1/cards/card-details',
        { body: { card_id: cardIdMapped } },
      );
      const cards = (body as { cards?: unknown[] }).cards;
      if (!Array.isArray(cards) || cards.length === 0) return undefined;
      const row = cards[0] as Record<string, unknown>;
      const id =
        typeof row.card_id === 'string' && row.card_id.trim()
          ? row.card_id.trim()
          : '';
      if (!id) return undefined;
      const searchFromRow =
        typeof row.description === 'string' && row.description.trim()
          ? row.description.trim()
          : typeof row.name === 'string' && row.name.trim()
            ? row.name.trim()
            : fallbackSearchQuery.trim();
      const imageUrl =
        typeof row.image === 'string' && row.image.trim()
          ? normalizeImageUrl(row.image)
          : undefined;
      return {
        matchConfidence: 'verified',
        cardId: id,
        searchQuery: searchFromRow || fallbackSearchQuery,
        ...(imageUrl ? { imageUrl } : {}),
      };
    } catch (e) {
      this.logger.warn(
        `Cardhedger mint resolve via PSA spec map failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      return undefined;
    }
  }

  private buildCardhedgerSearchQuery(psa: ParsedPsaLabel): string {
    const parts = [
      String(psa.cardNameHint ?? '').trim(),
      String(psa.cardNumberHint ?? '')
        .replace(/^#/, '')
        .trim(),
      String(psa.setHint ?? '').trim(),
      String(psa.year ?? '').trim(),
    ].filter(Boolean);
    return parts.join(' ').trim();
  }

  private static cleanBaseCardName(raw: string): string {
    return String(raw ?? '')
      .replace(/\bPSA\/?DNA\b/gi, ' ')
      .replace(/\bDNA\b/gi, ' ')
      .replace(/\bAUTOGRAPH(?:ED)?\b/gi, ' ')
      .replace(/\bSIGNED\b/gi, ' ')
      .replace(/\bAUTO\b/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private static detectSignerFromText(text: string): string | undefined {
    const t = String(text ?? '');
    // Keep this intentionally conservative: only output signer when explicitly found.
    if (/MUTSUHIRO\s+ARITA/i.test(t)) return 'Mutsuhiro Arita';
    if (/\bARITA\b/i.test(t) && /\bMUTSUHIRO\b/i.test(t))
      return 'Mutsuhiro Arita';
    return undefined;
  }

  private static detectPsaVariant(
    psa: ParsedPsaLabel,
    ocrText: string,
  ): {
    variant_type: 'PSA' | 'PSA_DNA';
    has_autograph: boolean;
    signer?: string;
    auto_grade?: string;
    variant_match_confidence: number;
  } {
    const labelType = String(psa.labelType ?? '');
    const category = String(psa.category ?? '');
    const autoGrade = String(psa.autographGrade ?? '').trim();
    const ocr = String(ocrText ?? '');

    const strongDna =
      /DNA/i.test(labelType) ||
      /PSA\s*\/\s*DNA/i.test(labelType) ||
      /DNA/i.test(category) ||
      /AUTOGRAPH/i.test(category) ||
      (autoGrade.length > 0 && autoGrade !== '0');

    const weakDna = !strongDna && /PSA\s*\/\s*DNA|PSA\/DNA|\bDNA\b/i.test(ocr);
    const weakAuto =
      !strongDna && !weakDna && /\bAUTO\b|\bAUTOGRAPH\b|\bSIGNED\b/i.test(ocr);

    const isDna = strongDna || weakDna || weakAuto;
    const signer = isDna ? PsaService.detectSignerFromText(ocr) : undefined;

    let variantMatch = 0.2;
    if (strongDna) variantMatch = 0.95;
    else if (weakDna) variantMatch = 0.7;
    else if (weakAuto) variantMatch = 0.55;

    return {
      variant_type: isDna ? 'PSA_DNA' : 'PSA',
      has_autograph: isDna,
      ...(signer ? { signer } : {}),
      ...(autoGrade ? { auto_grade: autoGrade } : {}),
      variant_match_confidence: PsaService.clamp01(variantMatch),
    };
  }

  private buildTwoLayerIdentity(
    psa: ParsedPsaLabel,
    combinedText: string,
    cardhedgerMint?: PsaAnalyzeResult['cardhedgerMint'],
  ): NonNullable<PsaAnalyzeResult['identity']> {
    const year =
      typeof psa.year === 'string' && psa.year.trim()
        ? psa.year.trim()
        : undefined;
    const setRaw =
      typeof psa.setHint === 'string' && psa.setHint.trim()
        ? psa.setHint.trim()
        : undefined;
    const cardNumberRaw =
      typeof psa.cardNumberHint === 'string' && psa.cardNumberHint.trim()
        ? psa.cardNumberHint.replace(/^#/, '').trim()
        : undefined;
    const cardNameRaw =
      typeof psa.cardNameHint === 'string' && psa.cardNameHint.trim()
        ? psa.cardNameHint.trim()
        : undefined;

    const card_name = cardNameRaw
      ? PsaService.cleanBaseCardName(cardNameRaw)
      : undefined;
    const set = setRaw ? PsaService.cleanBaseCardName(setRaw) : undefined;
    const card_number = cardNumberRaw ? cardNumberRaw : undefined;

    const baseParts = [
      card_name,
      year,
      set,
      card_number ? `#${card_number}` : undefined,
    ].filter(Boolean);
    const base_identity = baseParts.join(' ').trim() || 'pokemon';

    const variant = PsaService.detectPsaVariant(psa, combinedText);
    const market_type: 'graded' | 'autograph' = variant.has_autograph
      ? 'autograph'
      : 'graded';

    let baseMatch = 0.55; // default: heuristic match possible but not verified
    if (cardhedgerMint?.matchConfidence === 'verified') baseMatch = 0.98;
    else if (cardhedgerMint?.matchConfidence === 'approximate')
      baseMatch = 0.75;

    return {
      base_card: {
        ...(year ? { year } : {}),
        ...(set ? { set } : {}),
        ...(card_number ? { card_number } : {}),
        ...(card_name ? { card_name } : {}),
        base_identity,
      },
      variant: {
        variant_type: variant.variant_type,
        has_autograph: variant.has_autograph,
        ...(variant.signer ? { signer: variant.signer } : {}),
        ...(variant.auto_grade ? { auto_grade: variant.auto_grade } : {}),
      },
      market_type,
      pricing_source: 'CardHedger',
      confidence_split: {
        base_match: PsaService.clamp01(baseMatch),
        variant_match: PsaService.clamp01(variant.variant_match_confidence),
      },
    };
  }

  /** OCR(앞/뒤) + Cardhedger cert OCR 후보로 PSA 공식 메타 조회. */
  async analyzeSlabImages(
    slabFront: Buffer,
    slabBack?: Buffer,
    certHint?: string,
  ): Promise<PsaAnalyzeResult> {
    return this.analyzeSlabImagesPipeline(slabFront, slabBack, certHint);
  }

  private async analyzeSlabImagesPipeline(
    slabFront: Buffer,
    slabBack: Buffer | undefined,
    certHint: string | undefined,
  ): Promise<PsaAnalyzeResult> {
    const frontOcr = await this.tryResolveByCardhedgerCertOcr(slabFront);
    const backOcr =
      slabBack && slabBack.length > 0
        ? await this.tryResolveByCardhedgerCertOcr(slabBack)
        : undefined;

    const combinedNorm = PsaService.combineNormalizedOcr(
      frontOcr.normalized,
      backOcr?.normalized,
    );
    let psaParsed: ParsedPsaLabel =
      PsaService.psaParsedFromNormalizedOcr(combinedNorm);

    // HARD RULE: do not overwrite OCR-extracted cert; only use manual cert when OCR has none.
    const hintDigits = resolveCertHintForLookup(certHint);
    if (!resolveCertHintForLookup(psaParsed.certNumber) && hintDigits) {
      psaParsed = { ...psaParsed, certNumber: hintDigits };
    }

    let combinedText = combinedNorm.raw_text || '';
    if (combinedText.length > PsaService.MAX_COMBINED_OCR_CHARS) {
      combinedText = combinedText.slice(0, PsaService.MAX_COMBINED_OCR_CHARS);
    }

    const finalCert = resolveCertHintForLookup(psaParsed.certNumber);
    const certCandidates = [
      ...frontOcr.certCandidates,
      ...(backOcr?.certCandidates ?? []),
      ...(finalCert ? [finalCert] : []),
    ].filter((v, i, a) => a.indexOf(v) === i);
    if (certCandidates.length === 0) {
      throw new BadRequestException(
        'CertNumber OCR에 실패했습니다. Cert Number를 직접 입력한 뒤 다시 시도해 주세요.',
      );
    }
    psaParsed = { ...psaParsed, certNumber: certCandidates[0] };

    const ocr: PsaAnalyzeResult['ocr'] = {
      cardhedger: {
        front: frontOcr.normalized,
        ...(backOcr?.normalized ? { back: backOcr.normalized } : {}),
        combined: combinedNorm,
      },
      combinedText,
      frontText: frontOcr.normalized.raw_text || undefined,
      backText: backOcr?.normalized.raw_text || undefined,
    };

    return this.buildAnalyzeResultFromPsaParsedAndOcr(
      psaParsed,
      combinedText,
      ocr,
      certCandidates,
      {
        ...(frontOcr.cardId ? { cardId: frontOcr.cardId } : {}),
        ...(frontOcr.searchQuery ? { searchQuery: frontOcr.searchQuery } : {}),
        ...(frontOcr.imageUrl ? { imageUrl: frontOcr.imageUrl } : {}),
      },
      slabFront,
    );
  }

  /**
   * OCR 없이 Cert 번호(또는 psacard.com/cert/ URL)만으로 PSA Public API 조회.
   */
  async analyzeByCertNumber(certHint: string): Promise<PsaAnalyzeResult> {
    const hintDigits = resolveCertHintForLookup(certHint);
    if (!hintDigits) {
      throw new BadRequestException(
        '유효한 Cert 번호(7~10자리 숫자) 또는 psacard.com/cert/… 형태의 URL이 필요합니다.',
      );
    }
    const empty: CardhedgerOcrNormalized = {
      raw_text: '',
      parsed_entities: {
        card_name: '',
        set: '',
        year: '',
        card_number: '',
        cert_number: '',
        grade: '',
        autograph_detected: false,
        signer_guess: null,
      },
      confidence: 0,
    };
    return this.buildAnalyzeResultFromPsaParsedAndOcr(
      { certNumber: hintDigits },
      '',
      { cardhedger: { front: empty, combined: empty }, combinedText: '' },
      [hintDigits],
      undefined,
    );
  }

  private async buildAnalyzeResultFromPsaParsedAndOcr(
    psaParsedIn: ParsedPsaLabel,
    combinedText: string,
    ocr: PsaAnalyzeResult['ocr'],
    certCandidates?: string[],
    cardhedgerOcr?: {
      cardId?: string;
      searchQuery?: string;
      imageUrl?: string;
    },
    imageBuffer?: Buffer,
  ): Promise<PsaAnalyzeResult> {
    let psaParsed = psaParsedIn;

    const candidateList = [
      ...(certCandidates ?? [])
        .map((x) => resolveCertHintForLookup(x) ?? '')
        .filter(Boolean),
      ...(resolveCertHintForLookup(psaParsed.certNumber)
        ? [resolveCertHintForLookup(psaParsed.certNumber)!]
        : []),
    ]
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 80); // prevent pathological OCR blobs from creating unbounded attempts
    if (candidateList.length === 0) {
      throw new BadRequestException(
        'CertNumber OCR에 실패했습니다. Cert Number를 직접 입력한 뒤 다시 시도해 주세요.',
      );
    }

    let apiLookupSuccess: Extract<
      PsaPublicApiLookupResult,
      { status: 'success' }
    > | null = null;
    let imagesLookup: PsaGetImagesLookupResult = {
      status: 'skipped',
      reason: 'no_cert',
    };
    let selectedCert: string | null = null;
    let lastErrMessage = '';
    for (const cert of candidateList) {
      try {
        const [apiTry, imgTry] = await Promise.all([
          this.psaPublicApi.getByCertNumber(cert),
          this.psaPublicApi.getImagesByCertNumber(cert),
        ]);
        if (apiTry.status === 'success') {
          selectedCert = cert;
          apiLookupSuccess = apiTry;
          imagesLookup = imgTry;
          psaParsed = { ...psaParsed, certNumber: cert };
          break;
        }
        const m =
          'message' in apiTry && typeof apiTry.message === 'string'
            ? apiTry.message
            : `status=${apiTry.status}`;
        lastErrMessage = m;
      } catch (e) {
        const m = e instanceof Error ? e.message : String(e);
        lastErrMessage = m;
      }
    }
    if (!selectedCert) {
      throw new InternalServerErrorException(
        `PSA 공식 메타 조회에 실패했습니다 (시도 cert=${candidateList.join(',')}): ${lastErrMessage || 'unknown error'}`,
      );
    }
    const digitsForImages = selectedCert;
    if (!apiLookupSuccess) {
      throw new InternalServerErrorException(
        `PSA 공식 메타 조회에 실패했습니다 (cert=${digitsForImages}): unknown error`,
      );
    }

    let enrichedFromOfficialApi = false;
    try {
      const hasCert = !!(apiLookupSuccess.raw as { PSACert?: unknown })
        ?.PSACert;
      if (!hasCert) {
        throw new Error('PSACert payload is missing');
      }
      psaParsed = mergePsaApiIntoParsed(psaParsed, apiLookupSuccess.raw);
      enrichedFromOfficialApi = true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new InternalServerErrorException(`PSA 공식 메타 병합 실패: ${msg}`);
    }

    if (imagesLookup.status === 'error') {
      throw new InternalServerErrorException(
        `PSA 이미지 조회 실패: ${imagesLookup.message}`,
      );
    }

    let psaCertImages: { front?: string; back?: string } | undefined;

    if (digitsForImages.length >= 7) {
      let fromGetImages: { front?: string; back?: string } = {};
      let fromCertBody: { front?: string; back?: string } = {};
      try {
        if (imagesLookup.status === 'success') {
          fromGetImages = extractPsaCertImagesFromGetImagesBody(
            imagesLookup.raw,
          );
        }
      } catch (e) {
        throw new InternalServerErrorException(
          `PSA GetImages 응답 파싱 실패: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      try {
        fromCertBody = extractPsaCertImageUrlsFromApiBody(
          apiLookupSuccess.raw,
          digitsForImages,
        );
      } catch (e) {
        throw new InternalServerErrorException(
          `PSA Cert 이미지 URL 추출 실패: ${e instanceof Error ? e.message : String(e)}`,
        );
      }

      const front = fromGetImages.front ?? fromCertBody.front;
      const back = fromGetImages.back ?? fromCertBody.back;

      if (front || back) {
        if (front) {
          const ok = await probeCertImageUrlReachable(front);
          if (!ok) {
            this.logger.warn(
              `PSA cert front probe failed (${digitsForImages.slice(0, 8)}…), using URL anyway`,
            );
          }
        }
        psaCertImages = {
          ...(front ? { front } : {}),
          ...(back ? { back } : {}),
        };
      }
    }

    const cardhedgerQuery = this.buildCardhedgerSearchQuery(psaParsed);

    let cardhedgerMint: PsaAnalyzeResult['cardhedgerMint'] = undefined;
    if (cardhedgerOcr?.cardId) {
      cardhedgerMint = {
        matchConfidence: 'verified',
        cardId: cardhedgerOcr.cardId,
        ...(cardhedgerOcr.searchQuery
          ? { searchQuery: cardhedgerOcr.searchQuery }
          : {}),
        ...(cardhedgerOcr.imageUrl ? { imageUrl: cardhedgerOcr.imageUrl } : {}),
      };
    } else {
      try {
        cardhedgerMint = await this.tryResolveCardhedgerMint(cardhedgerQuery, {
          cardName: String(psaParsed.cardNameHint ?? ''),
          cardNumber:
            primaryCardNumber(String(psaParsed.cardNumberHint ?? '')) ||
            String(psaParsed.cardNumberHint ?? '')
              .replace(/^#/, '')
              .trim(),
          cardSet:
            typeof psaParsed.setHint === 'string' && psaParsed.setHint.trim()
              ? psaParsed.setHint.trim()
              : undefined,
        });
      } catch (e) {
        this.logger.warn(
          `Cardhedger mint id resolve skipped: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
    if (cardhedgerMint == null) {
      cardhedgerMint = await this.tryResolveCardhedgerMintFromPsaSpecMap(
        psaParsed,
        cardhedgerQuery,
      );
    }

    // If we have a cardId but still no imageUrl, fetch via card-details as a fallback
    if (cardhedgerMint?.cardId && !cardhedgerMint.imageUrl) {
      try {
        const detailsBody = await this.cardhedgerService.forwardJson(
          'POST',
          '/v1/cards/card-details',
          { body: { card_id: cardhedgerMint.cardId } },
        );
        const detailCards = (detailsBody as { cards?: unknown[] }).cards;
        if (Array.isArray(detailCards) && detailCards.length > 0) {
          const row = detailCards[0] as Record<string, unknown>;
          const img =
            typeof row.image === 'string' && row.image.trim()
              ? normalizeImageUrl(row.image)
              : undefined;
          if (img) {
            cardhedgerMint = { ...cardhedgerMint, imageUrl: img };
          }
        }
      } catch (e) {
        this.logger.warn(
          `Cardhedger card-details image fetch skipped: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }

    // If still no catalog image, try additional sources (image passed in via imageBuffer param)
    // imageBuffer is available in the outer analyze scope via the passed-in image
    if (!cardhedgerMint?.imageUrl && imageBuffer != null) {
      // 1) Pokemon TCG API — works best for Pokemon cards (free, official images)
      const isPokemon =
        /pokemon/i.test(String(psaParsed.setHint ?? '')) ||
        /pokemon/i.test(String(psaParsed.cardNameHint ?? ''));
      if (isPokemon) {
        const ptcgImg = await this.tryPokemonTcgCardImage(
          String(psaParsed.cardNameHint ?? ''),
          String(psaParsed.cardNumberHint ?? ''),
          String(psaParsed.year ?? ''),
        );
        if (ptcgImg) {
          cardhedgerMint = {
            matchConfidence: 'approximate',
            ...(cardhedgerMint ?? {}),
            imageUrl: ptcgImg,
          };
        }
      }

      // 2) Cardhedger image-search — visual matching with the slab image
      if (!cardhedgerMint?.imageUrl) {
        const chImgSearchUrl = await this.tryCardhedgerImageSearch(imageBuffer);
        if (chImgSearchUrl) {
          cardhedgerMint = {
            matchConfidence: 'approximate',
            ...(cardhedgerMint ?? {}),
            imageUrl: chImgSearchUrl,
          };
        }
      }
    }

    let certVerifyUrl: string | undefined;
    try {
      certVerifyUrl = psaParsed.certNumber
        ? psaCertVerifyUrl(psaParsed.certNumber)
        : undefined;
    } catch (e) {
      this.logger.warn(`psaCertVerifyUrl failed: ${String(e)}`);
    }

    const result: PsaAnalyzeResult = {
      ocr,
      psa: {
        ...psaParsed,
        certVerifyUrl,
        enrichedFromOfficialApi,
      },
      identity: this.buildTwoLayerIdentity(
        psaParsed,
        combinedText,
        cardhedgerMint,
      ),
      psaApi: {
        lookup: apiLookupSuccess,
      },
      ...(cardhedgerMint != null ? { cardhedgerMint } : {}),
      ...(psaCertImages ? { psaCertImages } : {}),
    };

    return result;
  }

  /**
   * Cardhedger visual image-search: pass PSA slab image buffer → get best-matching catalog image.
   * Returns the matched card's `image` URL, or null if not found / not configured.
   */
  private async tryCardhedgerImageSearch(
    imageBuffer: Buffer,
  ): Promise<string | null> {
    try {
      this.cardhedgerService.assertConfigured();
    } catch {
      return null;
    }
    try {
      const jpg = await sharp(imageBuffer)
        .resize({ width: 1200, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      const b64 = `data:image/jpeg;base64,${jpg.toString('base64')}`;
      const raw = await this.cardhedgerService.forwardJson(
        'POST',
        '/v1/cards/image-search',
        {
          body: { image_base64: b64 },
        },
      );
      const cards = Array.isArray((raw as { cards?: unknown[] })?.cards)
        ? ((raw as { cards: unknown[] }).cards ?? [])
        : [];
      const first = cards[0] as Record<string, unknown> | undefined;
      const imgRaw =
        typeof first?.image === 'string' && first.image.trim()
          ? first.image.trim()
          : null;
      const img = imgRaw ? normalizeImageUrl(imgRaw) : null;
      if (img)
        this.logger.log(
          `Cardhedger image-search found catalog image: ${img.slice(0, 80)}`,
        );
      return img;
    } catch (e) {
      this.logger.warn(
        `Cardhedger image-search failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }

  /**
   * Pokemon TCG API: search by card name + number (+ optional year) for high-quality official images.
   * Returns `images.large` URL or null.
   * Docs: https://pokemontcg.io/
   */
  private async tryPokemonTcgCardImage(
    cardName: string,
    cardNumber: string,
    year?: string,
  ): Promise<string | null> {
    if (!cardName) return null;
    try {
      const name = cardName.replace(/"/g, '').trim();
      const num = cardNumber.replace(/^#/, '').replace(/"/g, '').trim();
      const parts: string[] = [`name:"${name}"`];
      if (num) parts.push(`number:${num}`);
      const q = encodeURIComponent(parts.join(' '));
      const url = `https://api.pokemontcg.io/v2/cards?q=${q}&pageSize=20&select=id,name,number,set,images`;
      const res = await fetch(url, {
        headers: { 'User-Agent': 'TokenableBackend/1.0' },
        signal: AbortSignal.timeout(8_000),
      });
      if (!res.ok) return null;
      const body = (await res.json()) as { data?: unknown[] };
      const cards = body.data ?? [];
      if (cards.length === 0) return null;

      // Filter by year if available (match card set release year)
      const targetYear = year ? String(year).trim() : null;
      const scored = cards
        .filter(
          (c): c is Record<string, unknown> =>
            typeof c === 'object' && c != null,
        )
        .map((c) => {
          const setObj = c.set as Record<string, unknown> | undefined;
          const releaseDate =
            typeof setObj?.releaseDate === 'string' ? setObj.releaseDate : '';
          const cardYear = releaseDate.slice(0, 4);
          const yearScore = targetYear && cardYear === targetYear ? 100 : 0;
          const numMatch = num && String(c.number ?? '') === num ? 50 : 0;
          return { c, score: yearScore + numMatch };
        })
        .sort((a, b) => b.score - a.score);

      const best = scored[0]?.c;
      const images = best?.images as Record<string, string> | undefined;
      const img = images?.large ?? images?.small ?? null;
      if (img)
        this.logger.log(
          `Pokemon TCG API found image for "${name} #${num}": ${img.slice(0, 80)}`,
        );
      return img ?? null;
    } catch (e) {
      this.logger.warn(
        `Pokemon TCG API lookup failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      return null;
    }
  }
}
