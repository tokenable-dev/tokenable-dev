import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { SupportedChainId } from '../../blockchain/chain-config.service';
import { MarketplacePartnersService } from '../../marketplace/partners/marketplace-partners.service';
import { PsaService } from '../../psa/psa.service';
import { User } from '../../user/entities/user.entity';
import { UserService } from '../../user/user.service';
import { buildVaultAdminMintUploadFromAnalyze } from '../admin/vault-admin-mint-metadata.util';
import {
  PARTNER_VAULT_MINT_MAX_ITEMS,
  CreatePartnerVaultMintJobDto,
} from '../dto/create-partner-vault-mint-job.dto';
import {
  PartnerVaultMintJob,
  type PartnerVaultMintJobStatus,
} from '../entities/partner-vault-mint-job.entity';
import { PartnerVaultMintJobItem } from '../entities/partner-vault-mint-job-item.entity';
import type { UploadRwaResult } from '../interfaces/rwa-metadata.interface';
import { NotificationsService } from '../../marketplace/notifications/notifications.service';
import { RwaMintService } from '../rwa-mint.service';
import { RwaService } from '../rwa.service';

export type PartnerVaultMintJobView = {
  id: string;
  status: PartnerVaultMintJobStatus;
  chainId: number;
  itemCount: number;
  processedCount: number;
  succeededCount: number;
  failedCount: number;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    certNumber: string;
    status: string;
    displayName: string | null;
    tokenId: string | null;
    errorMessage: string | null;
  }>;
};

type PreparedPartnerMint = {
  displayName: string;
  upload: UploadRwaResult;
};

const DEFAULT_PREP_CONCURRENCY = 4;
const MAX_PREP_CONCURRENCY = 8;

@Injectable()
export class PartnerVaultMintJobService {
  private readonly logger = new Logger(PartnerVaultMintJobService.name);
  private readonly inflight = new Set<string>();

  constructor(
    @InjectRepository(PartnerVaultMintJob)
    private readonly jobRepo: Repository<PartnerVaultMintJob>,
    @InjectRepository(PartnerVaultMintJobItem)
    private readonly itemRepo: Repository<PartnerVaultMintJobItem>,
    private readonly partners: MarketplacePartnersService,
    private readonly users: UserService,
    private readonly psa: PsaService,
    private readonly rwa: RwaService,
    private readonly rwaMint: RwaMintService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async createJob(
    user: User,
    chainId: SupportedChainId,
    dto: CreatePartnerVaultMintJobDto,
  ): Promise<PartnerVaultMintJobView> {
    const partner = await this.partners.assertSelfVaultEligibleForUser(user.id);

    const certs = this.normalizeCerts(dto.certNumbers);
    if (certs.length === 0) {
      throw new BadRequestException('At least one valid cert number is required');
    }
    if (certs.length > PARTNER_VAULT_MINT_MAX_ITEMS) {
      throw new BadRequestException(
        `Max ${PARTNER_VAULT_MINT_MAX_ITEMS} certs per job`,
      );
    }

    const recipient = await this.resolveRecipientAsync(
      user.id,
      dto.recipientAddress,
    );

    const job = await this.jobRepo.save(
      this.jobRepo.create({
        userId: user.id,
        chainId,
        recipientAddress: recipient,
        partnerId: partner.partnerId,
        status: 'pending',
        itemCount: certs.length,
        processedCount: 0,
        succeededCount: 0,
        failedCount: 0,
        errorMessage: null,
      }),
    );

    await this.itemRepo.save(
      certs.map((cert, i) =>
        this.itemRepo.create({
          jobId: job.id,
          sortIndex: i,
          certNumber: cert,
          status: 'pending',
        }),
      ),
    );

    void this.runJob(job.id);

    return this.getJobForUser(user.id, job.id);
  }

  async getJobForUser(
    userId: string,
    jobId: string,
  ): Promise<PartnerVaultMintJobView> {
    const job = await this.jobRepo.findOne({
      where: { id: jobId },
      relations: { items: true },
    });
    if (!job || job.userId !== userId) {
      throw new NotFoundException('Mint job not found');
    }
    return this.toView(job);
  }

  private normalizeCerts(raw: string[]): string[] {
    const out: string[] = [];
    const seen = new Set<string>();
    for (const r of raw) {
      const digits = String(r ?? '').replace(/\D/g, '').trim();
      if (digits.length < 7 || digits.length > 10) continue;
      if (seen.has(digits)) continue;
      seen.add(digits);
      out.push(digits);
    }
    return out;
  }

  private async resolveRecipientAsync(
    userId: string,
    explicit?: string,
  ): Promise<string> {
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

  private prepConcurrency(itemCount: number): number {
    const raw = this.config.get<string>('PARTNER_VAULT_MINT_PREP_CONCURRENCY');
    const n = Number(raw ?? DEFAULT_PREP_CONCURRENCY);
    const configured = Number.isFinite(n)
      ? Math.floor(n)
      : DEFAULT_PREP_CONCURRENCY;
    return Math.max(
      1,
      Math.min(MAX_PREP_CONCURRENCY, configured, itemCount),
    );
  }

  private async runJob(jobId: string): Promise<void> {
    if (this.inflight.has(jobId)) return;
    this.inflight.add(jobId);
    let mintedTokenIds: number[] = [];
    let portfolioRecipient: string | null = null;
    let portfolioChainId: SupportedChainId | null = null;

    try {
      await this.jobRepo.update(
        { id: jobId },
        { status: 'processing', errorMessage: null },
      );
      const job = await this.jobRepo.findOne({ where: { id: jobId } });
      if (!job) return;

      const user = await this.users.findByIdOrFail(job.userId);
      const chainId = job.chainId as SupportedChainId;
      portfolioRecipient = job.recipientAddress;
      portfolioChainId = chainId;

      await this.rwaMint.assertPartnerVaultMintJobPreflight(
        user,
        job.recipientAddress,
        chainId,
      );

      const items = await this.itemRepo.find({
        where: { jobId, status: 'pending' },
        order: { sortIndex: 'ASC' },
      });

      const prepared = new Map<string, PreparedPartnerMint>();
      const prepConcurrency = this.prepConcurrency(items.length);

      await mapPool(items, prepConcurrency, async (item) => {
        await this.itemRepo.update(
          { id: item.id },
          { status: 'minting', errorMessage: null },
        );
        try {
          const row = await this.prepareMintItem(item.certNumber, chainId);
          prepared.set(item.id, row);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          this.logger.warn(
            `partner vault mint prepare cert=${item.certNumber}: ${msg}`,
          );
          await this.itemRepo.update(
            { id: item.id },
            { status: 'failed', errorMessage: msg.slice(0, 2000) },
          );
        }
      });

      let processedCount = job.processedCount;
      let succeededCount = job.succeededCount;
      let failedCount = job.failedCount;

      for (const item of items) {
        const row = prepared.get(item.id);
        if (!row) {
          failedCount += 1;
          processedCount += 1;
          await this.patchJobCounters(jobId, {
            processedCount,
            succeededCount,
            failedCount,
          });
          continue;
        }

        try {
          const mint = await this.rwaMint.mintForUser(
            user,
            {
              recipientAddress: job.recipientAddress,
              tokenURI: row.upload.tokenURI,
              certNumber: item.certNumber,
              deliveryMode: 'direct',
              displayName: row.displayName,
              displayImageUrl: row.upload.displayImageUrl ?? undefined,
              displayImageBackUrl: row.upload.displayImageBackUrl ?? undefined,
              collectionKey: row.upload.collectionKey ?? undefined,
            },
            chainId,
            {
              jobPreflightDone: true,
              vaultPartnerId: job.partnerId,
              deferPostMintPortfolioWork: true,
            },
          );
          await this.itemRepo.update(
            { id: item.id },
            {
              status: 'succeeded',
              displayName: row.displayName,
              tokenId: String(mint.tokenId),
              txHash: mint.txHash,
              errorMessage: null,
            },
          );
          succeededCount += 1;
          mintedTokenIds.push(mint.tokenId);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          this.logger.warn(
            `partner vault mint cert=${item.certNumber}: ${msg}`,
          );
          await this.itemRepo.update(
            { id: item.id },
            { status: 'failed', errorMessage: msg.slice(0, 2000) },
          );
          failedCount += 1;
        }
        processedCount += 1;
        await this.patchJobCounters(jobId, {
          processedCount,
          succeededCount,
          failedCount,
        });
      }

      await this.jobRepo.update(
        { id: jobId },
        {
          status: succeededCount > 0 || failedCount > 0 ? 'completed' : 'failed',
          errorMessage:
            succeededCount === 0 && failedCount > 0 ? 'All items failed' : null,
          processedCount,
          succeededCount,
          failedCount,
        },
      );
      await this.notifyJobFinished(jobId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.error(`partner vault mint job failed id=${jobId}: ${msg}`);
      await this.jobRepo.update(
        { id: jobId },
        { status: 'failed', errorMessage: msg },
      );
      await this.notifyJobFinished(jobId);
    } finally {
      if (
        mintedTokenIds.length > 0 &&
        portfolioRecipient &&
        portfolioChainId != null
      ) {
        this.rwaMint.flushPostMintPortfolioWork(
          portfolioRecipient,
          mintedTokenIds,
          portfolioChainId,
        );
      }
      this.inflight.delete(jobId);
    }
  }

  private async prepareMintItem(
    cert: string,
    chainId: SupportedChainId,
  ): Promise<PreparedPartnerMint> {
    const analyze = await this.psa.analyzeByCertNumber(cert);
    const displayName = analyze.psa.cardNameHint?.trim() || `PSA #${cert}`;
    const { dto } = buildVaultAdminMintUploadFromAnalyze({
      certNumber: cert,
      analyze,
    });
    const upload = await this.rwa.uploadToIpfs(dto, chainId, undefined, {
      skipVaultPreflight: true,
    });
    return { displayName, upload };
  }

  private async patchJobCounters(
    jobId: string,
    counts: {
      processedCount: number;
      succeededCount: number;
      failedCount: number;
    },
  ): Promise<void> {
    await this.jobRepo.update({ id: jobId }, counts);
  }

  private async notifyJobFinished(jobId: string): Promise<void> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) return;
    void this.notifications
      .notifyPartnerVaultMintJobComplete({
        userId: job.userId,
        jobId: job.id,
        chainId: job.chainId,
        succeededCount: job.succeededCount,
        failedCount: job.failedCount,
      })
      .catch((e) => {
        this.logger.warn(
          `partner vault mint notify failed job=${jobId}: ${
            e instanceof Error ? e.message : String(e)
          }`,
        );
      });
  }

  private toView(job: PartnerVaultMintJob): PartnerVaultMintJobView {
    const items = (job.items ?? []).sort((a, b) => a.sortIndex - b.sortIndex);
    return {
      id: job.id,
      status: job.status,
      chainId: job.chainId,
      itemCount: job.itemCount,
      processedCount: job.processedCount,
      succeededCount: job.succeededCount,
      failedCount: job.failedCount,
      errorMessage: job.errorMessage,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      items: items.map((i) => ({
        certNumber: i.certNumber,
        status: i.status,
        displayName: i.displayName,
        tokenId: i.tokenId,
        errorMessage: i.errorMessage,
      })),
    };
  }
}

async function mapPool<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let idx = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (idx < items.length) {
        const i = idx++;
        await fn(items[i]);
      }
    },
  );
  await Promise.all(workers);
}
