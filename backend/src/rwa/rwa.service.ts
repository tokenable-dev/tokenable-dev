import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { VaultService } from '../vault/vault.service';
import { VaultSubmissionService } from '../vault/vault-submission.service';
import { psaCertNumberFromGradedMeta } from '../marketplace/utils/collection-image.util';
import {
  resolveCatalogCoverMime,
} from '../marketplace/collections/catalog-cover-s3.service';
import { PinataService } from './pinata/pinata.service';
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
import { RwaSlabS3Service } from './rwa-slab-s3.service';
import { readRwaMintPlaceholderPng } from './rwa-mint-placeholder.util';
import {
  type MintImageSource,
  readCardhedgerMintImageUrlFromGraded,
  readPsaCertBackUrlFromGraded,
  readPsaCertSlabUrlFromGraded,
  resolveRemoteMintImageUrl,
} from './rwa-mint-image.util';

function patchGradedPsaCertImageBackUrl(
  metadata: RwaMetadata,
  url: string,
): void {
  const props = metadata.properties;
  if (!props || typeof props !== 'object') return;
  const graded = props.graded;
  if (!graded || typeof graded !== 'object') return;
  const g = graded as Record<string, unknown>;
  const prev =
    g.psa && typeof g.psa === 'object'
      ? (g.psa as Record<string, unknown>)
      : {};
  g.psa = { ...prev, certImageBackUrl: url };
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
  constructor(
    private readonly pinataService: PinataService,
    private readonly vault: VaultService,
    private readonly vaultSubmissions: VaultSubmissionService,
    private readonly rwaSlabS3: RwaSlabS3Service,
  ) {}

  async uploadToIpfs(
    dto: UploadRwaDto,
    chainId: number,
    file?: Express.Multer.File,
  ): Promise<UploadRwaResult> {
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
    let mintImageSource: MintImageSource = 'tokenable_placeholder';
    let mintFile = file;
    let remoteMintUrl: string | null = null;

    if (mintFile?.buffer) {
      mintImageSource = 'user_upload';
    } else {
      const remote = resolveRemoteMintImageUrl({
        psaCertSlabUrl: readPsaCertSlabUrlFromGraded(gradedObj),
        userImageUrl: dto.imageUrl?.trim(),
        cardhedgerImageUrl: readCardhedgerMintImageUrlFromGraded(gradedObj),
      });
      if (remote.url && remote.source) {
        remoteMintUrl = remote.url;
        mintImageSource = remote.source;
      } else {
        const placeholder = readRwaMintPlaceholderPng();
        mintFile = {
          buffer: placeholder.buffer,
          originalname: placeholder.originalname,
          mimetype: placeholder.mimetype,
          fieldname: 'file',
          encoding: '7bit',
          size: placeholder.buffer.length,
          stream: undefined as unknown as Express.Multer.File['stream'],
          destination: '',
          filename: '',
          path: '',
        };
        mintImageSource = 'tokenable_placeholder';
      }
    }
    const psaGraded =
      gradedObj && typeof gradedObj === 'object'
        ? isPsaGraded(gradedObj)
        : false;
    if (!gradedObj || typeof gradedObj !== 'object') {
      throw new BadRequestException(
        'PSA 인증 메타데이터가 필요합니다. OCR/Cert 조회로 PSA 등급 확인 후 mint 해주세요.',
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

    const certNumber = psaCertNumberFromGradedMeta({ graded: gradedObj });
    if (!certNumber) {
      throw new BadRequestException(
        'Could not extract a PSA cert number from gradedMetadata — required to open a vault cycle.',
      );
    }
    await this.vault.assertAvailableForNewCycle(certNumber, chainId);

    let imageCID!: string;
    let displayImageUrl: string | null = null;

    if (mintFile?.buffer) {
      const mime = resolveCatalogCoverMime(mintFile.mimetype, mintFile.buffer);
      if (!mime) {
        throw new BadRequestException(
          '이미지 파일 형식이 올바르지 않습니다 (JPEG/PNG/WebP).',
        );
      }
      const slabPromise = this.rwaSlabS3.ingestMintSlabBestEffort({
        chainId,
        certNumber,
        buffer: mintFile.buffer,
        contentType: mime,
      });
      try {
        imageCID = await this.pinataService.uploadFile(mintFile);
      } catch {
        throw new InternalServerErrorException(
          '이미지 IPFS 업로드에 실패했습니다.',
        );
      }
      displayImageUrl = await slabPromise;
    } else if (remoteMintUrl) {
      let fetched: { buffer: Buffer; mimeType: string; extension: string };
      try {
        fetched = await this.pinataService.fetchImageBufferFromUrl(remoteMintUrl);
      } catch {
        if (mintImageSource === 'cardhedger_catalog') {
          const placeholder = readRwaMintPlaceholderPng();
          mintFile = {
            buffer: placeholder.buffer,
            originalname: placeholder.originalname,
            mimetype: placeholder.mimetype,
            fieldname: 'file',
            encoding: '7bit',
            size: placeholder.buffer.length,
            stream: undefined as unknown as Express.Multer.File['stream'],
            destination: '',
            filename: '',
            path: '',
          };
          mintImageSource = 'tokenable_placeholder';
          const mime = resolveCatalogCoverMime(
            mintFile.mimetype,
            mintFile.buffer,
          );
          if (!mime) {
            throw new InternalServerErrorException(
              'Mint placeholder image is invalid.',
            );
          }
          const slabPromise = this.rwaSlabS3.ingestMintSlabBestEffort({
            chainId,
            certNumber,
            buffer: mintFile.buffer,
            contentType: mime,
          });
          imageCID = await this.pinataService.uploadFile(mintFile);
          displayImageUrl = await slabPromise;
        } else {
          throw new InternalServerErrorException(
            'URL 이미지를 가져오지 못했습니다.',
          );
        }
      }
      if (!mintFile?.buffer) {
        const slabPromise = this.rwaSlabS3.ingestMintSlabBestEffort({
          chainId,
          certNumber,
          buffer: fetched!.buffer,
          contentType: fetched!.mimeType,
        });
        try {
          imageCID = await this.pinataService.uploadBuffer(
            fetched!.buffer,
            `${dto.name}.${fetched!.extension}`,
            fetched!.mimeType,
          );
        } catch {
          throw new InternalServerErrorException(
            'URL 이미지 IPFS 업로드에 실패했습니다.',
          );
        }
        displayImageUrl = await slabPromise;
      }
    } else {
      throw new InternalServerErrorException(
        'Mint image could not be resolved.',
      );
    }

    const metadata: RwaMetadata = {
      name: dto.name,
      description: dto.description,
      image: this.pinataService.ipfsUri(imageCID),
      ...(dto.attributes && { attributes: dto.attributes }),
    };

    if (parsedGraded) {
      metadata.properties = {
        ...(metadata.properties ?? {}),
        ...(parsedGraded.properties ?? {}),
        mintImageSource,
      };
      if (parsedGraded.graded && typeof parsedGraded.graded === 'object') {
        metadata.properties.graded = {
          ...parsedGraded.graded,
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

    let displayImageBackUrl: string | null = null;
    const backSource = readPsaCertBackUrlFromGraded(gradedObj);
    if (backSource) {
      displayImageBackUrl = await this.rwaSlabS3.ingestMintSlabBestEffort({
        chainId,
        certNumber,
        sourceUrl: backSource,
        face: 'back',
      });
      if (displayImageBackUrl) {
        patchGradedPsaCertImageBackUrl(metadata, displayImageBackUrl);
      }
    }

    const metadataCID = await this.pinataService.uploadMetadata(metadata);

    return {
      tokenURI: `ipfs://${metadataCID}`,
      metadataCID,
      imageCID,
      metadata,
      displayImageUrl,
      displayImageBackUrl,
    };
  }

  /** UI pre-flight — does not reserve a cycle. */
  async checkCertAvailability(
    certNumber: string,
    chainId: number,
  ): Promise<{
    available: boolean;
    certNumber: string;
    message: string | null;
  }> {
    const trimmed = certNumber.trim();
    if (!/^\d{7,10}$/.test(trimmed)) {
      throw new BadRequestException(
        'Enter a valid PSA cert number (7–10 digits).',
      );
    }

    const cycleCheck = await this.vault.checkAvailableForNewCycle(
      trimmed,
      chainId,
    );
    if (!cycleCheck.available) {
      return cycleCheck;
    }

    try {
      await this.vaultSubmissions.assertCertAvailableForSelfVault(trimmed);
    } catch (e) {
      if (e instanceof BadRequestException) {
        const body = e.getResponse();
        const raw =
          typeof body === 'object' && body !== null && 'message' in body
            ? (body as { message: string | string[] }).message
            : e.message;
        const message = Array.isArray(raw) ? raw.join(', ') : String(raw);
        return {
          available: false,
          certNumber: trimmed,
          message,
        };
      }
      throw e;
    }

    return { available: true, certNumber: trimmed, message: null };
  }
}
