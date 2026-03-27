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

  /**
   * `uploadFromUrl`과 동일한 헤더로 이미지를 가져온다.
   * PSA 슬랩 크롭 등 동일 바이트로 여러 작업을 할 때 한 번만 fetch하기 위해 사용.
   */
  async fetchImageBufferFromUrl(
    imageUrl: string,
  ): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'TokenableBackend/1.0 (NFT image fetch)',
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? 'image/png';
    const extPart = mimeType.split('/')[1] ?? 'png';
    const extension = /^[a-z0-9+.-]+$/i.test(extPart) ? extPart : 'png';
    return { buffer, mimeType, extension };
  }

  async uploadFromUrl(imageUrl: string, name: string): Promise<string> {
    try {
      const { buffer, mimeType, extension } = await this.fetchImageBufferFromUrl(imageUrl);
      return await this.uploadBuffer(buffer, `${name}.${extension}`, mimeType);
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
