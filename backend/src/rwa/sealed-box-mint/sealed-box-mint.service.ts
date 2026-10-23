import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { keccak256, toUtf8Bytes } from 'ethers';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import type { SupportedChainId } from '../../blockchain/chain-config.service';
import { ChainConfigService } from '../../blockchain/chain-config.service';
import { RwaChainWriterService } from '../../blockchain/rwa-chain-writer.service';
import { RwaToken } from '../../marketplace/entities/rwa-token.entity';
import { MarketplacePartnersService } from '../../marketplace/partners/marketplace-partners.service';
import { User } from '../../user/entities/user.entity';
import { UserService } from '../../user/user.service';
import { MintSealedBoxDto } from '../dto/mint-sealed-box.dto';
import { SealedBoxMint } from '../entities/sealed-box-mint.entity';
import type { RwaMetadata } from '../interfaces/rwa-metadata.interface';
import { PinataService } from '../pinata/pinata.service';
import { RwaMintService } from '../rwa-mint.service';
import { RwaSlabS3Service } from '../rwa-slab-s3.service';

export type SealedBoxMintResult = {
  id: string;
  status: 'minted';
  tokenId: string;
  tokenURI: string;
  displayImageUrl: string;
  txHash: string;
  chainId: number;
  productName: string;
};

type CatalogProduct = {
  id: string;
  product_name: string;
  console_name: string;
  upc: string | null;
  cover_image_url: string | null;
};

type MintImage = {
  buffer: Buffer;
  mimetype: string;
};

/**
 * Instance key passed to `mintTo` because the writer rejects a zero vaultRef.
 * The contract call is still `mint(to)`. This is not the PSA cert formula.
 */
export function sealedBoxVaultRef(boxId: string): string {
  return keccak256(toUtf8Bytes(`sealed-box:${boxId}`));
}

function metadataCidFromTokenUri(uri: string): string | null {
  const rest = uri.trim().replace(/^ipfs:\/\//, '').replace(/^ipfs\//, '');
  const cid = rest.split('/')[0]?.trim();
  return cid || null;
}

function imageExt(mime: string): string {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

function isUniqueViolation(err: unknown): boolean {
  if (!(err instanceof QueryFailedError)) return false;
  const code = (err as QueryFailedError & { driverError?: { code?: string } })
    .driverError?.code;
  return code === '23505';
}

function exceptionText(err: unknown): string {
  if (err instanceof HttpException) {
    const body = err.getResponse();
    if (typeof body === 'string') return body;
    if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as { message?: string | string[] }).message;
      if (Array.isArray(message)) return message.join(', ');
      if (typeof message === 'string') return message;
    }
    return err.message;
  }
  return err instanceof Error ? err.message : String(err);
}

/** Same HTTP mapping as the admin slab upload. */
function sealedBoxStorageHttpException(err: unknown): HttpException | null {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg === 'CATALOG_COVER_S3_NOT_CONFIGURED') {
    return new ServiceUnavailableException('Catalog cover S3 is not configured');
  }
  if (msg === 'CATALOG_COVER_FILE_TOO_LARGE') {
    return new BadRequestException('Image is too large after processing');
  }
  if (msg === 'CATALOG_COVER_FILE_TYPE_INVALID') {
    return new BadRequestException('Image must be JPEG, PNG, or WebP');
  }
  if (msg === 'CATALOG_COVER_FILE_EMPTY') {
    return new BadRequestException('Invalid image upload');
  }
  return null;
}

@Injectable()
export class SealedBoxMintService {
  private readonly logger = new Logger(SealedBoxMintService.name);

  constructor(
    @InjectRepository(SealedBoxMint)
    private readonly mints: Repository<SealedBoxMint>,
    @InjectRepository(RwaToken)
    private readonly rwaTokens: Repository<RwaToken>,
    private readonly dataSource: DataSource,
    private readonly partners: MarketplacePartnersService,
    private readonly users: UserService,
    private readonly rwaMint: RwaMintService,
    private readonly slabs: RwaSlabS3Service,
    private readonly pinata: PinataService,
    private readonly chainWriter: RwaChainWriterService,
    private readonly chainConfig: ChainConfigService,
  ) {}

  async mintForPartner(
    user: User,
    chainId: SupportedChainId,
    dto: MintSealedBoxDto,
    file: Express.Multer.File | undefined,
  ): Promise<SealedBoxMintResult> {
    const product = await this.requireProduct(dto.pricechartingProductId);
    const existing = await this.mints.findOne({
      where: { userId: user.id, clientRequestId: dto.clientRequestId },
    });
    const alreadySubmitted = Boolean(
      existing &&
        (existing.status === 'minted' || existing.tokenId || existing.mintTxHash),
    );
    if (
      !alreadySubmitted &&
      !file?.buffer?.length &&
      !product.cover_image_url?.trim()
    ) {
      throw new BadRequestException('Image is required');
    }

    const partner = await this.partners.assertSelfVaultEligibleForUser(user.id);
    const recipient = await this.resolveRecipient(user.id, dto.recipientAddress);
    await this.rwaMint.assertPartnerVaultMintJobPreflight(
      user,
      recipient,
      chainId,
    );

    const row = await this.claimRow({
      userId: user.id,
      partnerId: partner.partnerId,
      chainId,
      recipient,
      product,
      clientRequestId: dto.clientRequestId,
    });

    if (row.status === 'minted' && row.tokenId && row.tokenUri && row.displayImageUrl && row.mintTxHash) {
      return this.toResult(row);
    }
    if (row.tokenId && row.mintTxHash) {
      await this.writeRegistry(row);
      row.status = 'minted';
      row.errorMessage = null;
      await this.mints.save(row);
      return this.toResult(row);
    }
    if (row.status === 'minting' && row.mintTxHash) {
      throw new ConflictException('Mint already submitted for this request');
    }

    try {
      const image = await this.resolveMintImage(file, product);
      const photo = await this.slabs.ingestBoxPhoto({
        chainId,
        boxId: row.id,
        buffer: image.buffer,
        contentType: image.mimetype,
      });
      row.photoObjectKey = photo.objectKey;
      row.displayImageUrl = photo.publicUrl;
      await this.mints.save(row);

      const imageCid = await this.pinata.uploadBuffer(
        image.buffer,
        `sealed-box-${row.id}.${imageExt(image.mimetype)}`,
        image.mimetype || 'image/jpeg',
      );
      const metadata = this.metadataFor(row, this.pinata.ipfsUri(imageCid));
      const metadataCid = await this.pinata.uploadMetadata(metadata);
      row.tokenUri = `ipfs://${metadataCid}`;
      row.vaultRef = sealedBoxVaultRef(row.id);
      await this.mints.save(row);

      const contract = this.chainConfig.getRwaAddress(chainId);
      row.tokenContract = contract;
      row.status = 'minting';
      await this.mints.save(row);

      const minted = await this.chainWriter.mintTo(
        recipient,
        row.tokenUri,
        row.vaultRef,
        chainId,
        {
          onSubmitted: async (txHash) => {
            row.mintTxHash = txHash;
            row.status = 'minting';
            await this.mints.save(row);
          },
        },
      );
      if (!Number.isFinite(minted.tokenId) || minted.tokenId < 1) {
        throw new InternalServerErrorException(
          'Mint transaction was mined but returned no token id',
        );
      }
      row.tokenId = String(minted.tokenId);
      row.mintTxHash = minted.txHash;
      await this.mints.save(row);
      await this.writeRegistry(row);
      row.status = 'minted';
      row.errorMessage = null;
      await this.mints.save(row);
      this.rwaMint.flushPostMintPortfolioWork(recipient, [minted.tokenId], chainId);
      this.logger.log(
        `sealed box minted id=${row.id} token=${row.tokenId} chain=${chainId}`,
      );
      return this.toResult(row);
    } catch (err) {
      return this.fail(row, err);
    }
  }

  private async fail(row: SealedBoxMint, err: unknown): Promise<never> {
    row.errorMessage = exceptionText(err).slice(0, 500);
    row.status = row.mintTxHash ? 'minting' : 'failed';
    await this.mints.save(row);
    if (err instanceof HttpException) throw err;
    const mapped = sealedBoxStorageHttpException(err);
    if (mapped) throw mapped;
    throw err;
  }

  private metadataFor(row: SealedBoxMint, imageUrl: string): RwaMetadata {
    const set = row.consoleName.trim();
    const attributes = [
      { trait_type: 'Asset', value: 'Sealed box' },
      ...(set ? [{ trait_type: 'Set', value: set }] : []),
      { trait_type: 'PriceCharting product', value: row.pricechartingProductId },
      ...(row.upc ? [{ trait_type: 'UPC', value: row.upc }] : []),
    ];
    return {
      name: row.productName,
      description: set ? `${row.productName} · ${set}` : row.productName,
      image: imageUrl,
      attributes,
      properties: {
        assetKind: 'sealed_box',
        pricechartingProductId: row.pricechartingProductId,
        productName: row.productName,
        consoleName: set,
        upc: row.upc,
      },
    };
  }

  private async writeRegistry(row: SealedBoxMint): Promise<void> {
    if (!row.tokenContract || !row.tokenId || !row.tokenUri || !row.vaultRef) {
      throw new InternalServerErrorException('Sealed box mint record is incomplete');
    }
    const mintTxHash = row.mintTxHash?.trim().toLowerCase() ?? '';
    const storedMintTx = /^0x[a-f0-9]{64}$/.test(mintTxHash) ? mintTxHash : null;
    await this.rwaTokens
      .createQueryBuilder()
      .insert()
      .into(RwaToken)
      .values({
        tokenContract: row.tokenContract,
        tokenId: row.tokenId,
        certNumber: null,
        tokenUri: row.tokenUri,
        metadataCid: metadataCidFromTokenUri(row.tokenUri),
        displayName: row.productName,
        displayImageUrl: row.displayImageUrl,
        displayImageBackUrl: null,
        collectionKey: null,
        metadataSyncedAt: new Date(),
        vaultCycleId: null,
        vaultRef: row.vaultRef,
        settlementPolicy: 'self_vault_hold',
        vaultPartnerId: row.partnerId,
        ownerWallet: row.recipientAddress,
        ...(storedMintTx ? { mintTxHash: storedMintTx } : {}),
      })
      .orUpdate(
        [
          'token_uri',
          'metadata_cid',
          'display_name',
          'display_image_url',
          'vault_ref',
          'settlement_policy',
          'vault_partner_id',
          'owner_wallet',
          'metadata_synced_at',
          ...(storedMintTx ? (['mint_tx_hash'] as const) : []),
        ],
        ['token_contract', 'token_id'],
      )
      .execute();
  }

  /**
   * Partner upload wins. Otherwise copy the admin representative image into this
   * mint's own S3 photo so a later cover change does not rewrite the portfolio.
   */
  private async resolveMintImage(
    file: Express.Multer.File | undefined,
    product: CatalogProduct,
  ): Promise<MintImage> {
    if (file?.buffer?.length) {
      return { buffer: file.buffer, mimetype: file.mimetype || 'image/jpeg' };
    }
    const cover = product.cover_image_url?.trim() ?? '';
    let parsed: URL | null = null;
    try {
      parsed = cover ? new URL(cover) : null;
    } catch {
      parsed = null;
    }
    if (!parsed || (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')) {
      throw new BadRequestException('Image is required');
    }
    try {
      const fetched = await this.pinata.fetchImageBufferFromUrl(cover);
      if (!fetched.buffer.length) {
        throw new BadRequestException('Representative image could not be loaded');
      }
      return { buffer: fetched.buffer, mimetype: fetched.mimeType || 'image/jpeg' };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('Representative image could not be loaded');
    }
  }

  private async requireProduct(id: string): Promise<CatalogProduct> {
    const rows = await this.dataSource.query<CatalogProduct[]>(
      `SELECT id, product_name, console_name, upc, cover_image_url
       FROM pricecharting_products WHERE id = $1 LIMIT 1`,
      [id],
    );
    const product = rows[0];
    if (!product) {
      throw new NotFoundException('Catalog product not found');
    }
    const name = product.product_name?.trim();
    if (!name) {
      throw new BadRequestException('Catalog product has no name');
    }
    return { ...product, product_name: name, console_name: product.console_name?.trim() ?? '' };
  }

  private async claimRow(input: {
    userId: string;
    partnerId: string;
    chainId: number;
    recipient: string;
    product: CatalogProduct;
    clientRequestId: string;
  }): Promise<SealedBoxMint> {
    const existing = await this.mints.findOne({
      where: { userId: input.userId, clientRequestId: input.clientRequestId },
    });
    if (existing) return this.reuse(existing, input);

    try {
      return await this.mints.save(
        this.mints.create({
          id: randomUUID(),
          userId: input.userId,
          partnerId: input.partnerId,
          chainId: input.chainId,
          pricechartingProductId: input.product.id,
          productName: input.product.product_name,
          consoleName: input.product.console_name,
          upc: input.product.upc,
          clientRequestId: input.clientRequestId,
          status: 'pending',
          recipientAddress: input.recipient,
          errorMessage: null,
        }),
      );
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
      const raced = await this.mints.findOne({
        where: { userId: input.userId, clientRequestId: input.clientRequestId },
      });
      if (!raced) throw err;
      return this.reuse(raced, input);
    }
  }

  private reuse(
    existing: SealedBoxMint,
    input: {
      partnerId: string;
      chainId: number;
      recipient: string;
      product: CatalogProduct;
    },
  ): SealedBoxMint {
    if (existing.status === 'minted' || existing.tokenId || existing.mintTxHash) {
      return existing;
    }
    existing.partnerId = input.partnerId;
    existing.chainId = input.chainId;
    existing.recipientAddress = input.recipient;
    existing.pricechartingProductId = input.product.id;
    existing.productName = input.product.product_name;
    existing.consoleName = input.product.console_name;
    existing.upc = input.product.upc;
    existing.status = 'pending';
    existing.errorMessage = null;
    return existing;
  }

  private async resolveRecipient(userId: string, explicit?: string): Promise<string> {
    if (explicit?.trim()) {
      const addr = explicit.trim().toLowerCase();
      const wallets = await this.users.listWalletsForUser(userId);
      const linked = wallets.some(
        (w) => w.walletAddress.trim().toLowerCase() === addr,
      );
      if (!linked) {
        throw new ForbiddenException(
          'Recipient wallet must be linked to your Tokenable account',
        );
      }
      return addr;
    }
    const wallets = await this.users.listWalletsForUser(userId);
    const primary =
      wallets.find((w) => w.isPrimary)?.walletAddress ?? wallets[0]?.walletAddress;
    if (!primary?.trim()) {
      throw new BadRequestException('Link a wallet before minting');
    }
    return primary.trim().toLowerCase();
  }

  private toResult(row: SealedBoxMint): SealedBoxMintResult {
    if (!row.tokenId || !row.tokenUri || !row.displayImageUrl || !row.mintTxHash) {
      throw new InternalServerErrorException('Sealed box mint record is incomplete');
    }
    return {
      id: row.id,
      status: 'minted',
      tokenId: row.tokenId,
      tokenURI: row.tokenUri,
      displayImageUrl: row.displayImageUrl,
      txHash: row.mintTxHash,
      chainId: row.chainId,
      productName: row.productName,
    };
  }
}
