import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PinataSDK } from 'pinata';
import { RwaMetadata } from '../interfaces/rwa-metadata.interface';
import { safeIpfsUploadFilename } from './pinata-filename.util';

function pinataErrorDetail(error: unknown): string {
  if (error == null) return 'unknown';
  if (error instanceof Error) {
    const any = error as Error & {
      status?: number;
      statusCode?: number;
      body?: unknown;
    };
    const st = any.status ?? any.statusCode;
    const body =
      typeof any.body === 'string'
        ? any.body.slice(0, 500)
        : any.body != null
          ? JSON.stringify(any.body).slice(0, 500)
          : '';
    return [any.message, st != null ? `http=${st}` : '', body]
      .filter(Boolean)
      .join(' | ');
  }
  return String(error);
}

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

  /** Browser/wallet-loadable HTTPS URL for a pinned CID (single file). */
  ipfsHttpsUrl(cid: string): string {
    const host = this.configService.getOrThrow<string>('PINATA_GATEWAY').trim();
    return `https://${host}/ipfs/${cid}`;
  }

  /**
   * On-chain metadata `image` value.
   * Prefer the configured dedicated Pinata HTTPS gateway: wallets (MetaMask)
   * resolve `ipfs://` via public gateways (ipfs.io / Cloudflare), which often
   * cannot find freshly Pinata-pinned CIDs. Dedicated gateway URLs with empty
   * Access Controls serve our pins publicly and load reliably in MetaMask.
   * Sepolia Etherscan still may not render NFT media either way.
   */
  ipfsUri(cid: string): string {
    return this.ipfsHttpsUrl(cid);
  }

  async uploadBuffer(
    buffer: Buffer,
    filename: string,
    mimeType: string,
  ): Promise<string> {
    try {
      const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
      const safeName = safeIpfsUploadFilename(filename, mimeType.split('/')[1] ?? 'jpg');
      const pinataFile = new File([blob], safeName, { type: mimeType });
      const result = await this.pinata.upload.public.file(pinataFile);
      this.logger.log(`Buffer uploaded to IPFS: ${result.cid} (${safeName})`);
      return result.cid;
    } catch (error) {
      this.logger.error(
        `Failed to upload buffer to Pinata (${filename}): ${pinataErrorDetail(error)}`,
      );
      throw new InternalServerErrorException(
        '이미지 IPFS 업로드에 실패했습니다.',
      );
    }
  }

  async uploadFile(file: Express.Multer.File): Promise<string> {
    try {
      const blob = new Blob([new Uint8Array(file.buffer)], {
        type: file.mimetype,
      });
      const ext = file.mimetype.split('/')[1] ?? 'jpg';
      const safeName = safeIpfsUploadFilename(file.originalname, ext);
      const pinataFile = new File([blob], safeName, {
        type: file.mimetype,
      });

      const result = await this.pinata.upload.public.file(pinataFile);
      this.logger.log(`Image uploaded to IPFS: ${result.cid} (${safeName})`);
      return result.cid;
    } catch (error) {
      this.logger.error(
        `Failed to upload file to Pinata (${file.originalname}): ${pinataErrorDetail(error)}`,
      );
      throw new InternalServerErrorException(
        '이미지 IPFS 업로드에 실패했습니다.',
      );
    }
  }

  /** `uploadFromUrl`과 동일한 헤더로 이미지를 가져온다. */
  async fetchImageBufferFromUrl(
    imageUrl: string,
  ): Promise<{ buffer: Buffer; mimeType: string; extension: string }> {
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'TokenableBackend/1.0 (RWA image fetch)',
      },
    });
    if (!response.ok) {
      throw new Error(
        `Failed to fetch image: ${response.status} ${response.statusText}`,
      );
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const mimeType =
      response.headers.get('content-type')?.split(';')[0]?.trim() ??
      'image/png';
    const extPart = mimeType.split('/')[1] ?? 'png';
    const extension = /^[a-z0-9+.-]+$/i.test(extPart) ? extPart : 'png';
    return { buffer, mimeType, extension };
  }

  async uploadFromUrl(imageUrl: string, name: string): Promise<string> {
    try {
      const { buffer, mimeType, extension } =
        await this.fetchImageBufferFromUrl(imageUrl);
      return await this.uploadBuffer(buffer, `${name}.${extension}`, mimeType);
    } catch (error) {
      this.logger.error(
        `Failed to upload image from URL to Pinata (${imageUrl.slice(0, 120)}): ${pinataErrorDetail(error)}`,
      );
      throw new InternalServerErrorException(
        'URL 이미지 IPFS 업로드에 실패했습니다.',
      );
    }
  }

  async uploadMetadata(metadata: RwaMetadata): Promise<string> {
    try {
      const result = await this.pinata.upload.public.json(metadata);
      this.logger.log(`Metadata uploaded to IPFS: ${result.cid}`);
      return result.cid;
    } catch (error) {
      this.logger.error(
        `Failed to upload metadata to Pinata: ${pinataErrorDetail(error)}`,
      );
      throw new InternalServerErrorException(
        '메타데이터 IPFS 업로드에 실패했습니다.',
      );
    }
  }
}
