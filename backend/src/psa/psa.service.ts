import { Injectable, Logger } from '@nestjs/common';
import { createWorker, PSM } from 'tesseract.js';
import sharp from 'sharp';
import { PriceService } from '../price/price.service';
import {
  buildJustTcgSearchQueryAfterMerge,
  parsePsaLabelFromOcr,
  psaCertVerifyUrl,
  type ParsedPsaLabel,
} from './psa-ocr.util';
import {
  mergePsaApiIntoParsed,
  PsaPublicApiService,
  type PsaPublicApiLookupResult,
} from './psa-public-api.service';

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
  justtcg: {
    queryUsed: string;
    /** First search hit, if any */
    topMatch: unknown | null;
    rawResponse: unknown;
  };
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
   * OCR both slab images, parse PSA label, search JustTCG (Pokemon).
   */
  async analyzeSlabImages(
    slabFront: Buffer,
    slabBack?: Buffer,
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

    const combinedText = [frontText, backText].filter(Boolean).join('\n---\n');
    let psaParsed = parsePsaLabelFromOcr(combinedText);

    let apiLookup: PsaPublicApiLookupResult = await this.psaPublicApi.getByCertNumber(
      psaParsed.certNumber,
    );
    let enrichedFromOfficialApi = false;

    if (apiLookup.status === 'success') {
      const hasCert = !!(apiLookup.raw as { PSACert?: unknown })?.PSACert;
      psaParsed = mergePsaApiIntoParsed(psaParsed, apiLookup.raw);
      enrichedFromOfficialApi = hasCert;
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
    };
  }
}
