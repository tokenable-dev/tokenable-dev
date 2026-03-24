import { BadRequestException, Injectable } from '@nestjs/common';
import { PinataService } from '../util/pinata/pinata.service';
import { UploadNftDto } from './dto/upload-nft.dto';
import {
  NftAttribute,
  NftMetadata,
  UploadNftResult,
} from './interfaces/nft-metadata.interface';

@Injectable()
export class NftService {
  constructor(private readonly pinataService: PinataService) {}

  async uploadToIpfs(dto: UploadNftDto, file?: Express.Multer.File): Promise<UploadNftResult> {
    if (!file && !dto.imageUrl) {
      throw new BadRequestException('이미지 파일 또는 imageUrl 중 하나는 필수입니다.');
    }

    const imageCID = file
      ? await this.pinataService.uploadFile(file)
      : await this.pinataService.uploadFromUrl(dto.imageUrl!, dto.name);

    const metadata: NftMetadata = {
      name: dto.name,
      description: dto.description,
      image: `ipfs://${imageCID}`,
      ...(dto.attributes && { attributes: dto.attributes }),
    };

    if (dto.gradedMetadata?.trim()) {
      try {
        const extra = JSON.parse(dto.gradedMetadata) as {
          graded?: Record<string, unknown>;
          attributes?: NftAttribute[];
          external_url?: string;
          properties?: Record<string, unknown>;
        };
        metadata.properties = {
          ...(metadata.properties ?? {}),
          ...(extra.properties ?? {}),
        };
        if (extra.graded && typeof extra.graded === 'object') {
          metadata.properties.graded = extra.graded;
        }
        if (extra.attributes?.length) {
          metadata.attributes = [
            ...(metadata.attributes ?? []),
            ...extra.attributes,
          ];
        }
        if (typeof extra.external_url === 'string') {
          metadata.external_url = extra.external_url;
        }
      } catch {
        throw new BadRequestException('gradedMetadata must be valid JSON');
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
