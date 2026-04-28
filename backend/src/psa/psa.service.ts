import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { createWorker, PSM } from 'tesseract.js';
import sharp from 'sharp';
import { CardhedgerService } from '../cardhedger/cardhedger.service';
import {
  normalizeForExactCardNumberKey,
  normalizeForExactCatalogMatch,
  primaryCardNumber,
} from '../marketplace/card-match.util';
import {
  parsePsaLabelFromOcr,
  psaCertVerifyUrl,
  resolveCertHintForLookup,
  type ParsedPsaLabel,
} from './psa-ocr.util';
import {
  mergePsaApiIntoParsed,
  PsaPublicApiService,
  type PsaGetImagesLookupResult,
  type PsaPublicApiLookupResult,
} from './psa-public-api.service';
import {
  extractPsaCertImageUrlsFromApiBody,
  extractPsaCertImagesFromGetImagesBody,
} from './psa-cert-images.util';

export interface PsaAnalyzeResult {
  ocr: {
    combinedText: string;
    frontText?: string;
    backText?: string;
  };
  psa: ParsedPsaLabel & {
    certVerifyUrl?: string;
    /** True when PSA Public API returned PSACert and fields were merged */
    enrichedFromOfficialApi?: boolean;
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

  constructor(
    private readonly psaPublicApi: PsaPublicApiService,
    private readonly cardhedgerService: CardhedgerService,
  ) {}

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

  private async runOcrOnBuffer(buffer: Buffer): Promise<string> {
    let processed: Buffer;
    try {
      processed = await this.preprocess(buffer);
    } catch (e) {
      this.logger.warn(`Image preprocess (sharp) failed: ${String(e)}`);
      return '';
    }
    let worker: Awaited<ReturnType<typeof createWorker>>;
    try {
      worker = await createWorker('eng');
    } catch (e) {
      this.logger.warn(`Tesseract worker create failed: ${String(e)}`);
      return '';
    }
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
      });
      const {
        data: { text },
      } = await worker.recognize(processed);
      return text ?? '';
    } catch (e) {
      this.logger.warn(`Tesseract recognize failed: ${String(e)}`);
      return '';
    } finally {
      try {
        await worker.terminate();
      } catch {
        /* ignore */
      }
    }
  }


  private async tryResolveByCardhedgerCertOcr(frontImage: Buffer): Promise<{
    certCandidates: string[];
    cardId?: string;
    searchQuery?: string;
    imageUrl?: string;
  }> {
    try {
      this.cardhedgerService.assertConfigured();
    } catch {
      return { certCandidates: [] };
    }
    try {
      const jpg = await sharp(frontImage)
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
        const certInfo = (raw as { cert_info?: unknown }).cert_info as
          | Record<string, unknown>
          | undefined;
        const certRaw =
          typeof certInfo?.cert === 'string'
            ? certInfo.cert
            : typeof certInfo?.cert === 'number'
              ? String(certInfo.cert)
              : '';
        const cert = resolveCertHintForLookup(certRaw);
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
          typeof card?.image === 'string' && card.image.trim() ? card.image.trim() : undefined;
        if (cert) {
          return {
            certCandidates: [cert],
            ...(cardId ? { cardId } : {}),
            ...(searchQuery ? { searchQuery } : {}),
            ...(imageUrl ? { imageUrl } : {}),
          };
        }
      }
      return { certCandidates: [] };
    } catch (e) {
      this.logger.warn(
        `Cardhedger cert OCR fallback failed: ${e instanceof Error ? e.message : String(e)}`,
      );
      return { certCandidates: [] };
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

    const body = await this.cardhedgerService.forwardJson('POST', '/v1/cards/card-search', {
      body: { search: searchQuery, page: 1, page_size: 25 },
    });
    const cards = Array.isArray((body as { cards?: unknown[] })?.cards)
      ? ((body as { cards: unknown[] }).cards ?? [])
      : [];
    if (cards.length === 0) return undefined;

    const scored = cards
      .filter((x): x is Record<string, unknown> => typeof x === 'object' && x != null)
      .map((row) => {
        const idRaw = row.card_id;
        const id = typeof idRaw === 'string' ? idRaw.trim() : '';
        const desc = normalizeForExactCatalogMatch(String(row.description ?? row.name ?? ''));
        const set = normalizeForExactCatalogMatch(String(row.set ?? ''));
        const num = normalizeForExactCardNumberKey(
          primaryCardNumber(String(row.number ?? '')),
        );

        let score = 0;
        if (cardNumWant && num && cardNumWant === num) score += 100;
        if (cardSetWant && set && (set.includes(cardSetWant) || cardSetWant.includes(set))) {
          score += 60;
        }
        if (cardNameWant && desc && (desc.includes(cardNameWant) || cardNameWant.includes(desc))) {
          score += 50;
        }
        const verified =
          Boolean(cardNumWant && num && cardNumWant === num) &&
          Boolean(cardSetWant && set && (set.includes(cardSetWant) || cardSetWant.includes(set))) &&
          Boolean(cardNameWant && desc && (desc.includes(cardNameWant) || cardNameWant.includes(desc)));

        return { id, score, verified };
      })
      .filter((r) => r.id.length > 0 && r.score > 0)
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

    const pick = scored[0];
    if (!pick) return undefined;
    // Accuracy-first: persist Cardhedger id only for strict verified matches.
    if (!pick.verified) return undefined;
    return {
      matchConfidence: 'verified',
      cardId: pick.id,
      searchQuery,
    };
  }

  private buildCardhedgerSearchQuery(psa: ParsedPsaLabel): string {
    const parts = [
      String(psa.cardNameHint ?? '').trim(),
      String(psa.cardNumberHint ?? '').replace(/^#/, '').trim(),
      String(psa.setHint ?? '').trim(),
      String(psa.year ?? '').trim(),
    ].filter(Boolean);
    return parts.join(' ').trim();
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
    const chOcr = await this.tryResolveByCardhedgerCertOcr(slabFront);

    let frontText = '';
    let backText = '';
    try {
      frontText = await this.runOcrOnBuffer(slabFront);
    } catch (e) {
      this.logger.warn(`OCR slab front failed: ${String(e)}`);
    }
    if (slabBack && slabBack.length > 0) {
      try {
        backText = await this.runOcrOnBuffer(slabBack);
      } catch (e) {
        this.logger.warn(`OCR slab back failed: ${String(e)}`);
      }
    }

    let psaParsed: ParsedPsaLabel = {};

    const parseFromPieces = (parts: string[]): ParsedPsaLabel => {
      const combined = parts.filter(Boolean).join('\n---\n');
      return parsePsaLabelFromOcr(combined);
    };
    try {
      psaParsed = parseFromPieces([frontText, backText]);
    } catch (e) {
      this.logger.warn(`parsePsaLabelFromOcr(primary) failed: ${String(e)}`);
    }

    const hintDigits = resolveCertHintForLookup(certHint);
    if (hintDigits) {
      psaParsed = { ...psaParsed, certNumber: hintDigits };
    }
    let combinedText = [frontText, backText].filter(Boolean).join('\n---\n');
    if (combinedText.length > PsaService.MAX_COMBINED_OCR_CHARS) {
      combinedText = combinedText.slice(0, PsaService.MAX_COMBINED_OCR_CHARS);
    }

    const finalCert = resolveCertHintForLookup(psaParsed.certNumber);
    const certCandidates = [
      ...(hintDigits ? [hintDigits] : []),
      ...chOcr.certCandidates,
      ...(finalCert ? [finalCert] : []),
    ].filter((v, i, a) => a.indexOf(v) === i);
    if (certCandidates.length === 0) {
      throw new BadRequestException(
        'CertNumber OCR에 실패했습니다. Cert Number를 직접 입력한 뒤 다시 시도해 주세요.',
      );
    }
    psaParsed = { ...psaParsed, certNumber: certCandidates[0] };

    const ocr: PsaAnalyzeResult['ocr'] = {
      combinedText,
      frontText: frontText || undefined,
      backText: backText || undefined,
    };

    return this.buildAnalyzeResultFromPsaParsedAndOcr(
      psaParsed,
      combinedText,
      ocr,
      certCandidates,
      chOcr,
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
    return this.buildAnalyzeResultFromPsaParsedAndOcr(
      { certNumber: hintDigits },
      '',
      { combinedText: '' },
      [hintDigits],
      undefined,
    );
  }

  private async buildAnalyzeResultFromPsaParsedAndOcr(
    psaParsedIn: ParsedPsaLabel,
    combinedText: string,
    ocr: PsaAnalyzeResult['ocr'],
    certCandidates?: string[],
    cardhedgerOcr?: { cardId?: string; searchQuery?: string; imageUrl?: string },
  ): Promise<PsaAnalyzeResult> {
    let psaParsed = psaParsedIn;

    const candidateList = [
      ...((certCandidates ?? [])
        .map((x) => resolveCertHintForLookup(x) ?? '')
        .filter(Boolean) as string[]),
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

    let apiLookupSuccess: Extract<PsaPublicApiLookupResult, { status: 'success' }> | null =
      null;
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
      const hasCert = !!(apiLookupSuccess.raw as { PSACert?: unknown })?.PSACert;
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
          fromGetImages = extractPsaCertImagesFromGetImagesBody(imagesLookup.raw);
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

      if (front) {
        const ok = await probeCertImageUrlReachable(front);
        if (!ok) {
          this.logger.warn(
            `PSA cert front probe failed (${digitsForImages.slice(0, 8)}…), using URL anyway`,
          );
        }
        psaCertImages = {
          front,
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
            String(psaParsed.cardNumberHint ?? '').replace(/^#/, '').trim(),
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
      psaApi: {
        lookup: apiLookupSuccess,
      },
      ...(cardhedgerMint != null ? { cardhedgerMint } : {}),
      ...(psaCertImages ? { psaCertImages } : {}),
    };

    return result;
  }
}

