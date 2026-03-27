import { Injectable, Logger } from '@nestjs/common';
import { createWorker, PSM } from 'tesseract.js';
import sharp from 'sharp';
import { PriceService } from '../price/price.service';
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
    private readonly priceService: PriceService,
    private readonly psaPublicApi: PsaPublicApiService,
  ) {}

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
    const processed = await this.preprocess(buffer);
    const worker = await createWorker('eng');
    try {
      await worker.setParameters({
        tessedit_pageseg_mode: PSM.AUTO,
      });
      const {
        data: { text },
      } = await worker.recognize(processed);
      return text ?? '';
    } finally {
      await worker.terminate();
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
    const worker = await createWorker('eng');
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
    } finally {
      await worker.terminate();
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

    const combinedText = [frontText, backText, labelStripText, certDigitsText]
      .filter(Boolean)
      .join('\n---\n');
    let psaParsed = parsePsaLabelFromOcr(combinedText);

    const hintDigits = resolveCertHintForLookup(certHint);
    if (hintDigits) {
      psaParsed = { ...psaParsed, certNumber: hintDigits };
    }

    const digitsForImages = psaParsed.certNumber?.replace(/\D/g, '') ?? '';

    const [apiLookup, imagesLookup]: [
      PsaPublicApiLookupResult,
      PsaGetImagesLookupResult,
    ] = await Promise.all([
      this.psaPublicApi.getByCertNumber(psaParsed.certNumber),
      this.psaPublicApi.getImagesByCertNumber(psaParsed.certNumber),
    ]);

    let enrichedFromOfficialApi = false;

    if (apiLookup.status === 'success') {
      const hasCert = !!(apiLookup.raw as { PSACert?: unknown })?.PSACert;
      psaParsed = mergePsaApiIntoParsed(psaParsed, apiLookup.raw);
      enrichedFromOfficialApi = hasCert;
    }

    let psaCertImages: { front?: string; back?: string } | undefined;

    if (digitsForImages.length >= 7) {
      const fromGetImages =
        imagesLookup.status === 'success'
          ? extractPsaCertImagesFromGetImagesBody(imagesLookup.raw)
          : {};
      const fromCertBody =
        apiLookup.status === 'success'
          ? extractPsaCertImageUrlsFromApiBody(apiLookup.raw, digitsForImages)
          : {};

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

    const queryUsed = buildJustTcgSearchQueryAfterMerge(psaParsed, combinedText);

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
    }

    const certVerifyUrl = psaParsed.certNumber
      ? psaCertVerifyUrl(psaParsed.certNumber)
      : undefined;

    return {
      ocr: {
        combinedText,
        frontText: frontText || undefined,
        backText: backText || undefined,
        labelStripText: labelStripText || undefined,
        certDigitsText: certDigitsText || undefined,
      },
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
      ...(psaCertImages ? { psaCertImages } : {}),
    };
  }
}
