import { Injectable, Logger } from '@nestjs/common';
import { createWorker, PSM } from 'tesseract.js';
import sharp from 'sharp';
import { PriceService } from '../price/price.service';
import { PoketraceService } from '../poketrace/poketrace.service';
import {
  normalizePsaCardNameForPoketrace,
  primaryCardNumberForPoketrace,
} from '../poketrace/poketrace-mint-query.util';
import {
  buildJustTcgSearchQueryAfterMerge,
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
    /** 상단 라벨 크롭 보조 OCR */
    labelStripText?: string;
    /** Cert 우하단 영역 숫자 전용 OCR */
    certDigitsText?: string;
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
  justtcg: {
    queryUsed: string;
    /** First search hit, if any */
    topMatch: unknown | null;
    rawResponse: unknown;
  };
  /**
   * PokeTrace catalog id resolved after PSA+JustTCG — persist on mint as `graded.poketrace`
   * for stable NM lookups (GET /cards/:id instead of blind search).
   */
  poketraceMint?: {
    cardId: string;
    searchQuery: string;
  };
  /** PSA GetImages / GetByCertNumber에서 가져온 슬랩 사진 URL (앞면은 민팅 imageUrl 후보) */
  psaCertImages?: { front?: string; back?: string };
  /** 일부 단계 실패 시 복구·부분 결과 안내 (항상 200으로 내려갈 때 사용) */
  warnings?: string[];
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
    private readonly priceService: PriceService,
    private readonly psaPublicApi: PsaPublicApiService,
    private readonly poketraceService: PoketraceService,
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

  /**
   * 슬랩 상단 PSA 라벨(가로 전체) — 전체 이미지에서 카드·아트가 OCR을 방해할 때 보강.
   */
  private async buildPsaLabelStrip(buffer: Buffer): Promise<Buffer | null> {
    const meta = await sharp(buffer).metadata();
    const W = meta.width ?? 0;
    const H = meta.height ?? 0;
    if (W < 80 || H < 80) return null;
    const topH = Math.max(120, Math.floor(H * 0.42));
    return sharp(buffer)
      .extract({ left: 0, top: 0, width: W, height: Math.min(topH, H) })
      .resize({ width: 2800, fit: 'inside', withoutEnlargement: false })
      .greyscale()
      .normalize()
      .sharpen({ sigma: 0.8, m1: 1, m2: 0.5 })
      .png()
      .toBuffer();
  }

  /**
   * 라벨 이미지에서 Cert 번호가 가려는 오른쪽·하단 영역(대략 바코드·Cert 근처).
   */
  private async buildCertDigitZone(labelStrip: Buffer): Promise<Buffer | null> {
    const meta = await sharp(labelStrip).metadata();
    const lw = meta.width ?? 0;
    const lh = meta.height ?? 0;
    if (lw < 60 || lh < 40) return null;
    const cw = Math.max(100, Math.floor(lw * 0.68));
    const ch = Math.max(50, Math.floor(lh * 0.55));
    const cx = Math.max(0, lw - cw);
    const cy = Math.max(0, lh - ch);
    return sharp(labelStrip)
      .extract({ left: cx, top: cy, width: cw, height: ch })
      .resize({ width: 2200, fit: 'inside', withoutEnlargement: false })
      .greyscale()
      .normalize()
      .linear(1.15, -(128 * 0.08))
      .png()
      .toBuffer();
  }

  private async tesseractRecognize(
    image: Buffer,
    mode: (typeof PSM)[keyof typeof PSM],
    whitelist?: string,
  ): Promise<string> {
    let worker: Awaited<ReturnType<typeof createWorker>>;
    try {
      worker = await createWorker('eng');
    } catch (e) {
      this.logger.warn(`Tesseract worker (supplemental) failed: ${String(e)}`);
      return '';
    }
    try {
      const params: {
        tessedit_pageseg_mode: (typeof PSM)[keyof typeof PSM];
        tessedit_char_whitelist?: string;
      } = { tessedit_pageseg_mode: mode };
      if (whitelist) params.tessedit_char_whitelist = whitelist;
      await worker.setParameters(params);
      const {
        data: { text },
      } = await worker.recognize(image);
      return text ?? '';
    } catch (e) {
      this.logger.warn(`Tesseract recognize (supplemental) failed: ${String(e)}`);
      return '';
    } finally {
      try {
        await worker.terminate();
      } catch {
        /* ignore */
      }
    }
  }

  /** 라벨 스트립 + Cert 구역 숫자 전용 OCR → parsePsaLabelFromOcr 에 합류 */
  private async supplementalFrontOcr(buffer: Buffer): Promise<{
    labelStripText: string;
    certDigitsText: string;
  }> {
    let labelStripText = '';
    let certDigitsText = '';
    try {
      const strip = await this.buildPsaLabelStrip(buffer);
      if (!strip) return { labelStripText, certDigitsText };

      try {
        labelStripText = await this.tesseractRecognize(strip, PSM.SINGLE_BLOCK);
      } catch (e) {
        this.logger.warn(`OCR label strip (text) failed: ${String(e)}`);
      }

      try {
        const zone = await this.buildCertDigitZone(strip);
        if (zone) {
          certDigitsText = await this.tesseractRecognize(
            zone,
            PSM.SINGLE_BLOCK,
            '0123456789',
          );
        }
      } catch (e) {
        this.logger.warn(`OCR cert digit zone failed: ${String(e)}`);
      }
    } catch (e) {
      this.logger.warn(`supplementalFrontOcr failed: ${String(e)}`);
    }
    return { labelStripText, certDigitsText };
  }

  /**
   * OCR both slab images, parse PSA label, search JustTCG (Pokemon).
   * @param certHint OCR이 Cert를 못 읽을 때 폼에서 넣은 번호 또는 cert URL (PSA 조회 우선)
   */
  async analyzeSlabImages(
    slabFront: Buffer,
    slabBack?: Buffer,
    certHint?: string,
  ): Promise<PsaAnalyzeResult> {
    try {
      return await this.analyzeSlabImagesPipeline(
        slabFront,
        slabBack,
        certHint,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(
        `analyzeSlabImages fatal: ${msg}`,
        e instanceof Error ? e.stack : undefined,
      );
      return {
        ocr: { combinedText: '' },
        psa: {},
        psaApi: {
          lookup: {
            status: 'error',
            certNumber: '',
            message: `분석 파이프라인 오류: ${msg}`,
          },
        },
        justtcg: {
          queryUsed: 'pokemon',
          topMatch: null,
          rawResponse: null,
        },
        warnings: [
          '슬랩 분석 중 예상치 못한 오류가 발생했습니다. 다른 사진으로 다시 시도하거나 Cert 번호를 직접 입력해 보세요.',
          msg,
        ],
      };
    }
  }

  private async analyzeSlabImagesPipeline(
    slabFront: Buffer,
    slabBack: Buffer | undefined,
    certHint: string | undefined,
  ): Promise<PsaAnalyzeResult> {
    const warnings: string[] = [];

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

    const { labelStripText, certDigitsText } =
      await this.supplementalFrontOcr(slabFront);

    let combinedText = [frontText, backText, labelStripText, certDigitsText]
      .filter(Boolean)
      .join('\n---\n');
    if (combinedText.length > PsaService.MAX_COMBINED_OCR_CHARS) {
      warnings.push(
        `OCR 합본이 길어 앞 ${PsaService.MAX_COMBINED_OCR_CHARS.toLocaleString()}자만 사용합니다.`,
      );
      combinedText = combinedText.slice(0, PsaService.MAX_COMBINED_OCR_CHARS);
    }

    let psaParsed: ParsedPsaLabel;
    try {
      psaParsed = parsePsaLabelFromOcr(combinedText);
    } catch (e) {
      this.logger.warn(`parsePsaLabelFromOcr failed: ${String(e)}`);
      warnings.push('라벨 파싱 중 오류가 있어 빈 필드로 진행합니다.');
      psaParsed = {};
    }

    const hintDigits = resolveCertHintForLookup(certHint);
    if (hintDigits) {
      psaParsed = { ...psaParsed, certNumber: hintDigits };
    }

    const ocr: PsaAnalyzeResult['ocr'] = {
      combinedText,
      frontText: frontText || undefined,
      backText: backText || undefined,
      labelStripText: labelStripText || undefined,
      certDigitsText: certDigitsText || undefined,
    };

    return this.buildAnalyzeResultFromPsaParsedAndOcr(
      psaParsed,
      combinedText,
      warnings,
      ocr,
    );
  }

  /**
   * OCR 없이 Cert 번호(또는 psacard.com/cert/ URL)만으로 PSA Public API + JustTCG 조회.
   */
  async analyzeByCertNumber(certHint: string): Promise<PsaAnalyzeResult> {
    try {
      const hintDigits = resolveCertHintForLookup(certHint);
      if (!hintDigits) {
        return {
          ocr: { combinedText: '' },
          psa: {},
          psaApi: {
            lookup: {
              status: 'error',
              certNumber: '',
              message:
                '유효한 Cert 번호(7~10자리 숫자) 또는 psacard.com/cert/… 형태의 URL이 필요합니다.',
            },
          },
          justtcg: {
            queryUsed: 'pokemon',
            topMatch: null,
            rawResponse: null,
          },
          warnings: [
            'Cert 조회에는 7~10자리 숫자 또는 PSA 인증 페이지 URL을 입력하세요.',
          ],
        };
      }
      const warnings: string[] = [];
      return await this.buildAnalyzeResultFromPsaParsedAndOcr(
        { certNumber: hintDigits },
        '',
        warnings,
        { combinedText: '' },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(
        `analyzeByCertNumber fatal: ${msg}`,
        e instanceof Error ? e.stack : undefined,
      );
      return {
        ocr: { combinedText: '' },
        psa: {},
        psaApi: {
          lookup: {
            status: 'error',
            certNumber: '',
            message: `Cert 조회 파이프라인 오류: ${msg}`,
          },
        },
        justtcg: {
          queryUsed: 'pokemon',
          topMatch: null,
          rawResponse: null,
        },
        warnings: [
          'Cert 조회 중 예상치 못한 오류가 발생했습니다. 번호를 확인한 뒤 다시 시도하세요.',
          msg,
        ],
      };
    }
  }

  private async buildAnalyzeResultFromPsaParsedAndOcr(
    psaParsedIn: ParsedPsaLabel,
    combinedText: string,
    warnings: string[],
    ocr: PsaAnalyzeResult['ocr'],
  ): Promise<PsaAnalyzeResult> {
    let psaParsed = psaParsedIn;

    const digitsForImages = psaParsed.certNumber?.replace(/\D/g, '') ?? '';
    const certDigitsForError =
      digitsForImages.length >= 7 ? digitsForImages : '0000000';

    let apiLookup: PsaPublicApiLookupResult;
    let imagesLookup: PsaGetImagesLookupResult;
    try {
      [apiLookup, imagesLookup] = await Promise.all([
        this.psaPublicApi.getByCertNumber(psaParsed.certNumber),
        this.psaPublicApi.getImagesByCertNumber(psaParsed.certNumber),
      ]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`PSA Public API parallel call failed: ${msg}`);
      warnings.push(`PSA 공개 API 호출 실패: ${msg}`);
      apiLookup = {
        status: 'error',
        certNumber: certDigitsForError,
        message: msg,
      };
      imagesLookup = {
        status: 'error',
        certNumber: certDigitsForError,
        message: msg,
      };
    }

    let enrichedFromOfficialApi = false;

    if (apiLookup.status === 'success') {
      try {
        const hasCert = !!(apiLookup.raw as { PSACert?: unknown })?.PSACert;
        psaParsed = mergePsaApiIntoParsed(psaParsed, apiLookup.raw);
        enrichedFromOfficialApi = hasCert;
      } catch (e) {
        this.logger.warn(`mergePsaApiIntoParsed failed: ${String(e)}`);
        warnings.push(
          'PSA API 응답 병합에 실패했습니다. OCR·직접 입력 Cert만 사용합니다.',
        );
      }
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
        this.logger.warn(`extract GetImages body failed: ${String(e)}`);
        warnings.push('PSA GetImages 응답에서 슬랩 URL 파싱에 실패했습니다.');
      }
      try {
        if (apiLookup.status === 'success') {
          fromCertBody = extractPsaCertImageUrlsFromApiBody(
            apiLookup.raw,
            digitsForImages,
          );
        }
      } catch (e) {
        this.logger.warn(`extract cert image URLs failed: ${String(e)}`);
        warnings.push('PSA Cert 응답에서 이미지 URL 추출에 실패했습니다.');
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

    let queryUsed = 'pokemon';
    try {
      queryUsed = buildJustTcgSearchQueryAfterMerge(psaParsed, combinedText);
    } catch (e) {
      this.logger.warn(`buildJustTcgSearchQueryAfterMerge failed: ${String(e)}`);
      warnings.push(
        'JustTCG 검색어 생성에 실패해 기본값(pokemon)을 사용합니다.',
      );
    }

    let rawResponse: unknown = null;
    let topMatch: unknown = null;
    try {
      rawResponse = await this.priceService.getCards({
        q: queryUsed,
        game: 'pokemon',
        limit: 5,
        offset: 0,
      });
      const data = rawResponse as { data?: unknown[] };
      topMatch = data?.data?.[0] ?? null;
    } catch (e) {
      this.logger.warn(`JustTCG search failed: ${String(e)}`);
      warnings.push('JustTCG 카드 검색이 실패했습니다.');
    }

    let poketraceMint: { cardId: string; searchQuery: string } | null = null;
    try {
      const nameForPt = normalizePsaCardNameForPoketrace(
        String(psaParsed.cardNameHint ?? ''),
      );
      const numRaw = String(psaParsed.cardNumberHint ?? '');
      const numForPt =
        primaryCardNumberForPoketrace(numRaw) ||
        numRaw.replace(/^#/, '').trim();
      poketraceMint = await this.poketraceService.tryResolveCardIdForMintMetadata(
        queryUsed,
        {
          cardName: nameForPt || String(psaParsed.cardNameHint ?? ''),
          cardNumber: numForPt,
        },
      );
    } catch (e) {
      this.logger.warn(
        `PokeTrace mint id resolve skipped: ${e instanceof Error ? e.message : String(e)}`,
      );
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
        lookup: apiLookup,
      },
      justtcg: {
        queryUsed,
        topMatch,
        rawResponse,
      },
      ...(poketraceMint ? { poketraceMint } : {}),
      ...(psaCertImages ? { psaCertImages } : {}),
      ...(warnings.length > 0 ? { warnings } : {}),
    };

    return result;
  }
}

