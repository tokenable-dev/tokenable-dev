import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RwaChainWriterService } from '../../blockchain/rwa-chain-writer.service';
import {
  ChainConfigService,
  type SupportedChainId,
} from '../../blockchain/chain-config.service';
import { mintRejectionMessage } from '../../marketplace/utils/psa-grade-policy.util';
import { Order, OrderStatus } from '../../marketplace/entities/order.entity';
import { MarketplacePartnersService } from '../../marketplace/partners/marketplace-partners.service';
import { OrdersService } from '../../marketplace/orders/orders.service';
import {
  extractPsaCertImageUrlsFromApiBody,
  extractPsaCertImagesFromGetImagesBody,
} from '../../psa/utils/psa-cert-images.util';
import {
  parseGradeFromPsaCertRecord,
  PsaPublicApiService,
  type PsaCertRecord,
} from '../../psa/psa-public-api.service';
import { VaultService } from '../../vault/vault.service';
import { PinataService } from '../pinata/pinata.service';
import {
  BulkMintJob,
  type BulkMintJobStatus,
} from '../entities/bulk-mint-job.entity';
import { BulkMintJobItem } from '../entities/bulk-mint-job-item.entity';
import {
  BULK_MINT_MAX_ITEMS,
  BULK_MINT_ON_CHAIN_CHUNK,
  parseCertPriceRowsFromUpload,
  type BulkMintCertPriceRow,
} from './bulk-mint-cert-list.util';
import { buildBulkMintMetadataFromPsaCert } from './bulk-mint-prepare.util';
import { PartnerSeaportAskService } from './partner-seaport-ask.service';

export type CreateBulkMintJobInput = {
  partnerId: string;
  items?: Array<{ certNumber: string; price: string }>;
  csvText?: string;
  file?: { buffer: Buffer; originalname: string };
};

export type BulkMintSaleStatus =
  | 'listed'
  | 'sold'
  | 'cancelled'
  | 'expired'
  | 'none';

export type BulkMintJobItemView = BulkMintJobItem & {
  saleStatus: BulkMintSaleStatus;
};

export type BulkMintJobView = Omit<BulkMintJob, 'items'> & {
  partnerDisplayName: string | null;
  partnerWalletAddress: string | null;
  items?: BulkMintJobItemView[];
};

export type BulkMintJobSummary = {
  id: string;
  status: BulkMintJobStatus;
  partnerId: string;
  partnerDisplayName: string | null;
  partnerWalletAddress: string | null;
  chainId: number;
  itemCount: number;
  preparedCount: number;
  mintedCount: number;
  listedCount: number;
  failedCount: number;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type PartnerInventoryItem = {
  itemId: string;
  jobId: string;
  certNumber: string;
  listPriceUsdc: string;
  tokenId: string | null;
  orderHash: string | null;
  itemStatus: string;
  saleStatus: BulkMintSaleStatus;
  updatedAt: Date;
};

@Injectable()
export class BulkMintJobService {
  private readonly logger = new Logger(BulkMintJobService.name);
  private readonly prepareInflight = new Set<string>();
  private readonly commitInflight = new Set<string>();

  constructor(
    @InjectRepository(BulkMintJob)
    private readonly jobRepo: Repository<BulkMintJob>,
    @InjectRepository(BulkMintJobItem)
    private readonly itemRepo: Repository<BulkMintJobItem>,
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    private readonly psaPublicApi: PsaPublicApiService,
    private readonly pinata: PinataService,
    private readonly vault: VaultService,
    private readonly chainWriter: RwaChainWriterService,
    private readonly chainConfig: ChainConfigService,
    private readonly partners: MarketplacePartnersService,
    private readonly partnerAsks: PartnerSeaportAskService,
    private readonly orders: OrdersService,
  ) {}

  async listJobs(opts?: {
    partnerId?: string;
    limit?: number;
  }): Promise<BulkMintJobSummary[]> {
    const cap = Math.min(Math.max(1, opts?.limit ?? 50), 100);
    const where = opts?.partnerId?.trim()
      ? { partnerId: opts.partnerId.trim() }
      : {};
    const rows = await this.jobRepo.find({
      where,
      relations: { partner: true },
      order: { createdAt: 'DESC' },
      take: cap,
    });
    return rows.map((job) => ({
      id: job.id,
      status: job.status,
      partnerId: job.partnerId,
      partnerDisplayName: job.partner?.displayName ?? null,
      partnerWalletAddress: job.partner?.walletAddress ?? null,
      chainId: job.chainId,
      itemCount: job.itemCount,
      preparedCount: job.preparedCount,
      mintedCount: job.mintedCount,
      listedCount: job.listedCount,
      failedCount: job.failedCount,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    }));
  }

  async getPartnerInventory(partnerId: string): Promise<PartnerInventoryItem[]> {
    await this.partners.getOrThrow(partnerId);
    const items = await this.itemRepo
      .createQueryBuilder('i')
      .innerJoinAndSelect('i.job', 'j')
      .where('j.partner_id = :partnerId', { partnerId })
      .andWhere('i.token_id IS NOT NULL')
      .orderBy('i.updated_at', 'DESC')
      .take(500)
      .getMany();

    const orderHashes = items
      .map((i) => i.orderHash)
      .filter((h): h is string => Boolean(h));
    const orderByHash = new Map<string, Order>();
    if (orderHashes.length) {
      const orders = await this.orderRepo.find({
        where: { orderHash: In(orderHashes) },
      });
      for (const o of orders) orderByHash.set(o.orderHash, o);
    }

    return items.map((item) => {
      const order = item.orderHash
        ? orderByHash.get(item.orderHash)
        : undefined;
      let saleStatus: BulkMintSaleStatus = 'none';
      if (order) {
        if (order.status === OrderStatus.FULFILLED) saleStatus = 'sold';
        else if (order.status === OrderStatus.ACTIVE) saleStatus = 'listed';
        else if (order.status === OrderStatus.CANCELLED) saleStatus = 'cancelled';
        else if (order.status === OrderStatus.EXPIRED) saleStatus = 'expired';
      } else if (item.status === 'listed') {
        saleStatus = 'listed';
      }
      return {
        itemId: item.id,
        jobId: item.jobId,
        certNumber: item.certNumber,
        listPriceUsdc: item.listPriceUsdc,
        tokenId: item.tokenId,
        orderHash: item.orderHash,
        itemStatus: item.status,
        saleStatus,
        updatedAt: item.updatedAt,
      };
    });
  }

  /**
   * Cancel an active Seaport ask for a bulk-mint item (offerer = partner wallet).
   * Sets item to list_failed so commit can re-list.
   */
  async cancelItemListing(
    jobId: string,
    itemId: string,
  ): Promise<BulkMintJobView> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: { partner: true },
    });
    if (!job) throw new NotFoundException(`Bulk mint job ${jobId} not found`);
    const item = await this.itemRepo.findOne({
      where: { id: itemId, jobId },
    });
    if (!item) throw new NotFoundException(`Item ${itemId} not found on job`);
    if (!item.orderHash) {
      throw new BadRequestException('Item has no orderHash to cancel');
    }
    const wallet = job.partner?.walletAddress;
    if (!wallet) {
      const p = await this.partners.getOrThrow(job.partnerId);
      await this.orders.cancelOrder(item.orderHash, p.walletAddress);
    } else {
      await this.orders.cancelOrder(item.orderHash, wallet);
    }
    await this.itemRepo.update(
      { id: item.id },
      {
        status: 'list_failed',
        errorMessage: 'Listing cancelled by admin — re-run commit to re-list',
      },
    );
    await this.refreshJobCounters(jobId);
    await this.jobRepo.update(
      { id: jobId },
      {
        status: 'ready_to_commit',
        errorMessage: 'Listing cancelled — retry commit to re-list',
      },
    );
    return this.getJobOrThrow(jobId);
  }

  async createJob(input: CreateBulkMintJobInput): Promise<BulkMintJobView> {
    const partner = await this.partners.getOrThrow(input.partnerId);
    if (!partner.isActive) {
      throw new BadRequestException('Partner is inactive');
    }

    const rows = parseCertPriceRowsFromUpload({
      items: input.items,
      text: input.csvText,
      buffer: input.file?.buffer,
      filename: input.file?.originalname,
    });
    if (!rows.length) {
      throw new BadRequestException(
        'No valid cert+price rows found (need certNumber and price columns in JSON, CSV, or Excel)',
      );
    }
    if (rows.length > BULK_MINT_MAX_ITEMS) {
      throw new BadRequestException(
        `Bulk mint max is ${BULK_MINT_MAX_ITEMS} certs (got ${rows.length})`,
      );
    }

    const chainId = this.chainConfig.getDefaultChainId();
    const job = await this.jobRepo.save(
      this.jobRepo.create({
        status: 'pending' satisfies BulkMintJobStatus,
        partnerId: partner.id,
        chainId,
        itemCount: rows.length,
        preparedCount: 0,
        mintedCount: 0,
        listedCount: 0,
        failedCount: 0,
        errorMessage: null,
      }),
    );

    const items = rows.map((row: BulkMintCertPriceRow, sortIndex) =>
      this.itemRepo.create({
        jobId: job.id,
        certNumber: row.certNumber,
        listPriceUsdc: row.priceUsdc,
        status: 'pending',
        tokenUri: null,
        vaultRef: null,
        tokenId: null,
        txHash: null,
        orderHash: null,
        vaultCycleId: null,
        errorMessage: null,
        sortIndex,
      }),
    );
    await this.itemRepo.save(items);

    void this.runPrepare(job.id);
    return this.getJobOrThrow(job.id);
  }

  async getJobOrThrow(jobId: string): Promise<BulkMintJobView> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: { items: true, partner: true },
    });
    if (!job) throw new NotFoundException(`Bulk mint job ${jobId} not found`);
    if (job.items?.length) {
      job.items.sort((a, b) => a.sortIndex - b.sortIndex);
    }

    const orderHashes = (job.items ?? [])
      .map((i) => i.orderHash)
      .filter((h): h is string => Boolean(h));
    const orderByHash = new Map<string, Order>();
    if (orderHashes.length) {
      const orders = await this.orderRepo.find({
        where: { orderHash: In(orderHashes) },
      });
      for (const o of orders) orderByHash.set(o.orderHash, o);
    }

    const items: BulkMintJobItemView[] = (job.items ?? []).map((item) => {
      const order = item.orderHash
        ? orderByHash.get(item.orderHash)
        : undefined;
      let saleStatus: BulkMintSaleStatus = 'none';
      if (order) {
        if (order.status === OrderStatus.FULFILLED) saleStatus = 'sold';
        else if (order.status === OrderStatus.ACTIVE) saleStatus = 'listed';
        else if (order.status === OrderStatus.CANCELLED) saleStatus = 'cancelled';
        else if (order.status === OrderStatus.EXPIRED) saleStatus = 'expired';
      } else if (item.status === 'listed') {
        saleStatus = 'listed';
      }
      return Object.assign(item, { saleStatus });
    });

    // Never serialize partner.encryptedPrivateKey — only public display fields.
    const {
      partner: _partner,
      items: _items,
      ...jobRow
    } = job;

    return {
      ...jobRow,
      partnerDisplayName: job.partner?.displayName ?? null,
      partnerWalletAddress: job.partner?.walletAddress ?? null,
      items,
    };
  }

  /** Start (or re-start) prepare for pending / prepare_failed items. */
  async startPrepare(jobId: string): Promise<BulkMintJobView> {
    const job = await this.getJobOrThrow(jobId);
    if (job.status === 'committing' || job.status === 'completed') {
      throw new BadRequestException(`Cannot prepare job in status=${job.status}`);
    }
    void this.runPrepare(jobId);
    return this.getJobOrThrow(jobId);
  }

  async commit(jobId: string): Promise<BulkMintJobView> {
    const job = await this.getJobOrThrow(jobId);
    if (job.status === 'committing') {
      return job;
    }
    const readyCount = (job.items ?? []).filter((i) => i.status === 'ready').length;
    const listRetryCount = (job.items ?? []).filter(
      (i) => i.status === 'minted' || i.status === 'list_failed',
    ).length;
    if (!readyCount && !listRetryCount) {
      throw new BadRequestException(
        `No items ready to mint/list (job status=${job.status})`,
      );
    }
    if (
      job.status !== 'ready_to_commit' &&
      job.status !== 'failed' &&
      job.status !== 'completed'
    ) {
      throw new BadRequestException(
        `Job cannot commit from status=${job.status}`,
      );
    }

    void this.runCommit(jobId);
    return this.getJobOrThrow(jobId);
  }

  private async runPrepare(jobId: string): Promise<void> {
    if (this.prepareInflight.has(jobId)) return;
    this.prepareInflight.add(jobId);
    try {
      await this.jobRepo.update({ id: jobId }, { status: 'preparing', errorMessage: null });
      const items = await this.itemRepo.find({
        where: {
          jobId,
          status: In(['pending', 'prepare_failed']),
        },
        order: { sortIndex: 'ASC' },
      });

      for (const item of items) {
        await this.prepareOneItem(item);
      }

      await this.refreshJobCounters(jobId);
      const job = await this.jobRepo.findOne({ where: { id: jobId } });
      if (!job) return;
      const ready = await this.itemRepo.count({ where: { jobId, status: 'ready' } });
      if (ready > 0) {
        await this.jobRepo.update({ id: jobId }, { status: 'ready_to_commit' });
      } else {
        await this.jobRepo.update(
          { id: jobId },
          {
            status: 'failed',
            errorMessage: 'All items failed prepare (PSA / grade / IPFS)',
          },
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`bulk mint prepare failed job=${jobId}: ${msg}`);
      await this.jobRepo.update(
        { id: jobId },
        { status: 'failed', errorMessage: msg },
      );
    } finally {
      this.prepareInflight.delete(jobId);
    }
  }

  private async prepareOneItem(item: BulkMintJobItem): Promise<void> {
    await this.itemRepo.update(
      { id: item.id },
      { status: 'preparing', errorMessage: null },
    );
    try {
      await this.vault.assertAvailableForNewCycle(item.certNumber);

      const lookup = await this.psaPublicApi.getByCertNumber(item.certNumber);
      if (lookup.status !== 'success' || !lookup.raw) {
        let msg = 'PSA lookup failed';
        if (lookup.status === 'error') msg = lookup.message;
        else if (lookup.status === 'disabled') msg = `PSA disabled: ${lookup.reason}`;
        else if (lookup.status === 'skipped') msg = `PSA lookup skipped: ${lookup.reason}`;
        throw new Error(msg);
      }

      const psaCert = (lookup.raw as { PSACert?: PsaCertRecord }).PSACert;
      if (!psaCert || typeof psaCert !== 'object') {
        throw new Error('PSA response missing PSACert');
      }

      const { label, score } = parseGradeFromPsaCertRecord(psaCert);
      const gradeReject = mintRejectionMessage({
        gradingCompany: 'PSA',
        gradeScore: score,
        gradeLabel: label,
        gradeDescription:
          typeof psaCert.GradeDescription === 'string'
            ? psaCert.GradeDescription
            : null,
      });
      if (gradeReject) throw new Error(gradeReject);

      let imageUrl =
        extractPsaCertImageUrlsFromApiBody(lookup.raw, item.certNumber).front ??
        null;
      if (!imageUrl) {
        const imgs = await this.psaPublicApi.getImagesByCertNumber(item.certNumber);
        if (imgs.status === 'success') {
          imageUrl =
            extractPsaCertImagesFromGetImagesBody(imgs.raw).front ??
            extractPsaCertImagesFromGetImagesBody(imgs.raw).back ??
            null;
        }
      }
      if (!imageUrl) {
        throw new Error('No PSA slab image URL available for this cert');
      }

      const { name, metadata } = buildBulkMintMetadataFromPsaCert({
        certNumber: item.certNumber,
        psaCert,
        imageUrl: '',
      });

      let imageCid: string;
      try {
        imageCid = await this.pinata.uploadFromUrl(imageUrl, name);
      } catch (e) {
        throw new Error(
          `IPFS image upload failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
      metadata.image = this.pinata.ipfsHttpsUrl(imageCid);
      const metadataCid = await this.pinata.uploadMetadata(metadata);
      const tokenUri = `ipfs://${metadataCid}`;
      const vaultRef = VaultService.computeVaultRef(item.certNumber);

      await this.itemRepo.update(
        { id: item.id },
        {
          status: 'ready',
          tokenUri,
          vaultRef,
          errorMessage: null,
        },
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(
        `bulk mint prepare item cert=${item.certNumber}: ${msg}`,
      );
      await this.itemRepo.update(
        { id: item.id },
        { status: 'prepare_failed', errorMessage: msg },
      );
    }
  }

  private async runCommit(jobId: string): Promise<void> {
    if (this.commitInflight.has(jobId)) return;
    this.commitInflight.add(jobId);
    try {
      await this.jobRepo.update({ id: jobId }, { status: 'committing', errorMessage: null });
      const job = await this.jobRepo.findOne({
        where: { id: jobId },
        relations: { items: true },
      });
      if (!job) return;

      const { partner, privateKey } = await this.partners.getDecryptedPrivateKey(
        job.partnerId,
      );
      const mintTo = partner.walletAddress;
      const contract = this.chainConfig.getRwaAddress(
        job.chainId as SupportedChainId,
      );

      const ready = (job.items ?? []).filter((i) => i.status === 'ready');
      for (let i = 0; i < ready.length; i += BULK_MINT_ON_CHAIN_CHUNK) {
        const chunk = ready.slice(i, i + BULK_MINT_ON_CHAIN_CHUNK);
        await this.commitMintChunk(job, chunk, mintTo, contract);
      }

      // List newly minted + retry list_failed / minted-without-order
      const toList = await this.itemRepo.find({
        where: {
          jobId,
          status: In(['minted', 'list_failed']),
        },
        order: { sortIndex: 'ASC' },
      });
      for (const item of toList) {
        if (!item.tokenId || !item.listPriceUsdc) {
          await this.itemRepo.update(
            { id: item.id },
            {
              status: 'list_failed',
              errorMessage: 'Missing tokenId or listPriceUsdc after mint',
            },
          );
          continue;
        }
        try {
          const order = await this.partnerAsks.createAskListing({
            privateKey,
            tokenId: item.tokenId,
            priceUsdc: item.listPriceUsdc,
            chainId: job.chainId as SupportedChainId,
          });
          await this.itemRepo.update(
            { id: item.id },
            {
              status: 'listed',
              orderHash: order.orderHash,
              errorMessage: null,
            },
          );
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          this.logger.warn(
            `bulk list failed cert=${item.certNumber} token=${item.tokenId}: ${msg}`,
          );
          await this.itemRepo.update(
            { id: item.id },
            { status: 'list_failed', errorMessage: msg },
          );
        }
      }

      await this.refreshJobCounters(jobId);
      const remainingReady = await this.itemRepo.count({
        where: { jobId, status: 'ready' },
      });
      const remainingList = await this.itemRepo.count({
        where: { jobId, status: In(['minted', 'list_failed']) },
      });
      const listed = await this.itemRepo.count({
        where: { jobId, status: 'listed' },
      });
      if (remainingReady > 0 || remainingList > 0) {
        await this.jobRepo.update(
          { id: jobId },
          {
            status: 'ready_to_commit',
            errorMessage:
              'Partial commit — some items remain (retry commit to mint/list)',
          },
        );
      } else if (listed > 0) {
        await this.jobRepo.update(
          { id: jobId },
          { status: 'completed', errorMessage: null },
        );
      } else {
        await this.jobRepo.update(
          { id: jobId },
          { status: 'failed', errorMessage: 'Commit finished with no listed items' },
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`bulk mint commit failed job=${jobId}: ${msg}`);
      await this.refreshJobCounters(jobId);
      const remainingReady = await this.itemRepo.count({
        where: { jobId, status: 'ready' },
      });
      await this.jobRepo.update(
        { id: jobId },
        {
          status: remainingReady > 0 ? 'ready_to_commit' : 'failed',
          errorMessage: msg,
        },
      );
    } finally {
      this.commitInflight.delete(jobId);
    }
  }

  private async commitMintChunk(
    job: BulkMintJob,
    chunk: BulkMintJobItem[],
    mintTo: string,
    tokenContract: string,
  ): Promise<void> {
    const reserved: Array<{ item: BulkMintJobItem; cycleId: string }> = [];

    for (const item of chunk) {
      if (!item.tokenUri || !item.vaultRef) {
        await this.itemRepo.update(
          { id: item.id },
          {
            status: 'mint_failed',
            errorMessage: 'Missing tokenUri/vaultRef after prepare',
          },
        );
        continue;
      }
      await this.itemRepo.update({ id: item.id }, { status: 'minting' });
      try {
        const { cycle } = await this.vault.reserveCycleForDeposit({
          certNumber: item.certNumber,
        });
        reserved.push({ item, cycleId: cycle.id });
        await this.itemRepo.update(
          { id: item.id },
          { vaultCycleId: cycle.id },
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await this.itemRepo.update(
          { id: item.id },
          { status: 'mint_failed', errorMessage: msg },
        );
      }
    }

    const toMint = reserved.filter((r) => r.item.tokenUri && r.item.vaultRef);
    if (!toMint.length) return;

    let tokenIds: number[];
    let txHash: string;
    try {
      ({ tokenIds, txHash } = await this.chainWriter.mintBatchTo(
        toMint.map((r) => ({
          to: mintTo,
          tokenURI: r.item.tokenUri!,
          vaultRef: r.item.vaultRef!,
        })),
        job.chainId as SupportedChainId,
      ));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      for (const r of toMint) {
        await this.vault.cancelCycle(r.cycleId, `bulk mintBatch failed: ${msg}`);
        await this.itemRepo.update(
          { id: r.item.id },
          {
            status: 'ready',
            vaultCycleId: null,
            errorMessage: `mintBatch failed (retryable): ${msg}`,
          },
        );
      }
      throw e;
    }

    for (let i = 0; i < toMint.length; i++) {
      const r = toMint[i]!;
      const tokenId = tokenIds[i]!;
      try {
        await this.vault.recordMintResult({
          cycleId: r.cycleId,
          tokenContract,
          tokenId: String(tokenId),
          tokenURI: r.item.tokenUri!,
          txHash,
          certNumber: r.item.certNumber,
        });
        await this.itemRepo.update(
          { id: r.item.id },
          {
            status: 'minted',
            tokenId: String(tokenId),
            txHash,
            errorMessage: null,
          },
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        this.logger.error(
          `recordMintResult failed cert=${r.item.certNumber} tokenId=${tokenId}: ${msg}`,
        );
        await this.itemRepo.update(
          { id: r.item.id },
          {
            status: 'minted',
            tokenId: String(tokenId),
            txHash,
            errorMessage: `On-chain ok; DB record failed: ${msg}`,
          },
        );
      }
    }
  }

  private async refreshJobCounters(jobId: string): Promise<void> {
    const items = await this.itemRepo.find({ where: { jobId } });
    const preparedCount = items.filter((i) =>
      ['ready', 'minting', 'minted', 'listed', 'list_failed'].includes(i.status),
    ).length;
    const mintedCount = items.filter((i) =>
      ['minted', 'listed', 'list_failed'].includes(i.status),
    ).length;
    const listedCount = items.filter((i) => i.status === 'listed').length;
    const failedCount = items.filter((i) =>
      ['prepare_failed', 'mint_failed', 'list_failed', 'skipped'].includes(
        i.status,
      ),
    ).length;
    await this.jobRepo.update(
      { id: jobId },
      {
        preparedCount,
        mintedCount,
        listedCount,
        failedCount,
        itemCount: items.length,
      },
    );
  }
}
