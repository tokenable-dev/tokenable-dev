import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinataSDK } from 'pinata';
import { Readable } from 'stream';
import { NftMetadata } from '../../nft/interfaces/nft-metadata.interface';

@Injectable()
export class PinataService {
  private readonly logger = new Logger(PinataService.name);
  private readonly pinata: PinataSDK;

  constructor(private readonly configService: ConfigService) {
    this.pinata = new PinataSDK({
      pinataJwt: configService.getOrThrow<string>('PINATA_JWT'),
      pinataGateway: configService.getOrThrow<string>('PINATA_GATEWAY'),
    });
  }

  async uploadBuffer(buffer: Buffer, filename: string, mimeType: string): Promise<string> {
    try {
      const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
      const pinataFile = new File([blob], filename, { type: mimeType });
      const result = await this.pinata.upload.public.file(pinataFile);
      this.logger.log(`Buffer uploaded to IPFS: ${result.cid}`);
      return result.cid;
    } catch (error) {
      this.logger.error('Failed to upload buffer to Pinata', error);
      throw new InternalServerErrorException('이미지 IPFS 업로드에 실패했습니다.');
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    try {
      const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
      const pinataFile = new File([blob], file.originalname, { type: file.mimetype });

      const result = await this.pinata.upload.public.file(pinataFile);
      this.logger.log(`Image uploaded to IPFS: ${result.cid}`);
      return result.cid;
    } catch (error) {
      this.logger.error('Failed to upload file to Pinata', error);
      throw new InternalServerErrorException('이미지 IPFS 업로드에 실패했습니다.');
    }
  }

  async uploadFromUrl(imageUrl: string, name: string): Promise<string> {
    try {
      const response = await fetch(imageUrl, {
        headers: {
          'User-Agent': 'TokenableBackend/1.0 (NFT image fetch)',
        },
      });
      if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);

      const arrayBuffer = await response.arrayBuffer();
      const mimeType = response.headers.get('content-type') ?? 'image/png';
      const extension = mimeType.split('/')[1] ?? 'png';

      const blob = new Blob([arrayBuffer], { type: mimeType });
      const pinataFile = new File([blob], `${name}.${extension}`, { type: mimeType });

      const result = await this.pinata.upload.public.file(pinataFile);
      this.logger.log(`Image (from URL) uploaded to IPFS: ${result.cid}`);
      return result.cid;
    } catch (error) {
      this.logger.error('Failed to upload image from URL to Pinata', error);
      throw new InternalServerErrorException('URL 이미지 IPFS 업로드에 실패했습니다.');
    }
  }

  async uploadMetadata(metadata: NftMetadata): Promise<string> {
    try {
      const result = await this.pinata.upload.public.json(metadata);
      this.logger.log(`Metadata uploaded to IPFS: ${result.cid}`);
      return result.cid;
    } catch (error) {
      this.logger.error('Failed to upload metadata to Pinata', error);
      throw new InternalServerErrorException('메타데이터 IPFS 업로드에 실패했습니다.');
    }
  }
}
