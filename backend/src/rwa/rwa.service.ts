import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinataService } from './pinata/pinata.service';
import { cropPsaSlabForCollectionCover } from '../psa/utils/psa-slab-crop.util';
import { UploadRwaDto } from './dto/upload-rwa.dto';
import {
  mintRejectionMessage,
  psaGradePolicyInputFromGraded,
} from '../marketplace/utils/psa-grade-policy.util';
import {
  RwaAttribute,
  RwaMetadata,
  UploadRwaResult,
} from './interfaces/rwa-metadata.interface';

function safeCollectionCoverFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 48) || 'rwa';
}

function isPsaGraded(graded: Record<string, unknown> | undefined): boolean {
  if (!graded || typeof graded !== 'object') return false;
  const gc = graded.gradingCompany;
  if (typeof gc !== 'string') return false;
  const norm = gc.trim().toUpperCase().replace(/\s+/g, '');
  return norm === 'PSA' || norm === 'PSA/DNA' || norm === 'PSADNA';
}

@Injectable()
export class RwaService {
  private readonly logger = new Logger(RwaService.name);

  constructor(
    private readonly pinataService: PinataService,
    private readonly config: ConfigService,
  ) {}

  /** 상단 PSA 라벨 제거 비율 (0~0.55). 기본 0.26 — `PSA_SLAB_COVER_TOP_TRIM_RATIO` */
  private getPsaSlabTopTrimRatio(): number {
    const raw = this.config.get<string>('PSA_SLAB_COVER_TOP_TRIM_RATIO');
    if (raw === undefined || raw === '') return 0.26;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n < 0.55 ? n : 0.26;
  }

  /** 좌·우 베젤 제거: 너비의 비율(각 측). 기본 0.09 — `PSA_SLAB_COVER_SIDE_INSET_RATIO` */
  private getPsaSlabSideInsetRatio(): number {
    const raw = this.config.get<string>('PSA_SLAB_COVER_SIDE_INSET_RATIO');
    if (raw === undefined || raw === '') return 0.09;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n < 0.25 ? n : 0.09;
  }

  /** 하단 베젤 제거: 높이 비율. 기본 0.05(보수적) — `PSA_SLAB_COVER_BOTTOM_INSET_RATIO` */
  private getPsaSlabBottomInsetRatio(): number {
    const raw = this.config.get<string>('PSA_SLAB_COVER_BOTTOM_INSET_RATIO');
    if (raw === undefined || raw === '') return 0.05;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 && n < 0.4 ? n : 0.05;
  }

  private psaSlabCropOptions() {
    return {
      topTrimRatio: this.getPsaSlabTopTrimRatio(),
      sideInsetRatio: this.getPsaSlabSideInsetRatio(),
      bottomInsetRatio: this.getPsaSlabBottomInsetRatio(),
    };
  }

  /** 컬렉션 대표용 — 상단 PSA 라벨·베젤 크롭 후 IPFS CID. 실패 시 undefined. */
  private async tryUploadPsaCollectionCover(
    buffer: Buffer,
    dtoName: string,
  ): Promise<string | undefined> {
    try {
      const cropped = await cropPsaSlabForCollectionCover(
        buffer,
        this.psaSlabCropOptions(),
      );
      const fn = `collection-cover-${safeCollectionCoverFilename(dtoName)}.png`;
      return await this.pinataService.uploadBuffer(cropped, fn, 'image/png');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(`PSA slab crop skipped: ${msg}`);
      return undefined;
    }
  }

  async uploadToIpfs(
    dto: UploadRwaDto,
    file?: Express.Multer.File,
  ): Promise<UploadRwaResult> {
    if (!file && !dto.imageUrl) {
      throw new BadRequestException(
        '이미지 파일 또는 imageUrl 중 하나는 필수입니다.',
      );
    }

    let parsedGraded: {
      graded?: Record<string, unknown>;
      attributes?: RwaAttribute[];
      external_url?: string;
      properties?: Record<string, unknown>;
    } | null = null;

    if (dto.gradedMetadata?.trim()) {
      try {
        parsedGraded = JSON.parse(dto.gradedMetadata) as {
          graded?: Record<string, unknown>;
          attributes?: RwaAttribute[];
          external_url?: string;
          properties?: Record<string, unknown>;
        };
      } catch {
        throw new BadRequestException('gradedMetadata must be valid JSON');
      }
    }

    const gradedObj = parsedGraded?.graded;
    const psaGraded =
      gradedObj && typeof gradedObj === 'object'
        ? isPsaGraded(gradedObj)
        : false;
    if (!gradedObj || typeof gradedObj !== 'object') {
      throw new BadRequestException(
        'PSA 인증 메타데이터가 필요합니다. OCR/Cert 조회로 PSA 10 확인 후 mint 해주세요.',
      );
    }
    if (!psaGraded) {
      throw new BadRequestException(
        'PSA 등급 카드만 mint 가능합니다. OCR/Cert 조회 결과가 PSA인지 확인해주세요.',
      );
    }
    const gradeReject = mintRejectionMessage(
      psaGradePolicyInputFromGraded(gradedObj),
    );
    if (gradeReject) {
      throw new BadRequestException(gradeReject);
    }

    let imageCID: string;
    let collectionCoverIpfsCid: string | undefined;

    if (file?.buffer) {
      imageCID = await this.pinataService.uploadFile(file);
      if (psaGraded) {
        collectionCoverIpfsCid = await this.tryUploadPsaCollectionCover(
          file.buffer,
          dto.name,
        );
      }
    } else if (dto.imageUrl) {
      if (psaGraded) {
        try {
          const { buffer, mimeType, extension } =
            await this.pinataService.fetchImageBufferFromUrl(dto.imageUrl);
          const baseFn = `${safeCollectionCoverFilename(dto.name)}.${extension}`;
          imageCID = await this.pinataService.uploadBuffer(
            buffer,
            baseFn,
            mimeType,
          );
          collectionCoverIpfsCid = await this.tryUploadPsaCollectionCover(
            buffer,
            dto.name,
          );
        } catch (e: unknown) {
          this.logger.error('Failed to fetch or upload PSA image from URL', e);
          throw new InternalServerErrorException(
            'URL 이미지 IPFS 업로드에 실패했습니다.',
          );
        }
      } else {
        imageCID = await this.pinataService.uploadFromUrl(
          dto.imageUrl,
          dto.name,
        );
      }
    } else {
      throw new BadRequestException(
        '이미지 파일 또는 imageUrl 중 하나는 필수입니다.',
      );
    }

    const metadata: RwaMetadata = {
      name: dto.name,
      description: dto.description,
      image: `ipfs://${imageCID}`,
      ...(dto.attributes && { attributes: dto.attributes }),
    };

    if (parsedGraded) {
      metadata.properties = {
        ...(metadata.properties ?? {}),
        ...(parsedGraded.properties ?? {}),
      };
      if (parsedGraded.graded && typeof parsedGraded.graded === 'object') {
        metadata.properties.graded = {
          ...parsedGraded.graded,
          ...(collectionCoverIpfsCid && {
            collectionCoverImage: `ipfs://${collectionCoverIpfsCid}`,
          }),
        };
      }
      if (parsedGraded.attributes?.length) {
        metadata.attributes = [
          ...(metadata.attributes ?? []),
          ...parsedGraded.attributes,
        ];
      }
      if (typeof parsedGraded.external_url === 'string') {
        metadata.external_url = parsedGraded.external_url;
      }
    }

    const metadataCID = await this.pinataService.uploadMetadata(metadata);

    return {
      tokenURI: `ipfs://${metadataCID}`,
      metadataCID,
      imageCID,
      metadata,
    };
  }
}
