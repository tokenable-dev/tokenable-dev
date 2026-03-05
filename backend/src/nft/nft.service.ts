import { BadRequestException, Injectable } from '@nestjs/common';
import { PinataService } from '../util/pinata/pinata.service';
import { UploadNftDto } from './dto/upload-nft.dto';
import { NftMetadata, UploadNftResult } from './interfaces/nft-metadata.interface';

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

    const metadataCID = await this.pinataService.uploadMetadata(metadata);

    return {
      tokenURI: `ipfs://${metadataCID}`,
      metadataCID,
      imageCID,
      metadata,
    };
  }
}
