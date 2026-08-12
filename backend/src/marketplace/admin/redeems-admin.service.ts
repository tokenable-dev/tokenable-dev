import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  ChainConfigService,
  SUPPORTED_CHAIN_IDS,
  type SupportedChainId,
} from '../../blockchain/chain-config.service';
import { PlatformFeeWalletService } from '../../blockchain/platform-fee-wallet.service';
import { RwaChainWriterService } from '../../blockchain/rwa-chain-writer.service';
import { User } from '../../user/entities/user.entity';
import { VaultAsset } from '../../vault/entities/vault-asset.entity';
import { VaultCycle } from '../../vault/entities/vault-cycle.entity';
import { VaultRedeemPaymentClaim } from '../../vault/entities/vault-redeem-payment-claim.entity';
import {
  VaultRedemption,
  type VaultRedemptionRefundStatus,
  type VaultRedemptionStatus,
} from '../../vault/entities/vault-redemption.entity';
import { VaultService } from '../../vault/vault.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RwaToken } from '../entities/rwa-token.entity';
import { MarketplacePartner } from '../entities/marketplace-partner.entity';
import { formatPartnerVaultLabel } from '../partners/partner-vault-label.util';
import {
  isActiveRedeemShipmentStatus,
  redeemShipmentKey,
  redeemShipToFingerprint,
  redeemTrackingGroupKey,
} from '../../rwa/redeem-shipment-key.util';

const BLOCKED_REFUND_STATUSES: ReadonlySet<VaultRedemptionStatus> = new Set([
  'burned',
  'vault_release_pending',
  'completed',
]);

export type AdminRedeemPaymentStatus = 'unpaid' | 'paid' | 'refunded';
export type AdminRedeemCustodyStatus =
  | 'pending'
  | 'in_custody'
  | 'returned'
  | 'n/a';
export type AdminRedeemShippingStatus = 'pending' | 'tracked' | 'released';

export type AdminRedeemRow = {
  id: string;
  status: VaultRedemptionStatus;
  refundStatus: VaultRedemptionRefundStatus;
  paymentStatus: AdminRedeemPaymentStatus;
  custodyStatus: AdminRedeemCustodyStatus;
  shippingStatus: AdminRedeemShippingStatus;
  paymentBatchId: string | null;
  paymentTxHash: string | null;
  paidAt: string | null;
  paymentReceivedUsdcMicros: string | null;
  refundTxHash: string | null;
  refundedUsdcMicros: string | null;
  refundedAt: string | null;
  chainId: number | null;
  ownerWalletAddress: string;
  custodyTxHash: string | null;
  custodyAt: string | null;
  custodyReturnTxHash: string | null;
  custodyReturnedAt: string | null;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  trackingSetAt: string | null;
  adminMemo: string | null;
  shipTo: {
    name: string | null;
    line1: string | null;
    line2: string | null;
    city: string | null;
    region: string | null;
    postal: string | null;
    country: string | null;
    phone: string | null;
  };
  fees: {
    retrievalUsd: string | null;
    earlyWithdrawalUsd: string | null;
    shippingUsd: string | null;
    totalUsd: string | null;
  };
  tokenId: string | null;
  tokenContract: string | null;
  certNumber: string | null;
  displayName: string | null;
  imageUrl: string | null;
  vaultCycleId: string;
  vaultCycleStatus: string | null;
  requestedByUserId: string | null;
  userEmail: string | null;
  requestedAt: string;
  ownershipVerifiedAt: string | null;
  burnedAt: string | null;
  burnTxHash: string | null;
  vaultReleasedAt: string | null;
  vaultedAt: string | null;
  earlyWithdrawal: boolean | null;
  settlementPolicy: 'standard' | 'self_vault_hold' | null;
  vaultPartnerId: string | null;
  /** psa_vault | partner:<id> — groups cards for per-vault tracking. */
  shipmentKey: string;
  /** batch + shipmentKey + ship-to — partner portal tracking scope. */
  trackingGroupKey: string;
  vaultLabel: string;
  updatedAt: string;
};

export type AdminRedeemPurgeResult = {
  deletedRedemptions: number;
  deletedPaymentClaims: number;
  resetVaultCycles: number;
  clearedTokenBurns: number;
};

type RedeemRawJoin = {
  redemption: VaultRedemption;
  tokenId: string | null;
  tokenContract: string | null;
  certNumber: string | null;
  displayName: string | null;
  imageUrl: string | null;
  vaultCycleStatus: string | null;
  userEmail: string | null;
  settlementPolicy: 'standard' | 'self_vault_hold' | null;
  vaultPartnerId: string | null;
  vaultLabel: string;
};

function assertRefundable(rows: VaultRedemption[]): void {
  if (rows.length === 0) {
    throw new BadRequestException('No redemption rows to refund');
  }
  if (rows.some((r) => Boolean(r.trackingNumber?.trim()))) {
    throw new BadRequestException(
      'Refunds are not allowed after a tracking number has been entered',
    );
  }
  const blocked = rows.find((r) => BLOCKED_REFUND_STATUSES.has(r.status));
  if (blocked) {
    throw new BadRequestException(
      `Refunds are not allowed after status=${blocked.status}`,
    );
  }
}

function iso(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d instanceof Date ? d.toISOString() : String(d);
}

function computePaymentStatus(r: VaultRedemption): AdminRedeemPaymentStatus {
  if (
    r.refundStatus === 'usdc_refunded' ||
    r.refundStatus === 'fully_refunded'
  ) {
    return 'refunded';
  }
  if (r.paymentTxHash || r.paidAt) return 'paid';
  return 'unpaid';
}

function computeCustodyStatus(r: VaultRedemption): AdminRedeemCustodyStatus {
  if (r.custodyReturnedAt || r.custodyReturnTxHash) return 'returned';
  if (r.custodyAt || r.custodyTxHash || r.status === 'in_custody') {
    return 'in_custody';
  }
  if (r.status === 'burned' || r.status === 'completed') return 'n/a';
  return 'pending';
}

function computeShippingStatus(r: VaultRedemption): AdminRedeemShippingStatus {
  if (r.vaultReleasedAt) return 'released';
  if (r.trackingNumber?.trim()) return 'tracked';
  return 'pending';
}

function wasEverInCustody(r: VaultRedemption): boolean {
  return Boolean(r.custodyAt || r.custodyTxHash || r.status === 'in_custody');
}

function nftReturned(r: VaultRedemption): boolean {
  return Boolean(
    r.custodyReturnedAt ||
      r.custodyReturnTxHash ||
      r.refundStatus === 'nft_returned' ||
      r.refundStatus === 'fully_refunded',
  );
}

@Injectable()
export class RedeemsAdminService {
  private readonly logger = new Logger(RedeemsAdminService.name);
  private readonly batchLocks = new Map<string, Promise<unknown>>();

  constructor(
    @InjectRepository(VaultRedemption)
    private readonly redemptions: Repository<VaultRedemption>,
    @InjectRepository(VaultCycle)
    private readonly cycles: Repository<VaultCycle>,
    @InjectRepository(RwaToken)
    private readonly rwaTokens: Repository<RwaToken>,
    private readonly platformFee: PlatformFeeWalletService,
    private readonly chainWriter: RwaChainWriterService,
    private readonly chainConfig: ChainConfigService,
    private readonly vault: VaultService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Dev/staging only — wipe redeem ledger rows and undo local vault/token redeem flags.
   * Does not touch on-chain burns or USDC payments.
   */
  async purgeAllDevData(): Promise<AdminRedeemPurgeResult> {
    const isProduction =
      this.config.get<boolean>('app.isProduction') ??
      this.config.get<string>('NODE_ENV') === 'production';
    if (isProduction) {
      throw new ForbiddenException('Redeem purge is disabled in production');
    }

    return this.redemptions.manager.transaction(async (em) => {
      const deletedRedemptions = await em.count(VaultRedemption);
      const deletedPaymentClaims = await em.count(VaultRedeemPaymentClaim);

      await em.createQueryBuilder().delete().from(VaultRedemption).execute();
      await em
        .createQueryBuilder()
        .delete()
        .from(VaultRedeemPaymentClaim)
        .execute();

      const cycleResult = await em
        .createQueryBuilder()
        .update(VaultCycle)
        .set({ status: 'minted', redeemedAt: null })
        .where('status IN (:...statuses)', {
          statuses: ['redemption_requested', 'redeemed'],
        })
        .execute();

      const tokenResult = await em
        .createQueryBuilder()
        .update(RwaToken)
        .set({ burnedAt: null, burnTxHash: null })
        .where('burned_at IS NOT NULL OR burn_tx_hash IS NOT NULL')
        .execute();

      const result: AdminRedeemPurgeResult = {
        deletedRedemptions,
        deletedPaymentClaims,
        resetVaultCycles: cycleResult.affected ?? 0,
        clearedTokenBurns: tokenResult.affected ?? 0,
      };

      this.logger.warn(JSON.stringify({ msg: 'admin_redeem_purge_all', ...result }));

      return result;
    });
  }

  private withBatchLock<T>(batchId: string, fn: () => Promise<T>): Promise<T> {
    const prev = this.batchLocks.get(batchId) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    this.batchLocks.set(
      batchId,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }

  private resolveChainId(row: VaultRedemption): SupportedChainId {
    const n = Number(row.chainId ?? this.chainConfig.getDefaultChainId());
    if (SUPPORTED_CHAIN_IDS.includes(n as SupportedChainId)) {
      return n as SupportedChainId;
    }
    return this.chainConfig.getDefaultChainId();
  }

  private serialize(raw: RedeemRawJoin): AdminRedeemRow {
    const r = raw.redemption;
    return {
      id: r.id,
      status: r.status,
      refundStatus: r.refundStatus,
      paymentStatus: computePaymentStatus(r),
      custodyStatus: computeCustodyStatus(r),
      shippingStatus: computeShippingStatus(r),
      paymentBatchId: r.paymentBatchId,
      paymentTxHash: r.paymentTxHash,
      paidAt: iso(r.paidAt),
      paymentReceivedUsdcMicros: r.paymentReceivedUsdcMicros,
      refundTxHash: r.refundTxHash,
      refundedUsdcMicros: r.refundedUsdcMicros,
      refundedAt: iso(r.refundedAt),
      chainId: r.chainId,
      ownerWalletAddress: r.ownerWalletAddress,
      custodyTxHash: r.custodyTxHash,
      custodyAt: iso(r.custodyAt),
      custodyReturnTxHash: r.custodyReturnTxHash,
      custodyReturnedAt: iso(r.custodyReturnedAt),
      trackingNumber: r.trackingNumber,
      trackingCarrier: r.trackingCarrier,
      trackingSetAt: iso(r.trackingSetAt),
      adminMemo: r.adminMemo,
      shipTo: {
        name: r.shipToName,
        line1: r.shipToLine1,
        line2: r.shipToLine2,
        city: r.shipToCity,
        region: r.shipToRegion,
        postal: r.shipToPostal,
        country: r.shipToCountry,
        phone: r.shipToPhone,
      },
      fees: {
        retrievalUsd: r.feeRetrievalUsd,
        earlyWithdrawalUsd: r.feeEarlyWithdrawalUsd,
        shippingUsd: r.feeShippingUsd,
        totalUsd: r.feeTotalUsd,
      },
      tokenId: raw.tokenId,
      tokenContract: raw.tokenContract,
      certNumber: raw.certNumber,
      displayName: raw.displayName,
      imageUrl: raw.imageUrl,
      vaultCycleId: r.vaultCycleId,
      vaultCycleStatus: raw.vaultCycleStatus,
      requestedByUserId: r.requestedByUserId,
      userEmail: raw.userEmail,
      requestedAt: iso(r.requestedAt) ?? new Date(0).toISOString(),
      ownershipVerifiedAt: iso(r.ownershipVerifiedAt),
      burnedAt: iso(r.burnedAt),
      burnTxHash: r.burnTxHash,
      vaultReleasedAt: iso(r.vaultReleasedAt),
      vaultedAt: iso(r.vaultedAt),
      earlyWithdrawal: r.earlyWithdrawal,
      settlementPolicy: raw.settlementPolicy,
      vaultPartnerId: raw.vaultPartnerId,
      shipmentKey: redeemShipmentKey({
        settlementPolicy: raw.settlementPolicy,
        vaultPartnerId: raw.vaultPartnerId,
      }),
      trackingGroupKey: redeemTrackingGroupKey({
        paymentBatchId: r.paymentBatchId,
        shipmentKey: redeemShipmentKey({
          settlementPolicy: raw.settlementPolicy,
          vaultPartnerId: raw.vaultPartnerId,
        }),
        shipTo: {
          name: r.shipToName,
          line1: r.shipToLine1,
          line2: r.shipToLine2,
          city: r.shipToCity,
          region: r.shipToRegion,
          postal: r.shipToPostal,
          country: r.shipToCountry,
        },
      }),
      vaultLabel: raw.vaultLabel,
      updatedAt: iso(r.updatedAt) ?? new Date(0).toISOString(),
    };
  }

  private async enrich(rows: VaultRedemption[]): Promise<RedeemRawJoin[]> {
    if (rows.length === 0) return [];
    const cycleIds = [...new Set(rows.map((r) => r.vaultCycleId))];
    const userIds = [
      ...new Set(
        rows
          .map((r) => r.requestedByUserId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [cycles, tokens, users] = await Promise.all([
      this.cycles.find({ where: { id: In(cycleIds) } }),
      this.rwaTokens.find({ where: { vaultCycleId: In(cycleIds) } }),
      userIds.length
        ? this.redemptions.manager.getRepository(User).find({
            where: { id: In(userIds) },
            select: ['id', 'email'],
          })
        : Promise.resolve([] as User[]),
    ]);

    const assetIds = [
      ...new Set(cycles.map((c) => c.vaultAssetId).filter(Boolean)),
    ];
    const assets = assetIds.length
      ? await this.redemptions.manager.getRepository(VaultAsset).find({
          where: { id: In(assetIds) },
        })
      : [];

    const cycleById = new Map(cycles.map((c) => [c.id, c]));
    const tokenByCycle = new Map(tokens.map((t) => [t.vaultCycleId!, t]));
    const assetById = new Map(assets.map((a) => [a.id, a]));
    const emailByUser = new Map(users.map((u) => [u.id, u.email]));

    const partnerIds = [
      ...new Set(
        tokens
          .filter((t) => t.settlementPolicy === 'self_vault_hold' && t.vaultPartnerId)
          .map((t) => t.vaultPartnerId!)
          .filter(Boolean),
      ),
    ];
    const partners = partnerIds.length
      ? await this.redemptions.manager.getRepository(MarketplacePartner).find({
          where: { id: In(partnerIds) },
          select: ['id', 'displayName'],
        })
      : [];
    const partnerNameById = new Map(
      partners.map((p) => [p.id, p.displayName]),
    );

    return rows.map((redemption) => {
      const cycle = cycleById.get(redemption.vaultCycleId);
      const token = tokenByCycle.get(redemption.vaultCycleId);
      const asset = cycle ? assetById.get(cycle.vaultAssetId) : undefined;
      const settlementPolicy = token?.settlementPolicy ?? null;
      const vaultPartnerId = token?.vaultPartnerId ?? null;
      const vaultLabel =
        settlementPolicy === 'self_vault_hold'
          ? formatPartnerVaultLabel(
              vaultPartnerId
                ? partnerNameById.get(vaultPartnerId) ?? null
                : null,
            )
          : 'PSA Vault';
      return {
        redemption,
        tokenId: token?.tokenId ?? null,
        tokenContract: token?.tokenContract?.toLowerCase() ?? null,
        certNumber: token?.certNumber ?? asset?.externalCertNumber ?? null,
        displayName: token?.displayName ?? asset?.displayName ?? null,
        imageUrl: token?.displayImageUrl?.trim() || null,
        vaultCycleStatus: cycle?.status ?? null,
        userEmail: redemption.requestedByUserId
          ? emailByUser.get(redemption.requestedByUserId) ?? null
          : null,
        settlementPolicy,
        vaultPartnerId,
        vaultLabel,
      };
    });
  }

  private async serializeRows(
    rows: VaultRedemption[],
  ): Promise<AdminRedeemRow[]> {
    return (await this.enrich(rows)).map((j) => this.serialize(j));
  }

  private async serializeOne(row: VaultRedemption): Promise<AdminRedeemRow> {
    const [joined] = await this.enrich([row]);
    return this.serialize(
      joined ?? {
        redemption: row,
        tokenId: null,
        tokenContract: null,
        certNumber: null,
        displayName: null,
        imageUrl: null,
        vaultCycleStatus: null,
        userEmail: null,
        settlementPolicy: null,
        vaultPartnerId: null,
        vaultLabel: 'PSA Vault',
      },
    );
  }

  async list(params: {
    status?: string;
    paymentBatchId?: string;
    limit?: number;
  }): Promise<{ items: AdminRedeemRow[] }> {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const qb = this.redemptions
      .createQueryBuilder('r')
      .orderBy('r.requested_at', 'DESC')
      .addOrderBy('r.id', 'ASC')
      .take(limit);

    if (params.paymentBatchId) {
      qb.andWhere('r.payment_batch_id = :batchId', {
        batchId: params.paymentBatchId,
      });
    }
    if (params.status?.trim()) {
      qb.andWhere('r.status = :status', { status: params.status.trim() });
    }

    const rows = await qb.getMany();
    return { items: await this.serializeRows(rows) };
  }

  /**
   * Partner-scoped list — only self-vault redemptions for this partner's cards.
   * Same row shape as admin so the partner UI can reuse serializers / grouping.
   */
  async listForPartner(
    partnerId: string,
    params?: { limit?: number },
  ): Promise<{ items: AdminRedeemRow[] }> {
    const id = partnerId.trim();
    if (!id) throw new BadRequestException('partnerId is required');
    const limit = Math.min(Math.max(params?.limit ?? 100, 1), 200);
    const rows = await this.redemptions
      .createQueryBuilder('r')
      .where(
        `EXISTS (
          SELECT 1 FROM rwa_tokens t
          WHERE t.vault_cycle_id = r.vault_cycle_id
            AND t.vault_partner_id = :partnerId
            AND t.settlement_policy = :policy
        )`,
        { partnerId: id, policy: 'self_vault_hold' },
      )
      .orderBy('r.requestedAt', 'DESC')
      .addOrderBy('r.id', 'ASC')
      .take(limit)
      .getMany();
    return { items: await this.serializeRows(rows) };
  }

  /**
   * Partner may only write tracking for their own `partner:<id>` shipment key.
   */
  async updateTrackingBatchForPartner(
    partnerId: string,
    batchId: string,
    params: {
      shipmentKey: string;
      trackingNumber: string;
      trackingCarrier?: string;
      redemptionIds: string[];
    },
  ): Promise<{ paymentBatchId: string; shipmentKey: string; items: AdminRedeemRow[] }> {
    const expected = `partner:${partnerId.trim()}`;
    const key = params.shipmentKey.trim();
    if (key !== expected) {
      throw new ForbiddenException(
        `Partners may only update tracking for ${expected}`,
      );
    }
    return this.updateTrackingBatch(batchId, {
      ...params,
      partnerOnly: true,
    });
  }

  async getBatch(batchId: string): Promise<{
    paymentBatchId: string;
    items: AdminRedeemRow[];
  }> {
    const rows = await this.redemptions.find({
      where: { paymentBatchId: batchId },
      order: { requestedAt: 'ASC' },
    });
    if (rows.length === 0) {
      throw new NotFoundException(`No redemptions for batch ${batchId}`);
    }
    return {
      paymentBatchId: batchId,
      items: await this.serializeRows(rows),
    };
  }

  async updateMemo(id: string, memo: string): Promise<AdminRedeemRow> {
    const row = await this.redemptions.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Redemption not found');
    row.adminMemo = memo.trim() || null;
    await this.redemptions.save(row);
    return this.serializeOne(row);
  }

  async updateMemoBatch(
    batchId: string,
    memo: string,
  ): Promise<{ paymentBatchId: string; items: AdminRedeemRow[] }> {
    const rows = await this.redemptions.find({
      where: { paymentBatchId: batchId },
      order: { requestedAt: 'ASC' },
    });
    if (rows.length === 0) {
      throw new NotFoundException(`No redemptions for batch ${batchId}`);
    }
    const next = memo.trim() || null;
    for (const row of rows) {
      row.adminMemo = next;
    }
    await this.redemptions.save(rows);
    return {
      paymentBatchId: batchId,
      items: await Promise.all(rows.map((r) => this.serializeOne(r))),
    };
  }

  async updateTracking(
    id: string,
    params: { trackingNumber: string; trackingCarrier?: string },
  ): Promise<AdminRedeemRow> {
    const row = await this.redemptions.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Redemption not found');
    const trackingNumber = params.trackingNumber.trim();
    if (!trackingNumber) {
      throw new BadRequestException('trackingNumber is required');
    }
    const existing = row.trackingNumber?.trim();
    const isNewTracking = !existing;
    if (existing && existing !== trackingNumber) {
      throw new BadRequestException(
        `Redemption already has a different tracking number`,
      );
    }
    if (!existing) {
      row.trackingNumber = trackingNumber;
      row.trackingSetAt = new Date();
    }
    const carrier = params.trackingCarrier?.trim() || null;
    if (carrier) {
      row.trackingCarrier = carrier;
    } else if (!existing) {
      row.trackingCarrier = null;
    }
    await this.redemptions.save(row);
    if (isNewTracking && row.paymentBatchId) {
      const [joined] = await this.enrich([row]);
      const chainId = this.resolveChainId(row);
      void this.notifications
        .notifyRedeemShipped({
          ownerWallet: row.ownerWalletAddress,
          paymentBatchId: row.paymentBatchId,
          shipmentKey: redeemShipmentKey({
            settlementPolicy: joined?.settlementPolicy ?? null,
            vaultPartnerId: joined?.vaultPartnerId ?? null,
          }),
          trackingNumber: row.trackingNumber,
          chainId,
        })
        .catch((e) => {
          this.logger.warn(
            `notifyRedeemShipped failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        });
    }
    return this.serializeOne(row);
  }

  /** One vault shipment within a payment batch — apply tracking to those rows only. */
  async updateTrackingBatch(
    batchId: string,
    params: {
      shipmentKey: string;
      trackingNumber: string;
      trackingCarrier?: string;
      redemptionIds?: string[];
      /** When true, require redemptionIds and reject terminal rows. */
      partnerOnly?: boolean;
    },
  ): Promise<{ paymentBatchId: string; shipmentKey: string; items: AdminRedeemRow[] }> {
    const shipmentKey = params.shipmentKey.trim();
    if (!shipmentKey) {
      throw new BadRequestException('shipmentKey is required');
    }
    if (params.partnerOnly && (!params.redemptionIds || params.redemptionIds.length === 0)) {
      throw new BadRequestException('redemptionIds is required for partner tracking');
    }
    const rows = await this.redemptions.find({
      where: { paymentBatchId: batchId },
      order: { requestedAt: 'ASC' },
    });
    if (rows.length === 0) {
      throw new NotFoundException(`No redemptions for batch ${batchId}`);
    }
    const trackingNumber = params.trackingNumber.trim();
    if (!trackingNumber) {
      throw new BadRequestException('trackingNumber is required');
    }
    const carrier = params.trackingCarrier?.trim() || null;
    const at = new Date();
    const joined = await this.enrich(rows);
    const redemptionIdSet = params.redemptionIds?.length
      ? new Set(params.redemptionIds)
      : null;
    let targets = joined.filter((j) => {
      const key = redeemShipmentKey({
        settlementPolicy: j.settlementPolicy,
        vaultPartnerId: j.vaultPartnerId,
      });
      if (key !== shipmentKey) return false;
      if (redemptionIdSet && !redemptionIdSet.has(j.redemption.id)) {
        return false;
      }
      if (!isActiveRedeemShipmentStatus(j.redemption.status)) {
        return false;
      }
      return true;
    });
    if (targets.length === 0) {
      throw new NotFoundException(
        `No active cards in batch ${batchId} for shipment ${shipmentKey}`,
      );
    }
    if (params.partnerOnly) {
      const expectedFp = redeemShipToFingerprint({
        name: targets[0]!.redemption.shipToName,
        line1: targets[0]!.redemption.shipToLine1,
        line2: targets[0]!.redemption.shipToLine2,
        city: targets[0]!.redemption.shipToCity,
        region: targets[0]!.redemption.shipToRegion,
        postal: targets[0]!.redemption.shipToPostal,
        country: targets[0]!.redemption.shipToCountry,
      });
      const mixedShipTo = targets.some(
        (t) =>
          redeemShipToFingerprint({
            name: t.redemption.shipToName,
            line1: t.redemption.shipToLine1,
            line2: t.redemption.shipToLine2,
            city: t.redemption.shipToCity,
            region: t.redemption.shipToRegion,
            postal: t.redemption.shipToPostal,
            country: t.redemption.shipToCountry,
          }) !== expectedFp,
      );
      if (mixedShipTo) {
        throw new BadRequestException(
          'Partner tracking updates must target one ship-to destination per request',
        );
      }
    }
    let appliedNewTracking = false;
    for (const { redemption: row } of targets) {
      if (row.trackingNumber?.trim()) {
        if (row.trackingNumber.trim() !== trackingNumber) {
          throw new BadRequestException(
            `Shipment ${shipmentKey} already has a different tracking number on ${row.id}`,
          );
        }
        /* Same tracking — allow carrier fill-in / update (PSA + Partner vaults). */
        if (carrier) {
          row.trackingCarrier = carrier;
        }
        continue;
      }
      appliedNewTracking = true;
      row.trackingNumber = trackingNumber;
      row.trackingCarrier = carrier;
      row.trackingSetAt = at;
    }
    await this.redemptions.save(targets.map((t) => t.redemption));
    if (appliedNewTracking) {
      const ownerWallet = rows[0].ownerWalletAddress;
      const chainId = this.resolveChainId(rows[0]);
      void this.notifications
        .notifyRedeemShipped({
          ownerWallet,
          paymentBatchId: batchId,
          shipmentKey,
          trackingNumber,
          chainId,
        })
        .catch((e) => {
          this.logger.warn(
            `notifyRedeemShipped failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        });
    }
    return {
      paymentBatchId: batchId,
      shipmentKey,
      items: await Promise.all(
        targets.map((t) => this.serializeOne(t.redemption)),
      ),
    };
  }

  private applyUsdcRefundFields(
    row: VaultRedemption,
    params: {
      txHash: string;
      amountMicros: string;
      at: Date;
    },
  ): void {
    row.refundTxHash = params.txHash;
    row.refundedUsdcMicros = params.amountMicros;
    row.refundedAt = params.at;

    const nftBack = nftReturned(row);
    const neverCustody = !wasEverInCustody(row);

    if (nftBack || neverCustody) {
      row.refundStatus = 'fully_refunded';
      row.status = 'refunded';
    } else {
      row.refundStatus = 'usdc_refunded';
    }
  }

  private async resetCyclesIfRefunded(
    rows: VaultRedemption[],
  ): Promise<void> {
    const cycleIds = [
      ...new Set(
        rows.filter((r) => r.status === 'refunded').map((r) => r.vaultCycleId),
      ),
    ];
    if (cycleIds.length === 0) return;
    const cycles = await this.cycles.find({ where: { id: In(cycleIds) } });
    for (const cycle of cycles) {
      if (cycle.status === 'redemption_requested') {
        cycle.status = 'minted';
        await this.cycles.save(cycle);
      }
    }
  }

  async refundUsdcBatch(batchId: string): Promise<{
    paymentBatchId: string;
    txHash: string | null;
    alreadyRefunded: boolean;
    items: AdminRedeemRow[];
  }> {
    return this.withBatchLock(batchId, async () => {
      const rows = await this.redemptions.find({
        where: { paymentBatchId: batchId },
        order: { requestedAt: 'ASC' },
      });
      if (rows.length === 0) {
        throw new NotFoundException(`No redemptions for batch ${batchId}`);
      }

      assertRefundable(rows);

      const already = rows.every(
        (r) =>
          r.refundStatus === 'usdc_refunded' ||
          r.refundStatus === 'fully_refunded',
      );
      if (already) {
        return {
          paymentBatchId: batchId,
          txHash: rows[0]?.refundTxHash ?? null,
          alreadyRefunded: true,
          items: await this.serializeRows(rows),
        };
      }

      const amountMicros =
        (await this.vault.getPaymentReceivedMicrosForBatch(batchId))?.trim() ??
        '';
      if (!/^\d+$/.test(amountMicros) || BigInt(amountMicros) <= BigInt(0)) {
        throw new BadRequestException(
          'payment_received_usdc_micros missing — cannot refund without recorded payment amount',
        );
      }
      // Prefer claims ledger; warn if denormalized sibling rows disagree.
      for (const r of rows) {
        if (
          r.paymentReceivedUsdcMicros &&
          r.paymentReceivedUsdcMicros !== amountMicros
        ) {
          this.logger.warn(
            `Batch ${batchId} has mismatched payment_received_usdc_micros (${r.paymentReceivedUsdcMicros} vs ${amountMicros})`,
          );
        }
      }

      const to = rows[0].ownerWalletAddress;
      if (!this.platformFee.isConfigured()) {
        throw new BadRequestException(
          'PLATFORM_FEE_PRIVATE_KEY is not configured',
        );
      }

      const chainId = this.resolveChainId(rows[0]);
      const { txHash } = await this.platformFee.transferUsdc({
        to,
        amountMicros,
        chainId,
      });

      const at = new Date();
      for (const row of rows) {
        this.applyUsdcRefundFields(row, { txHash, amountMicros, at });
      }
      await this.redemptions.save(rows);
      await this.resetCyclesIfRefunded(rows);

      this.logger.log(
        `Redeem batch ${batchId} USDC refund ${amountMicros} → ${to} tx=${txHash}`,
      );

      void this.notifications
        .notifyRedeemRefunded({
          ownerWallet: to,
          paymentBatchId: batchId,
          chainId,
        })
        .catch((e) => {
          this.logger.warn(
            `notifyRedeemRefunded failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        });

      return {
        paymentBatchId: batchId,
        txHash,
        alreadyRefunded: false,
        items: await this.serializeRows(rows),
      };
    });
  }

  async returnNft(id: string): Promise<{
    alreadyReturned: boolean;
    txHash: string | null;
    item: AdminRedeemRow;
  }> {
    const row = await this.redemptions.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Redemption not found');

    assertRefundable([row]);

    if (row.custodyReturnedAt && row.custodyReturnTxHash) {
      return {
        alreadyReturned: true,
        txHash: row.custodyReturnTxHash,
        item: await this.serializeOne(row),
      };
    }

    const inCustody =
      row.status === 'in_custody' || Boolean(row.custodyAt || row.custodyTxHash);
    if (!inCustody) {
      throw new BadRequestException(
        'NFT return requires status=in_custody or custody_at set',
      );
    }

    const token = await this.rwaTokens.findOne({
      where: { vaultCycleId: row.vaultCycleId },
    });
    if (!token?.tokenId) {
      throw new BadRequestException(
        `No rwa_tokens row linked to vault cycle ${row.vaultCycleId}`,
      );
    }
    const tokenId = Number(token.tokenId);
    if (!Number.isFinite(tokenId) || tokenId < 0) {
      throw new BadRequestException(`Invalid tokenId ${token.tokenId}`);
    }

    const chainId = this.resolveChainId(row);
    const { txHash } = await this.chainWriter.safeTransferFromCustody(
      tokenId,
      row.ownerWalletAddress,
      chainId,
    );

    row.custodyReturnTxHash = txHash;
    row.custodyReturnedAt = new Date();

    if (
      row.refundStatus === 'usdc_refunded' ||
      row.refundStatus === 'fully_refunded'
    ) {
      row.refundStatus = 'fully_refunded';
      row.status = 'refunded';
    } else {
      row.refundStatus = 'nft_returned';
    }

    await this.redemptions.save(row);
    await this.resetCyclesIfRefunded([row]);

    this.logger.log(
      `Redeem ${id} NFT #${tokenId} returned → ${row.ownerWalletAddress} tx=${txHash}`,
    );

    return {
      alreadyReturned: false,
      txHash,
      item: await this.serializeOne(row),
    };
  }

  async refundFullBatch(batchId: string): Promise<{
    paymentBatchId: string;
    usdc: {
      txHash: string | null;
      alreadyRefunded: boolean;
    };
    nftReturns: Array<{
      redemptionId: string;
      txHash: string | null;
      alreadyReturned: boolean;
      skipped?: string;
    }>;
    items: AdminRedeemRow[];
  }> {
    const usdc = await this.refundUsdcBatch(batchId);
    const rows = await this.redemptions.find({
      where: { paymentBatchId: batchId },
      order: { requestedAt: 'ASC' },
    });

    const nftReturns: Array<{
      redemptionId: string;
      txHash: string | null;
      alreadyReturned: boolean;
      skipped?: string;
    }> = [];

    for (const row of rows) {
      const stillInCustody =
        !row.custodyReturnedAt &&
        (row.status === 'in_custody' ||
          Boolean(row.custodyAt || row.custodyTxHash));
      if (!stillInCustody) {
        nftReturns.push({
          redemptionId: row.id,
          txHash: row.custodyReturnTxHash,
          alreadyReturned: Boolean(row.custodyReturnedAt),
          skipped: wasEverInCustody(row)
            ? undefined
            : 'never_in_custody',
        });
        continue;
      }
      try {
        const result = await this.returnNft(row.id);
        nftReturns.push({
          redemptionId: row.id,
          txHash: result.txHash,
          alreadyReturned: result.alreadyReturned,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `refund-full NFT return failed for ${row.id}: ${msg}`,
        );
        nftReturns.push({
          redemptionId: row.id,
          txHash: null,
          alreadyReturned: false,
          skipped: msg,
        });
      }
    }

    const items = await this.serializeRows(
      await this.redemptions.find({
        where: { paymentBatchId: batchId },
        order: { requestedAt: 'ASC' },
      }),
    );

    return {
      paymentBatchId: batchId,
      usdc: {
        txHash: usdc.txHash,
        alreadyRefunded: usdc.alreadyRefunded,
      },
      nftReturns,
      items,
    };
  }
}
