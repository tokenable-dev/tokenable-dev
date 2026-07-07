import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { VaultService } from '../vault/vault.service';
import { psaCertNumberFromGradedMeta } from '../marketplace/utils/collection-image.util';
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
  ) {}

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
    // Pre-flight only: the authoritative check happens again inside
    // VaultService.reserveCycleForDeposit() at mint time (race-safe).
    // A physical asset can be re-vaulted once its prior cycle is redeemed —
    // this only blocks a cert that currently has a live, un-redeemed NFT.
    await this.vault.assertAvailableForNewCycle(certNumber);

    let imageCID: string;

    if (file?.buffer) {
      imageCID = await this.pinataService.uploadFile(file);
    } else if (dto.imageUrl) {
      try {
        imageCID = await this.pinataService.uploadFromUrl(
          dto.imageUrl,
          dto.name,
        );
      } catch {
        throw new InternalServerErrorException(
          'URL 이미지 IPFS 업로드에 실패했습니다.',
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
      // HTTPS gateway URL → single file CID; MetaMask/OpenSea cannot render directory CIDs.
      image: this.pinataService.ipfsHttpsUrl(imageCID),
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
