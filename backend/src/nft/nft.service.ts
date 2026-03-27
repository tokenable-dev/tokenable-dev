import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinataService } from '../util/pinata/pinata.service';
import { UploadNftDto } from './dto/upload-nft.dto';
import {
  NftAttribute,
  NftMetadata,
  UploadNftResult,
} from './interfaces/nft-metadata.interface';
import { cropPsaSlabForCollectionCover } from './psa-slab-crop.util';

function safeCollectionCoverFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 48) || 'nft';
}

@Injectable()
export class NftService {
  private readonly logger = new Logger(NftService.name);

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

  async uploadToIpfs(dto: UploadNftDto, file?: Express.Multer.File): Promise<UploadNftResult> {
    if (!file && !dto.imageUrl) {
      throw new BadRequestException('이미지 파일 또는 imageUrl 중 하나는 필수입니다.');
    }

    let parsedGraded: {
      graded?: Record<string, unknown>;
      attributes?: NftAttribute[];
      external_url?: string;
      properties?: Record<string, unknown>;
    } | null = null;

    if (dto.gradedMetadata?.trim()) {
      try {
        parsedGraded = JSON.parse(dto.gradedMetadata) as {
          graded?: Record<string, unknown>;
          attributes?: NftAttribute[];
          external_url?: string;
          properties?: Record<string, unknown>;
        };
      } catch {
        throw new BadRequestException('gradedMetadata must be valid JSON');
      }
    }

    const imageCID = file
      ? await this.pinataService.uploadFile(file)
      : await this.pinataService.uploadFromUrl(dto.imageUrl!, dto.name);

    let collectionCoverIpfsCid: string | undefined;
    if (file?.buffer && parsedGraded?.graded && typeof parsedGraded.graded === 'object') {
      const gc = parsedGraded.graded.gradingCompany;
      if (typeof gc === 'string' && gc.toUpperCase() === 'PSA') {
        try {
          const cropped = await cropPsaSlabForCollectionCover(file.buffer, {
            topTrimRatio: this.getPsaSlabTopTrimRatio(),
            sideInsetRatio: this.getPsaSlabSideInsetRatio(),
            bottomInsetRatio: this.getPsaSlabBottomInsetRatio(),
          });
          const fn = `collection-cover-${safeCollectionCoverFilename(dto.name)}.png`;
          collectionCoverIpfsCid = await this.pinataService.uploadBuffer(cropped, fn, 'image/png');
        } catch (e: unknown) {
          const msg = e instanceof Error ? e.message : String(e);
          this.logger.warn(`PSA slab crop skipped: ${msg}`);
        }
      }
    }

    const metadata: NftMetadata = {
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
