import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { keccak256, toUtf8Bytes } from 'ethers';
import { EntityManager, In, QueryFailedError, Repository, SelectQueryBuilder } from 'typeorm';
import { RwaToken } from '../marketplace/entities/rwa-token.entity';
import { MarketplacePartner } from '../marketplace/entities/marketplace-partner.entity';
import { NotificationsService } from '../marketplace/notifications/notifications.service';
import {
  vaultLabelForCustody,
} from '../marketplace/partners/partner-vault-label.util';
import {
  ChainConfigService,
  type SupportedChainId,
} from '../blockchain/chain-config.service';
import { VaultAsset, VaultAssetType } from './entities/vault-asset.entity';
import { VaultCycle } from './entities/vault-cycle.entity';
import { VaultRedeemPaymentClaim } from './entities/vault-redeem-payment-claim.entity';
import {
  VaultRedemption,
  type VaultRedemptionStatus,
} from './entities/vault-redemption.entity';

export type VaultAssetHistoryEntry = {
  cycleId: string;
  cycleNumber: number;
  chainId: number;
  status: VaultCycle['status'];
  depositedAt: Date | null;
  redeemedAt: Date | null;
  tokenId: string | null;
  tokenContract: string | null;
  burnedAt: Date | null;
};

/** Strip leading zeros on decimal token ids (`040` → `40`). */
export function normalizeDecimalTokenId(raw: string): string {
  const s = String(raw ?? '').trim();
  if (!/^\d+$/.test(s)) return s;
  let i = 0;
  while (i < s.length - 1 && s[i] === '0') i++;
  return s.slice(i);
}

function decimalTokenIdLookupKeys(raw: string): string[] {
  const trimmed = String(raw ?? '').trim();
  if (!trimmed) return [];
  return [...new Set([trimmed, normalizeDecimalTokenId(trimmed)])];
}

/**
 * Operational source of truth for the Tokenable asset lifecycle:
 *
 *   VaultAsset (physical card, permanent)
 *     -> VaultCycle (one deposit..redeem window)
 *         -> RwaToken (the NFT minted for that cycle)
 *
 * A physical card can have many cycles over its lifetime, but at most one
 * *open* (non-terminal) cycle at a time — mirroring the on-chain
 * `activeTokenIdByVaultRef` invariant enforced by TokenableRWA.sol.
 */
@Injectable()
export class VaultService {
  private readonly logger = new Logger(VaultService.name);

  constructor(
    @InjectRepository(VaultAsset)
    private readonly assets: Repository<VaultAsset>,
    @InjectRepository(VaultCycle)
    private readonly cycles: Repository<VaultCycle>,
    @InjectRepository(VaultRedemption)
    private readonly redemptions: Repository<VaultRedemption>,
    @InjectRepository(VaultRedeemPaymentClaim)
    private readonly paymentClaims: Repository<VaultRedeemPaymentClaim>,
    @InjectRepository(RwaToken)
    private readonly rwaTokens: Repository<RwaToken>,
    @InjectRepository(MarketplacePartner)
    private readonly marketplacePartners: Repository<MarketplacePartner>,
    private readonly notifications: NotificationsService,
    private readonly chainConfig: ChainConfigService,
  ) {}

  private static normalizeCert(certNumber: string): string {
    return certNumber.trim().toUpperCase();
  }

  /**
   * The single source of truth for deriving the on-chain vaultRef anchor.
   * MUST be derived from the physical asset's permanent identity (PSA cert
   * number) — never from mint-cycle-specific data like tokenURI — otherwise
   * the contract's anti-double-claim check across vault cycles is defeated.
   */
  static computeVaultRef(certNumber: string): string {
    const normalized = VaultService.normalizeCert(certNumber);
    if (!normalized) {
      throw new BadRequestException('certNumber is required to compute vaultRef');
    }
    return keccak256(toUtf8Bytes(normalized));
  }

  /**
   * Match `rwa_tokens.token_id` whether the API sent `40` and the row is `040`
   * (or the reverse). Wallet/NFT clients and mint inserts do not always use
   * the same zero-padding.
   */
  private applyDecimalTokenIdMatch(
    qb: SelectQueryBuilder<RwaToken>,
    tokenContract: string,
    tokenIds: string[],
  ): SelectQueryBuilder<RwaToken> {
    const ids = [...new Set(tokenIds.flatMap(decimalTokenIdLookupKeys))];
    const norms = [...new Set(tokenIds.map((id) => normalizeDecimalTokenId(id)))];
    return qb
      .where('LOWER(t.token_contract) = :rwaContract', {
        rwaContract: tokenContract.toLowerCase(),
      })
      .andWhere(
        `(t.token_id IN (:...rwaTokenIds) OR (t.token_id ~ :rwaNumRe AND COALESCE(NULLIF(LTRIM(t.token_id, :rwaZero), :rwaEmpty), :rwaZeroToken) IN (:...rwaNorms)))`,
        {
          rwaTokenIds: ids,
          rwaNumRe: '^[0-9]+$',
          rwaZero: '0',
          rwaEmpty: '',
          rwaZeroToken: '0',
          rwaNorms: norms,
        },
      );
  }

  private async findRwaTokensByDecimalIds(
    tokenContract: string,
    tokenIds: string[],
  ): Promise<RwaToken[]> {
    const ids = [
      ...new Set(tokenIds.map((t) => String(t).trim()).filter((t) => /^\d+$/.test(t))),
    ];
    if (ids.length === 0) return [];
    if (typeof this.rwaTokens.createQueryBuilder !== 'function') {
      const lookupKeys = [...new Set(ids.flatMap(decimalTokenIdLookupKeys))];
      const rows = await this.rwaTokens.find({
        where: {
          tokenContract: tokenContract.toLowerCase(),
          tokenId: In(lookupKeys),
        },
      });
      const wanted = new Set(ids.map((id) => normalizeDecimalTokenId(id)));
      return rows.filter((r) => wanted.has(normalizeDecimalTokenId(r.tokenId)));
    }
    return this.applyDecimalTokenIdMatch(
      this.rwaTokens.createQueryBuilder('t'),
      tokenContract,
      ids,
    ).getMany();
  }

  /**
   * Pre-flight check usable before doing expensive work (e.g. IPFS upload):
   * throws if this physical asset already has an open (non-terminal) cycle
   * on the given chain. Cycles are chain-scoped — the on-chain
   * `activeTokenIdByVaultRef` invariant is per contract, so a live Sepolia
   * NFT must not block a Polygon mint.
   */
  async findOpenCycleForCert(
    certNumber: string,
    chainId: number,
    assetType: VaultAssetType = 'psa_graded',
  ): Promise<{
    certNumber: string;
    cycleNumber: number;
    status: string;
  } | null> {
    const normalized = VaultService.normalizeCert(certNumber);
    if (!normalized) return null;
    const asset = await this.assets.findOne({
      where: { assetType, externalCertNumber: normalized },
    });
    if (!asset) return null;

    const openCycle = await this.cycles
      .createQueryBuilder('c')
      .where('c.vault_asset_id = :assetId', { assetId: asset.id })
      .andWhere('c.chain_id = :chainId', { chainId })
      .andWhere("c.status NOT IN ('redeemed', 'cancelled')")
      .getOne();
    if (!openCycle) return null;
    return {
      certNumber: normalized,
      cycleNumber: openCycle.cycleNumber,
      status: openCycle.status,
    };
  }

  /** Non-throwing pre-flight for UI mint gates. */
  async checkAvailableForNewCycle(
    certNumber: string,
    chainId: number,
    assetType: VaultAssetType = 'psa_graded',
  ): Promise<{
    available: boolean;
    certNumber: string;
    message: string | null;
  }> {
    const normalized = VaultService.normalizeCert(certNumber);
    const open = await this.findOpenCycleForCert(
      certNumber,
      chainId,
      assetType,
    );
    if (!open) {
      return { available: true, certNumber: normalized, message: null };
    }
    return {
      available: false,
      certNumber: open.certNumber,
      message: `PSA cert #${open.certNumber} is already minted on this network (cycle #${open.cycleNumber}, ${open.status}). Redeem it before minting again.`,
    };
  }

  async assertAvailableForNewCycle(
    certNumber: string,
    chainId: number,
    assetType: VaultAssetType = 'psa_graded',
  ): Promise<void> {
    const check = await this.checkAvailableForNewCycle(
      certNumber,
      chainId,
      assetType,
    );
    if (!check.available) {
      throw new ConflictException(
        check.message ??
          `PSA cert #${check.certNumber} already has an active vault cycle on chain ${chainId}. Redeem it before re-vaulting.`,
      );
    }
  }

  /**
   * Open minted cycle + registry token for a cert on a chain, if any.
   * Used by admin mint-queue to adopt an already-minted NFT instead of 409.
   */
  async findOpenMintedTokenForCert(
    certNumber: string,
    chainId: number,
    assetType: VaultAssetType = 'psa_graded',
  ): Promise<{
    cycle: VaultCycle;
    token: RwaToken;
    tokenId: number;
    vaultRef: string;
  } | null> {
    const normalized = VaultService.normalizeCert(certNumber);
    if (!normalized) return null;

    const asset = await this.assets.findOne({
      where: { assetType, externalCertNumber: normalized },
    });
    if (!asset) return null;

    const openCycle = await this.cycles
      .createQueryBuilder('c')
      .where('c.vault_asset_id = :assetId', { assetId: asset.id })
      .andWhere('c.chain_id = :chainId', { chainId })
      .andWhere("c.status NOT IN ('redeemed', 'cancelled')")
      .getOne();
    if (!openCycle || openCycle.status !== 'minted') return null;

    const token = await this.rwaTokens.findOne({
      where: { vaultCycleId: openCycle.id },
    });
    if (!token?.tokenId || token.burnedAt) return null;
    const tokenId = Number(token.tokenId);
    if (!Number.isFinite(tokenId) || tokenId < 0) return null;

    return {
      cycle: openCycle,
      token,
      tokenId,
      vaultRef: asset.vaultRef,
    };
  }

  /**
   * Step 1 of "Vault Deposit": find-or-create the permanent VaultAsset record
   * for this physical card, then open a brand-new VaultCycle for it. Fails
   * if a non-terminal cycle already exists (see assertAvailableForNewCycle).
   *
   * Deposit verification is currently automated (the existing PSA
   * cert-lookup + grade-policy check performed before this call IS the
   * verification gate) — depositVerifiedBy stays NULL. A manual admin
   * review step can be layered in later without a schema change by setting
   * status='pending_deposit' instead and adding an admin "verify" endpoint.
   */
  async reserveCycleForDeposit(params: {
    certNumber: string;
    chainId: number;
    assetType?: VaultAssetType;
    displayName?: string | null;
    depositedByUserId?: string | null;
  }): Promise<{ asset: VaultAsset; cycle: VaultCycle }> {
    const assetType = params.assetType ?? 'psa_graded';
    const normalized = VaultService.normalizeCert(params.certNumber);
    if (!normalized) {
      throw new BadRequestException('certNumber is required');
    }

    return this.assets.manager.transaction(async (em) => {
      let asset = await em.findOne(VaultAsset, {
        where: { assetType, externalCertNumber: normalized },
        lock: { mode: 'pessimistic_write' },
      });

      if (!asset) {
        asset = em.create(VaultAsset, {
          assetType,
          externalCertNumber: normalized,
          vaultRef: VaultService.computeVaultRef(normalized),
          displayName: params.displayName?.trim() || null,
        });
        asset = await em.save(asset);
      } else if (params.displayName?.trim() && !asset.displayName) {
        asset.displayName = params.displayName.trim();
        asset = await em.save(asset);
      }

      const openCycle = await em
        .createQueryBuilder(VaultCycle, 'c')
        .where('c.vault_asset_id = :assetId', { assetId: asset.id })
        .andWhere('c.chain_id = :chainId', { chainId: params.chainId })
        .andWhere("c.status NOT IN ('redeemed', 'cancelled')")
        .getOne();
      if (openCycle) {
        throw new ConflictException(
          `PSA cert #${normalized} already has an active vault cycle on chain ${params.chainId} (#${openCycle.cycleNumber}, status=${openCycle.status}).`,
        );
      }

      // cycle_number stays globally sequential per asset (across chains) —
      // unique (vault_asset_id, cycle_number) is unchanged.
      const priorCount = await em.count(VaultCycle, { where: { vaultAssetId: asset.id } });

      let cycle = em.create(VaultCycle, {
        vaultAssetId: asset.id,
        chainId: params.chainId,
        cycleNumber: priorCount + 1,
        status: 'deposit_verified',
        depositedAt: new Date(),
        depositVerifiedBy: null,
        depositedByUserId: params.depositedByUserId ?? null,
      });
      cycle = await em.save(cycle);

      return { asset, cycle };
    });
  }

  /**
   * Compensating action for a reserved cycle whose on-chain mint failed —
   * releases the "occupied" slot so the same physical asset can be retried
   * instead of being stuck open forever.
   */
  async cancelCycle(cycleId: string, reason: string): Promise<void> {
    const cycle = await this.cycles.findOne({ where: { id: cycleId } });
    if (!cycle || cycle.status !== 'deposit_verified') return;
    cycle.status = 'cancelled';
    await this.cycles.save(cycle);
    this.logger.warn(`Vault cycle ${cycleId} cancelled: ${reason}`);
  }

  /**
   * Step 2 of "Vault Deposit": record the successful on-chain mint against
   * the reserved cycle. Upserts the rwa_tokens read-model row with the
   * vault_cycle_id / vault_ref linkage.
   */
  async recordMintResult(params: {
    cycleId: string;
    tokenContract: string;
    tokenId: string;
    tokenURI: string;
    txHash: string;
    certNumber: string;
    displayName?: string | null;
    displayImageUrl?: string | null;
    displayImageBackUrl?: string | null;
    /** Persisted on `rwa_tokens`; defaults to `standard`. */
    settlementPolicy?: 'standard' | 'self_vault_hold';
    /** Self-vault partner id — set when settlementPolicy is self_vault_hold. */
    vaultPartnerId?: string | null;
    /** On-chain mint recipient (indexed for portfolio owner lookup). */
    ownerWallet?: string | null;
  }): Promise<void> {
    const cycle = await this.cycles.findOne({ where: { id: params.cycleId } });
    if (!cycle) {
      throw new NotFoundException(`Vault cycle ${params.cycleId} not found`);
    }

    cycle.status = 'minted';
    await this.cycles.save(cycle);

    const vaultRef = VaultService.computeVaultRef(params.certNumber);
    const settlementPolicy =
      params.settlementPolicy === 'self_vault_hold'
        ? 'self_vault_hold'
        : 'standard';
    const vaultPartnerId =
      settlementPolicy === 'self_vault_hold'
        ? params.vaultPartnerId?.trim() || null
        : null;
    await this.rwaTokens
      .createQueryBuilder()
      .insert()
      .into(RwaToken)
      .values({
        tokenContract: params.tokenContract,
        tokenId: params.tokenId,
        certNumber: VaultService.normalizeCert(params.certNumber),
        tokenUri: params.tokenURI,
        displayName: params.displayName?.trim() || null,
        displayImageUrl: params.displayImageUrl?.trim() || null,
        displayImageBackUrl: params.displayImageBackUrl?.trim() || null,
        vaultCycleId: cycle.id,
        vaultRef,
        settlementPolicy,
        vaultPartnerId,
        ownerWallet: params.ownerWallet?.trim().toLowerCase() || null,
        metadataSyncedAt: new Date(),
      })
      .orUpdate(
        [
          'cert_number',
          'token_uri',
          'display_name',
          'display_image_url',
          'display_image_back_url',
          'vault_cycle_id',
          'vault_ref',
          'settlement_policy',
          'vault_partner_id',
          'owner_wallet',
          'metadata_synced_at',
        ],
        ['token_contract', 'token_id'],
      )
      .execute();
  }

  /**
   * Step 1 of "Redeem Request": caller (RwaController) must already have
   * verified that `ownerWalletAddress` currently owns the token on-chain and
   * is linked to `requestingUserId`. This records the request and moves the
   * cycle into redemption_requested so ops can see it's in flight (and, per
   * the architecture review, so the marketplace layer can block new listings
   * for this token while a redemption is pending).
   */
  async requestRedemption(params: {
    tokenContract: string;
    tokenId: string;
    requestingUserId: string | null;
    ownerWalletAddress: string;
    shipTo?: {
      name: string;
      line1: string;
      line2?: string;
      city: string;
      region?: string;
      postal: string;
      country: string;
      phone: string;
    } | null;
    fees?: {
      feeRetrievalUsd: number;
      feeEarlyWithdrawalUsd: number;
      feeShippingUsd: number;
      feeTotalUsd: number;
      paymentTxHash: string;
      paymentBatchId: string;
      paidAt: Date;
      vaultedAt: Date | null;
      earlyWithdrawal: boolean;
      chainId: number;
      /** Exact micros that arrived — canonical batch refund amount. */
      paymentReceivedUsdcMicros: string;
    } | null;
  }): Promise<VaultRedemption> {
    if (params.fees?.paymentTxHash) {
      throw new BadRequestException(
        'Paid redemptions must use createPaidRedemptionBatch (payment claim + atomic multi-row create)',
      );
    }

    const token = await this.rwaTokens.findOne({
      where: { tokenContract: params.tokenContract, tokenId: params.tokenId },
    });
    if (!token?.vaultCycleId) {
      throw new NotFoundException(
        `No vault cycle linked to token #${params.tokenId} — cannot process redemption`,
      );
    }
    if (token.burnedAt) {
      throw new BadRequestException('Token has already been redeemed');
    }

    const cycle = await this.cycles.findOne({ where: { id: token.vaultCycleId } });
    if (!cycle || cycle.status !== 'minted') {
      throw new ConflictException(
        `Vault cycle is not in a redeemable state (status=${cycle?.status ?? 'unknown'})`,
      );
    }

    const existingOpen = await this.redemptions
      .createQueryBuilder('r')
      .where('r.vault_cycle_id = :cycleId', { cycleId: cycle.id })
      .andWhere(
        "r.status NOT IN ('completed', 'failed', 'cancelled', 'refunded')",
      )
      .getOne();
    if (existingOpen) {
      return existingOpen;
    }

    const ship = params.shipTo;
    const fees = params.fees;
    const redemption = this.redemptions.create({
      vaultCycleId: cycle.id,
      requestedByUserId: params.requestingUserId,
      ownerWalletAddress: params.ownerWalletAddress.toLowerCase(),
      status: 'ownership_verified',
      ownershipVerifiedAt: new Date(),
      shipToName: ship?.name?.trim() || null,
      shipToLine1: ship?.line1?.trim() || null,
      shipToLine2: ship?.line2?.trim() || null,
      shipToCity: ship?.city?.trim() || null,
      shipToRegion: ship?.region?.trim() || null,
      shipToPostal: ship?.postal?.trim() || null,
      shipToCountry: ship?.country?.trim() || null,
      shipToPhone: ship?.phone?.trim() || null,
      feeRetrievalUsd:
        fees != null ? fees.feeRetrievalUsd.toFixed(2) : null,
      feeEarlyWithdrawalUsd:
        fees != null ? fees.feeEarlyWithdrawalUsd.toFixed(2) : null,
      feeShippingUsd: fees != null ? fees.feeShippingUsd.toFixed(2) : null,
      feeTotalUsd: fees != null ? fees.feeTotalUsd.toFixed(2) : null,
      paymentTxHash: fees?.paymentTxHash?.toLowerCase() ?? null,
      paymentBatchId: fees?.paymentBatchId ?? null,
      paidAt: fees?.paidAt ?? null,
      chainId: fees?.chainId ?? null,
      paymentReceivedUsdcMicros: fees?.paymentReceivedUsdcMicros ?? null,
      refundStatus: 'none',
      vaultedAt: fees?.vaultedAt ?? cycle.depositedAt ?? null,
      earlyWithdrawal: fees?.earlyWithdrawal ?? null,
    });
    const saved = await this.redemptions.save(redemption);

    cycle.status = 'redemption_requested';
    await this.cycles.save(cycle);

    void this.notifications
      .notifyWithdrawalRequested({
        ownerWallet: params.ownerWalletAddress,
        tokenId: params.tokenId,
        redemptionId: saved.id,
      })
      .catch((e) => {
        this.logger.warn(
          `notifyWithdrawalRequested failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      });

    return saved;
  }

  /**
   * Atomically claim a USDC payment_tx_hash and create every redemption row
   * for a multi-card batch. Any failure rolls back the claim + all rows.
   */
  async createPaidRedemptionBatch(params: {
    paymentTxHash: string;
    paymentBatchId: string;
    paymentReceivedUsdcMicros: string;
    paidAt: Date;
    chainId: number;
    items: Array<{
      tokenContract: string;
      tokenId: string;
      requestingUserId: string | null;
      ownerWalletAddress: string;
      shipTo: {
        name: string;
        line1: string;
        line2?: string;
        city: string;
        region?: string;
        postal: string;
        country: string;
        phone: string;
      };
      feeRetrievalUsd: number;
      feeEarlyWithdrawalUsd: number;
      feeShippingUsd: number;
      feeTotalUsd: number;
      vaultedAt: Date | null;
      earlyWithdrawal: boolean;
    }>;
  }): Promise<Array<{ redemption: VaultRedemption; tokenId: string }>> {
    const paymentTxHash = params.paymentTxHash.trim().toLowerCase();
    const paymentBatchId = params.paymentBatchId.trim();
    if (!paymentTxHash || !paymentBatchId) {
      throw new BadRequestException('paymentTxHash and paymentBatchId required');
    }
    if (params.items.length === 0) {
      throw new BadRequestException('items required');
    }

    const created = await this.redemptions.manager.transaction(async (em) => {
      await this.insertPaymentClaimOrConflict(em, {
        paymentTxHash,
        paymentBatchId,
        paymentReceivedUsdcMicros: params.paymentReceivedUsdcMicros,
        chainId: params.chainId,
      });

      const out: Array<{ redemption: VaultRedemption; tokenId: string }> = [];
      for (const item of params.items) {
        const redemption = await this.insertPaidRedemptionRow(em, {
          ...item,
          paymentTxHash,
          paymentBatchId,
          paidAt: params.paidAt,
          chainId: params.chainId,
          paymentReceivedUsdcMicros: params.paymentReceivedUsdcMicros,
        });
        out.push({ redemption, tokenId: item.tokenId });
      }
      return out;
    });

    const ownerWallet = created[0]?.redemption.ownerWalletAddress;
    if (ownerWallet) {
      void this.notifications
        .notifyRedeemPaymentReceived({
          ownerWallet,
          paymentBatchId,
          cardCount: created.length,
          chainId: params.chainId as SupportedChainId,
        })
        .catch((e) => {
          this.logger.warn(
            `notifyRedeemPaymentReceived failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        });
    }

    return created;
  }

  private async insertPaymentClaimOrConflict(
    em: EntityManager,
    params: {
      paymentTxHash: string;
      paymentBatchId: string;
      paymentReceivedUsdcMicros: string;
      chainId: number;
    },
  ): Promise<void> {
    const claim = em.create(VaultRedeemPaymentClaim, {
      paymentTxHash: params.paymentTxHash,
      paymentBatchId: params.paymentBatchId,
      paymentReceivedUsdcMicros: params.paymentReceivedUsdcMicros,
      chainId: params.chainId,
    });
    try {
      await em.save(claim);
    } catch (e: unknown) {
      if (e instanceof QueryFailedError) {
        const pgCode = (
          e as QueryFailedError & { driverError?: { code?: string } }
        ).driverError?.code;
        if (pgCode === '23505') {
          throw new ConflictException(
            'This payment transaction was already used for a redeem batch',
          );
        }
      }
      throw e;
    }
  }

  /**
   * Repair path for tokens minted on-chain whose DB row lost (or never had)
   * a vault cycle — e.g. rows created by the chain registry sync after a DB
   * reset. Creates/links the VaultAsset + a `minted` cycle from the token's
   * cert number so a paid redeem is never stranded after USDC moved.
   */
  private async backfillCycleForToken(
    em: EntityManager,
    token: RwaToken,
    chainId: number,
  ): Promise<string> {
    const cert = token.certNumber?.trim();
    if (!cert) {
      throw new NotFoundException(
        `Token #${token.tokenId} has no vault record and no PSA cert number — cannot process redemption. Contact support.`,
      );
    }
    const normalized = VaultService.normalizeCert(cert);

    let asset = await em.findOne(VaultAsset, {
      where: { assetType: 'psa_graded', externalCertNumber: normalized },
      lock: { mode: 'pessimistic_write' },
    });
    if (!asset) {
      asset = await em.save(
        em.create(VaultAsset, {
          assetType: 'psa_graded',
          externalCertNumber: normalized,
          vaultRef: VaultService.computeVaultRef(normalized),
          displayName: token.displayName?.trim() || null,
        }),
      );
    }

    const openCycle = await em
      .createQueryBuilder(VaultCycle, 'c')
      .setLock('pessimistic_write')
      .where('c.vault_asset_id = :assetId', { assetId: asset.id })
      .andWhere('c.chain_id = :chainId', { chainId })
      .andWhere("c.status NOT IN ('redeemed', 'cancelled')")
      .getOne();

    let cycle: VaultCycle;
    if (openCycle) {
      if (openCycle.status !== 'minted') {
        throw new ConflictException(
          `Vault cycle is not in a redeemable state (status=${openCycle.status})`,
        );
      }
      cycle = openCycle;
    } else {
      const priorCount = await em.count(VaultCycle, {
        where: { vaultAssetId: asset.id },
      });
      cycle = await em.save(
        em.create(VaultCycle, {
          vaultAssetId: asset.id,
          chainId,
          cycleNumber: priorCount + 1,
          status: 'minted',
          /* Unknown vault age — fee estimate already treated it as early. */
          depositedAt: null,
          depositVerifiedBy: null,
          depositedByUserId: null,
        }),
      );
    }

    token.vaultCycleId = cycle.id;
    if (!token.vaultRef) {
      token.vaultRef = VaultService.computeVaultRef(normalized);
    }
    await em.save(token);
    this.logger.warn(
      `Backfilled vault cycle ${cycle.id} for token #${token.tokenId} (cert ${normalized}) during paid redeem`,
    );
    return cycle.id;
  }

  private async insertPaidRedemptionRow(
    em: EntityManager,
    params: {
      tokenContract: string;
      tokenId: string;
      requestingUserId: string | null;
      ownerWalletAddress: string;
      shipTo: {
        name: string;
        line1: string;
        line2?: string;
        city: string;
        region?: string;
        postal: string;
        country: string;
        phone: string;
      };
      feeRetrievalUsd: number;
      feeEarlyWithdrawalUsd: number;
      feeShippingUsd: number;
      feeTotalUsd: number;
      vaultedAt: Date | null;
      earlyWithdrawal: boolean;
      paymentTxHash: string;
      paymentBatchId: string;
      paidAt: Date;
      chainId: number;
      paymentReceivedUsdcMicros: string;
    },
  ): Promise<VaultRedemption> {
    const token = await em
      .createQueryBuilder(RwaToken, 't')
      .setLock('pessimistic_write')
      .where('LOWER(t.token_contract) = :rwaContract', {
        rwaContract: params.tokenContract.toLowerCase(),
      })
      .andWhere(
        `(t.token_id IN (:...rwaTokenIds) OR (t.token_id ~ :rwaNumRe AND COALESCE(NULLIF(LTRIM(t.token_id, :rwaZero), :rwaEmpty), :rwaZeroToken) IN (:...rwaNorms)))`,
        {
          rwaTokenIds: decimalTokenIdLookupKeys(params.tokenId),
          rwaNumRe: '^[0-9]+$',
          rwaZero: '0',
          rwaEmpty: '',
          rwaZeroToken: '0',
          rwaNorms: [normalizeDecimalTokenId(params.tokenId)],
        },
      )
      .getOne();
    if (!token) {
      throw new NotFoundException(
        `Token #${params.tokenId} is not registered on Tokenable — cannot process redemption. Contact support.`,
      );
    }
    if (token.burnedAt) {
      throw new BadRequestException('Token has already been redeemed');
    }

    const cycleId =
      token.vaultCycleId ??
      (await this.backfillCycleForToken(em, token, params.chainId));

    const cycle = await em.findOne(VaultCycle, {
      where: { id: cycleId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!cycle || cycle.status !== 'minted') {
      throw new ConflictException(
        `Vault cycle is not in a redeemable state (status=${cycle?.status ?? 'unknown'})`,
      );
    }

    const existingOpen = await em
      .createQueryBuilder(VaultRedemption, 'r')
      .setLock('pessimistic_write')
      .where('r.vault_cycle_id = :cycleId', { cycleId: cycle.id })
      .andWhere(
        "r.status NOT IN ('completed', 'failed', 'cancelled', 'refunded')",
      )
      .getOne();
    if (existingOpen) {
      // Paid batch must not silently attach to another open redeem — rollback all.
      throw new ConflictException(
        `Token #${params.tokenId} already has an open redemption (${existingOpen.id})`,
      );
    }

    const ship = params.shipTo;
    const redemption = em.create(VaultRedemption, {
      vaultCycleId: cycle.id,
      requestedByUserId: params.requestingUserId,
      ownerWalletAddress: params.ownerWalletAddress.toLowerCase(),
      status: 'ownership_verified',
      ownershipVerifiedAt: new Date(),
      shipToName: ship.name?.trim() || null,
      shipToLine1: ship.line1?.trim() || null,
      shipToLine2: ship.line2?.trim() || null,
      shipToCity: ship.city?.trim() || null,
      shipToRegion: ship.region?.trim() || null,
      shipToPostal: ship.postal?.trim() || null,
      shipToCountry: ship.country?.trim() || null,
      shipToPhone: ship.phone?.trim() || null,
      feeRetrievalUsd: params.feeRetrievalUsd.toFixed(2),
      feeEarlyWithdrawalUsd: params.feeEarlyWithdrawalUsd.toFixed(2),
      feeShippingUsd: params.feeShippingUsd.toFixed(2),
      feeTotalUsd: params.feeTotalUsd.toFixed(2),
      paymentTxHash: params.paymentTxHash,
      paymentBatchId: params.paymentBatchId,
      paidAt: params.paidAt,
      chainId: params.chainId,
      paymentReceivedUsdcMicros: params.paymentReceivedUsdcMicros,
      refundStatus: 'none',
      trackingNumber: null,
      trackingCarrier: null,
      trackingSetAt: null,
      vaultedAt: params.vaultedAt ?? cycle.depositedAt ?? null,
      earlyWithdrawal: params.earlyWithdrawal,
    });
    const saved = await em.save(redemption);

    cycle.status = 'redemption_requested';
    await em.save(cycle);

    return saved;
  }

  /**
   * Step 2 of "Redeem Request": called after the on-chain adminBurn tx has
   * been confirmed. Handles BOTH entry points — a prior requestRedemption()
   * call, or a direct admin burn with no formal request on record (today's
   * admin "burn token" panel) — by creating the redemption row on the fly
   * in the latter case, so history stays consistent regardless of how the
   * burn was triggered.
   */
  async completeRedemptionBurn(params: {
    tokenContract: string;
    tokenId: string;
    burnTxHash: string;
    burnedByWalletAddress?: string | null;
  }): Promise<void> {
    const token = await this.rwaTokens.findOne({
      where: { tokenContract: params.tokenContract, tokenId: params.tokenId },
    });
    if (!token) {
      this.logger.warn(
        `completeRedemptionBurn: no rwa_tokens row for #${params.tokenId} — nothing to update`,
      );
      return;
    }

    const now = new Date();
    token.burnedAt = now;
    token.burnTxHash = params.burnTxHash;
    token.ownerWallet = null;
    await this.rwaTokens.save(token);

    if (!token.vaultCycleId) {
      this.logger.warn(
        `completeRedemptionBurn: token #${params.tokenId} has no vault_cycle_id — burn recorded on rwa_tokens only`,
      );
      return;
    }

    const cycle = await this.cycles.findOne({ where: { id: token.vaultCycleId } });
    if (!cycle) return;

    cycle.status = 'redeemed';
    cycle.redeemedAt = now;
    await this.cycles.save(cycle);

    let redemption = await this.redemptions
      .createQueryBuilder('r')
      .where('r.vault_cycle_id = :cycleId', { cycleId: cycle.id })
      .andWhere("r.status NOT IN ('completed', 'failed', 'cancelled')")
      .orderBy('r.requested_at', 'DESC')
      .getOne();

    if (!redemption) {
      redemption = this.redemptions.create({
        vaultCycleId: cycle.id,
        requestedByUserId: null,
        ownerWalletAddress: (params.burnedByWalletAddress ?? '').toLowerCase(),
        status: 'pending',
      });
    }

    redemption.status = 'burned';
    redemption.burnTxHash = params.burnTxHash;
    redemption.burnedAt = now;
    await this.redemptions.save(redemption);
  }

  /** Map vault_cycle_id → redemption id when status is `burned` (awaiting physical release). */
  async findPendingReleaseByCycleIds(
    cycleIds: string[],
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    if (cycleIds.length === 0) return out;
    const rows = await this.redemptions.find({
      where: { vaultCycleId: In(cycleIds), status: 'burned' },
    });
    for (const r of rows) out.set(r.vaultCycleId, r.id);
    return out;
  }

  /**
   * Block Seaport asks while a vault cycle is mid-redemption
   * (redemption_requested) or the NFT is already burned.
   */
  async assertTokenRedeemableForListing(
    tokenContract: string,
    tokenId: string,
  ): Promise<void> {
    const rows = await this.findRwaTokensByDecimalIds(
      tokenContract,
      [String(tokenId)],
    );
    const token = rows[0];
    if (!token) return;
    if (token.burnedAt) {
      throw new BadRequestException(
        `Token #${tokenId} has been redeemed and cannot be listed`,
      );
    }
    if (!token.vaultCycleId) return;
    const cycle = await this.cycles.findOne({ where: { id: token.vaultCycleId } });
    if (cycle?.status === 'redemption_requested' || cycle?.status === 'redeemed') {
      throw new BadRequestException(
        `Token #${tokenId} has a pending or completed redemption and cannot be listed`,
      );
    }
  }

  /**
   * Seaport settlement policy for a minted RWA.
   * Returns null when the token is not indexed on this chain — never assume PSA custody.
   */
  async getSettlementPolicy(
    tokenContract: string,
    tokenId: string,
  ): Promise<'standard' | 'self_vault_hold' | null> {
    const raw = String(tokenId ?? '').trim();
    const rows = await this.findRwaTokensByDecimalIds(tokenContract, [raw]);
    const token = rows[0];
    if (!token) return null;
    return token.settlementPolicy === 'self_vault_hold'
      ? 'self_vault_hold'
      : 'standard';
  }

  /** Batch load settlement + partner id for portfolio / listing vault chips. */
  /**
   * Fail-fast redeemability check for the estimate step — so users see the
   * real blocker BEFORE paying USDC (batch creation happens after payment).
   * Tokens with a missing cycle but a known cert pass (backfilled at pay).
   */
  async assertTokensRedeemable(
    tokenContract: string,
    tokenIds: string[],
  ): Promise<void> {
    const ids = [...new Set(tokenIds.map((t) => String(t).trim()))].filter(
      (t) => /^\d+$/.test(t),
    );
    if (ids.length === 0) return;

    const rows = await this.findRwaTokensByDecimalIds(tokenContract, ids);
    const byNorm = new Map(
      rows.map((r) => [normalizeDecimalTokenId(r.tokenId), r] as const),
    );

    const cycleIds = rows
      .map((r) => r.vaultCycleId)
      .filter((id): id is string => Boolean(id));
    const cycles =
      cycleIds.length > 0
        ? await this.cycles.find({ where: { id: In(cycleIds) } })
        : [];
    const cycleById = new Map(cycles.map((c) => [c.id, c]));

    for (const tokenId of ids) {
      const token = byNorm.get(normalizeDecimalTokenId(tokenId));
      if (!token) {
        throw new BadRequestException(
          `Token #${tokenId} is not registered on Tokenable yet — it cannot be redeemed. Contact support.`,
        );
      }
      if (token.burnedAt) {
        throw new BadRequestException(
          `Token #${tokenId} has already been redeemed`,
        );
      }
      if (!token.vaultCycleId) {
        if (!token.certNumber?.trim()) {
          throw new BadRequestException(
            `Token #${tokenId} is missing its vault record (no PSA cert on file) — contact support before redeeming.`,
          );
        }
        continue; // healable at pay time via backfillCycleForToken
      }
      const cycle = cycleById.get(token.vaultCycleId);
      if (cycle && cycle.status !== 'minted') {
        throw new ConflictException(
          `Token #${tokenId} is not redeemable right now (vault status: ${cycle.status})`,
        );
      }
    }
  }

  async getVaultCustodyRows(
    tokenContract: string,
    tokenIds: string[],
  ): Promise<
    Array<{
      tokenId: string;
      settlementPolicy: 'standard' | 'self_vault_hold' | null;
      vaultPartnerId: string | null;
      known: boolean;
    }>
  > {
    const ids = [
      ...new Set(
        tokenIds
          .map((t) => String(t ?? '').trim())
          .filter((t) => /^\d+$/.test(t)),
      ),
    ].slice(0, 200);
    if (!ids.length) return [];
    const rows = await this.findRwaTokensByDecimalIds(tokenContract, ids);
    const byNorm = new Map(
      rows.map((r) => [normalizeDecimalTokenId(r.tokenId), r] as const),
    );
    return ids.map((tokenId) => {
      const row = byNorm.get(normalizeDecimalTokenId(tokenId));
      if (!row) {
        return {
          tokenId,
          settlementPolicy: null,
          vaultPartnerId: null,
          known: false,
        };
      }
      const settlementPolicy =
        row.settlementPolicy === 'self_vault_hold'
          ? 'self_vault_hold'
          : 'standard';
      return {
        tokenId,
        settlementPolicy,
        vaultPartnerId:
          settlementPolicy === 'self_vault_hold'
            ? row.vaultPartnerId ?? null
            : null,
        known: true,
      };
    });
  }

  /** Portfolio / listing chips: keyed by requested tokenId string. */
  async getVaultDisplayByTokenIds(
    tokenContract: string,
    tokenIds: string[],
  ): Promise<
    Map<
      string,
      {
        settlementPolicy: 'standard' | 'self_vault_hold';
        vaultLabel: string;
      }
    >
  > {
    const rows = await this.getVaultCustodyRows(tokenContract, tokenIds);
    const partnerIds = rows
      .map((r) => r.vaultPartnerId)
      .filter((id): id is string => Boolean(id));
    const names = new Map<string, string>();
    if (partnerIds.length > 0) {
      const partners = await this.marketplacePartners.find({
        where: { id: In(partnerIds) },
        select: ['id', 'displayName'],
      });
      for (const p of partners) names.set(p.id, p.displayName);
    }
    const out = new Map<
      string,
      {
        settlementPolicy: 'standard' | 'self_vault_hold';
        vaultLabel: string;
      }
    >();
    for (const row of rows) {
      if (!row.known || row.settlementPolicy == null) continue;
      const vaultLabel = vaultLabelForCustody(
        row.settlementPolicy,
        row.vaultPartnerId ? names.get(row.vaultPartnerId) : null,
      );
      out.set(row.tokenId, {
        settlementPolicy: row.settlementPolicy,
        vaultLabel,
      });
    }
    return out;
  }

  async listOpenRedemptionsForUser(
    userId: string,
    chainId: number,
    tokenIds?: string[],
  ): Promise<
    Array<{
      redemptionId: string;
      tokenId: string;
      tokenContract: string;
      status: VaultRedemptionStatus;
      vaultCycleStatus: string | null;
      requestedAt: string;
      vaultReleasedAt: string | null;
      paymentBatchId: string | null;
      custodyTxHash: string | null;
      custodyAt: string | null;
      paymentTxHash: string | null;
      trackingNumber: string | null;
      trackingCarrier: string | null;
      /** FedEx Track Delivered stamp (null until carrier reports delivery). */
      carrierDeliveredAt: string | null;
      refundStatus: string;
      settlementPolicy: 'standard' | 'self_vault_hold' | null;
      vaultPartnerId: string | null;
      /** Per-card fee snapshot (sum within a batch for Paid UI). */
      feeRetrievalUsd: string | null;
      feeEarlyWithdrawalUsd: string | null;
      feeShippingUsd: string | null;
      feeTotalUsd: string | null;
      /** Batch-total grain — identical on sibling rows; do not SUM. */
      paymentReceivedUsdcMicros: string | null;
      earlyWithdrawal: boolean | null;
    }>
  > {
    const qb = this.redemptions
      .createQueryBuilder('r')
      .innerJoin(VaultCycle, 'c', 'c.id = r.vault_cycle_id')
      .innerJoin(RwaToken, 't', 't.vault_cycle_id = c.id')
      .where('r.requested_by_user_id = :userId', { userId })
      .andWhere("r.status NOT IN ('failed', 'cancelled')")
      .andWhere('COALESCE(r.chain_id, c.chain_id) = :chainId', { chainId })
      .orderBy('r.requested_at', 'DESC')
      .select([
        'r.id AS "redemptionId"',
        't.token_id AS "tokenId"',
        't.token_contract AS "tokenContract"',
        'r.status AS status',
        'c.status AS "vaultCycleStatus"',
        'r.requested_at AS "requestedAt"',
        'r.vault_released_at AS "vaultReleasedAt"',
        'r.payment_batch_id AS "paymentBatchId"',
        'r.custody_tx_hash AS "custodyTxHash"',
        'r.custody_at AS "custodyAt"',
        'r.payment_tx_hash AS "paymentTxHash"',
        'r.tracking_number AS "trackingNumber"',
        'r.tracking_carrier AS "trackingCarrier"',
        'r.carrier_delivered_at AS "carrierDeliveredAt"',
        'r.refund_status AS "refundStatus"',
        't.settlement_policy AS "settlementPolicy"',
        't.vault_partner_id AS "vaultPartnerId"',
        'r.fee_retrieval_usd AS "feeRetrievalUsd"',
        'r.fee_early_withdrawal_usd AS "feeEarlyWithdrawalUsd"',
        'r.fee_shipping_usd AS "feeShippingUsd"',
        'r.fee_total_usd AS "feeTotalUsd"',
        'r.payment_received_usdc_micros AS "paymentReceivedUsdcMicros"',
        'r.early_withdrawal AS "earlyWithdrawal"',
      ]);

    if (tokenIds && tokenIds.length > 0) {
      const lookup = [...new Set(tokenIds.flatMap(decimalTokenIdLookupKeys))];
      const norms = [...new Set(tokenIds.map((id) => normalizeDecimalTokenId(id)))];
      qb.andWhere(
        `(t.token_id IN (:...tokenIds) OR (t.token_id ~ :rwaNumRe AND COALESCE(NULLIF(LTRIM(t.token_id, :rwaZero), :rwaEmpty), :rwaZeroToken) IN (:...tokenNorms)))`,
        {
          tokenIds: lookup,
          rwaNumRe: '^[0-9]+$',
          rwaZero: '0',
          rwaEmpty: '',
          rwaZeroToken: '0',
          tokenNorms: norms,
        },
      );
    }

    const rows = await qb.getRawMany<{
      redemptionId: string;
      tokenId: string;
      tokenContract: string;
      status: VaultRedemptionStatus;
      vaultCycleStatus: string | null;
      requestedAt: Date;
      vaultReleasedAt: Date | null;
      paymentBatchId: string | null;
      custodyTxHash: string | null;
      custodyAt: Date | null;
      paymentTxHash: string | null;
      trackingNumber: string | null;
      trackingCarrier: string | null;
      carrierDeliveredAt: Date | null;
      refundStatus: string | null;
      settlementPolicy: 'standard' | 'self_vault_hold' | null;
      vaultPartnerId: string | null;
      feeRetrievalUsd: string | null;
      feeEarlyWithdrawalUsd: string | null;
      feeShippingUsd: string | null;
      feeTotalUsd: string | null;
      paymentReceivedUsdcMicros: string | null;
      earlyWithdrawal: boolean | null;
    }>();

    return rows.map((row) => ({
      redemptionId: row.redemptionId,
      tokenId: String(row.tokenId),
      tokenContract: String(row.tokenContract).toLowerCase(),
      status: row.status,
      vaultCycleStatus: row.vaultCycleStatus ?? null,
      requestedAt:
        row.requestedAt instanceof Date
          ? row.requestedAt.toISOString()
          : String(row.requestedAt),
      vaultReleasedAt:
        row.vaultReleasedAt instanceof Date
          ? row.vaultReleasedAt.toISOString()
          : row.vaultReleasedAt
            ? String(row.vaultReleasedAt)
            : null,
      paymentBatchId: row.paymentBatchId ?? null,
      custodyTxHash: row.custodyTxHash ?? null,
      custodyAt:
        row.custodyAt instanceof Date
          ? row.custodyAt.toISOString()
          : row.custodyAt
            ? String(row.custodyAt)
            : null,
      paymentTxHash: row.paymentTxHash ?? null,
      trackingNumber: row.trackingNumber ?? null,
      trackingCarrier: row.trackingCarrier ?? null,
      carrierDeliveredAt:
        row.carrierDeliveredAt instanceof Date
          ? row.carrierDeliveredAt.toISOString()
          : row.carrierDeliveredAt
            ? String(row.carrierDeliveredAt)
            : null,
      refundStatus: row.refundStatus ?? 'none',
      settlementPolicy:
        row.settlementPolicy === 'self_vault_hold' ||
        row.settlementPolicy === 'standard'
          ? row.settlementPolicy
          : null,
      vaultPartnerId: row.vaultPartnerId ?? null,
      feeRetrievalUsd:
        row.feeRetrievalUsd != null ? String(row.feeRetrievalUsd) : null,
      feeEarlyWithdrawalUsd:
        row.feeEarlyWithdrawalUsd != null
          ? String(row.feeEarlyWithdrawalUsd)
          : null,
      feeShippingUsd:
        row.feeShippingUsd != null ? String(row.feeShippingUsd) : null,
      feeTotalUsd: row.feeTotalUsd != null ? String(row.feeTotalUsd) : null,
      paymentReceivedUsdcMicros:
        row.paymentReceivedUsdcMicros != null
          ? String(row.paymentReceivedUsdcMicros)
          : null,
      earlyWithdrawal:
        row.earlyWithdrawal === true || row.earlyWithdrawal === false
          ? row.earlyWithdrawal
          : null,
    }));
  }

  /** Step 3 of "Redeem Request": ops confirms the physical asset shipped/released. */
  async confirmVaultRelease(redemptionId: string): Promise<VaultRedemption> {
    const redemption = await this.redemptions.findOne({ where: { id: redemptionId } });
    if (!redemption) {
      throw new NotFoundException(`Redemption ${redemptionId} not found`);
    }
    if (redemption.status !== 'burned') {
      throw new ConflictException(
        `Redemption must be in 'burned' state before release (current: ${redemption.status})`,
      );
    }
    redemption.status = 'completed';
    redemption.vaultReleasedAt = new Date();
    const saved = await this.redemptions.save(redemption);

    void this.notifications
      .notifyWithdrawalShipped({
        ownerWallet: saved.ownerWalletAddress,
        redemptionId: saved.id,
      })
      .catch((e) => {
        this.logger.warn(
          `notifyWithdrawalShipped failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      });

    return saved;
  }

  /**
   * User "I've received my cards" — or auto after FedEx delivery + grace.
   * Caller must enforce ownership + all tracked. Idempotent for already-completed.
   */
  async markUserReceiptConfirmed(
    rows: VaultRedemption[],
    opts?: { via?: 'user' | 'auto' },
  ): Promise<VaultRedemption[]> {
    if (rows.length === 0) return [];
    const via = opts?.via ?? 'user';
    const at = new Date();
    for (const row of rows) {
      if (row.status === 'completed') {
        if (!row.vaultReleasedAt) row.vaultReleasedAt = at;
        if (!row.receiptConfirmedVia) row.receiptConfirmedVia = via;
        continue;
      }
      row.status = 'completed';
      row.vaultReleasedAt = at;
      row.receiptConfirmedVia = via;
    }
    return this.redemptions.save(rows);
  }

  /** In-app alerts when a paid redeem batch reaches full custody. */
  async emitRedeemCustodyNotifications(
    paymentBatchId: string,
    chainId: SupportedChainId,
    rows: VaultRedemption[],
  ): Promise<void> {
    if (rows.length === 0) return;
    const ownerWallet = rows[0].ownerWalletAddress;
    void this.notifications
      .notifyRedeemPreparing({ ownerWallet, paymentBatchId, chainId })
      .catch((e) => {
        this.logger.warn(
          `notifyRedeemPreparing failed: ${e instanceof Error ? e.message : String(e)}`,
        );
      });

    const partnerTargets = await this.resolveSelfVaultPartnerShipTargets(rows);
    for (const target of partnerTargets) {
      void this.notifications
        .notifySellerRedeemShipRequired({
          partnerWallet: target.partnerWallet,
          redemptionId: target.redemptionId,
          tokenId: target.tokenId,
          chainId,
        })
        .catch((e) => {
          this.logger.warn(
            `notifySellerRedeemShipRequired failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        });
    }
  }

  private async resolveSelfVaultPartnerShipTargets(
    rows: VaultRedemption[],
  ): Promise<
    Array<{ redemptionId: string; partnerWallet: string; tokenId: string }>
  > {
    if (rows.length === 0) return [];
    const cycleIds = [...new Set(rows.map((r) => r.vaultCycleId))];
    const tokens = await this.rwaTokens.find({
      where: { vaultCycleId: In(cycleIds) },
    });
    const tokenByCycle = new Map(tokens.map((t) => [t.vaultCycleId as string, t]));
    const partnerIds = [
      ...new Set(
        tokens
          .filter(
            (t) =>
              t.settlementPolicy === 'self_vault_hold' && t.vaultPartnerId,
          )
          .map((t) => t.vaultPartnerId!)
          .filter(Boolean),
      ),
    ];
    if (partnerIds.length === 0) return [];

    const partners = await this.marketplacePartners.find({
      where: { id: In(partnerIds), isActive: true },
      select: ['id', 'walletAddress'],
    });
    const walletByPartnerId = new Map(
      partners.map((p) => [p.id, p.walletAddress.trim().toLowerCase()]),
    );

    const out: Array<{
      redemptionId: string;
      partnerWallet: string;
      tokenId: string;
    }> = [];
    for (const row of rows) {
      const token = tokenByCycle.get(row.vaultCycleId);
      if (
        !token ||
        token.settlementPolicy !== 'self_vault_hold' ||
        !token.vaultPartnerId
      ) {
        continue;
      }
      const partnerWallet = walletByPartnerId.get(token.vaultPartnerId);
      if (!partnerWallet) continue;
      out.push({
        redemptionId: row.id,
        partnerWallet,
        tokenId: String(token.tokenId),
      });
    }
    return out;
  }

  /** Full deposit/redeem history for a physical asset — ops visibility + audit. */
  async getHistoryForCert(
    certNumber: string,
    assetType: VaultAssetType = 'psa_graded',
  ): Promise<{ asset: VaultAsset | null; history: VaultAssetHistoryEntry[] }> {
    const normalized = VaultService.normalizeCert(certNumber);
    const asset = await this.assets.findOne({ where: { assetType, externalCertNumber: normalized } });
    if (!asset) return { asset: null, history: [] };

    const cycles = await this.cycles.find({
      where: { vaultAssetId: asset.id },
      order: { cycleNumber: 'ASC' },
    });
    const cycleIds = cycles.map((c) => c.id);
    const tokens =
      cycleIds.length > 0
        ? await this.rwaTokens.find({ where: { vaultCycleId: In(cycleIds) } })
        : [];
    const tokenByCycle = new Map(tokens.map((t) => [t.vaultCycleId as string, t]));

    const history = cycles.map((c) => {
      const token = tokenByCycle.get(c.id);
      return {
        cycleId: c.id,
        cycleNumber: c.cycleNumber,
        chainId: c.chainId,
        status: c.status,
        depositedAt: c.depositedAt,
        redeemedAt: c.redeemedAt,
        tokenId: token?.tokenId ?? null,
        tokenContract: token?.tokenContract ?? null,
        burnedAt: token?.burnedAt ?? null,
      };
    });

    return { asset, history };
  }

  /**
   * deposited_at for minted tokens (early-withdrawal clock).
   * Returns Map tokenId → { depositedAt, cycleId }.
   */
  async getDepositedAtByTokenIds(
    tokenContract: string,
    tokenIds: string[],
  ): Promise<
    Map<string, { depositedAt: Date | null; cycleId: string; status: string }>
  > {
    const out = new Map<
      string,
      { depositedAt: Date | null; cycleId: string; status: string }
    >();
    if (tokenIds.length === 0) return out;
    const tokens = await this.rwaTokens.find({
      where: { tokenContract, tokenId: In(tokenIds) },
    });
    const cycleIds = tokens
      .map((t) => t.vaultCycleId)
      .filter((id): id is string => Boolean(id));
    const cycles =
      cycleIds.length > 0
        ? await this.cycles.find({ where: { id: In(cycleIds) } })
        : [];
    const cycleById = new Map(cycles.map((c) => [c.id, c]));
    for (const t of tokens) {
      if (!t.vaultCycleId) continue;
      const c = cycleById.get(t.vaultCycleId);
      if (!c) continue;
      out.set(t.tokenId, {
        depositedAt: c.depositedAt,
        cycleId: c.id,
        status: c.status,
      });
    }
    return out;
  }

  async findRedemptionsByPaymentTx(paymentTxHash: string) {
    const hash = paymentTxHash.trim().toLowerCase();
    if (!hash) return [];
    return this.redemptions.find({ where: { paymentTxHash: hash } });
  }

  /** True when payment_tx_hash is already claimed (DB uniqueness source of truth). */
  async hasPaymentClaim(paymentTxHash: string): Promise<boolean> {
    const hash = paymentTxHash.trim().toLowerCase();
    if (!hash) return false;
    const n = await this.paymentClaims.count({ where: { paymentTxHash: hash } });
    return n > 0;
  }

  /**
   * Canonical batch payment micros from the claims ledger when present.
   * Falls back to denormalized redemption rows for legacy data.
   */
  async getPaymentReceivedMicrosForBatch(
    paymentBatchId: string,
  ): Promise<string | null> {
    const id = paymentBatchId.trim();
    if (!id) return null;
    const claim = await this.paymentClaims.findOne({
      where: { paymentBatchId: id },
    });
    const fromClaim = claim?.paymentReceivedUsdcMicros?.trim();
    if (fromClaim && /^\d+$/.test(fromClaim)) return fromClaim;

    const row = await this.redemptions.findOne({
      where: { paymentBatchId: id },
      order: { requestedAt: 'ASC' },
    });
    const fromRow = row?.paymentReceivedUsdcMicros?.trim();
    return fromRow && /^\d+$/.test(fromRow) ? fromRow : null;
  }

  async findRedemptionsByBatchId(
    paymentBatchId: string,
    chainId?: number,
  ) {
    const id = paymentBatchId.trim();
    if (!id) return [];

    if (chainId == null) {
      return this.redemptions.find({
        where: { paymentBatchId: id },
        order: { requestedAt: 'ASC' },
      });
    }

    return this.redemptions
      .createQueryBuilder('r')
      .innerJoin(VaultCycle, 'c', 'c.id = r.vault_cycle_id')
      .where('r.payment_batch_id = :batchId', { batchId: id })
      .andWhere('COALESCE(r.chain_id, c.chain_id) = :chainId', { chainId })
      .orderBy('r.requested_at', 'ASC')
      .getMany();
  }

  /** Open redeem for a vault cycle (excludes terminal statuses). */
  async findOpenRedemptionForCycle(
    vaultCycleId: string,
  ): Promise<VaultRedemption | null> {
    return this.redemptions
      .createQueryBuilder('r')
      .where('r.vault_cycle_id = :cycleId', { cycleId: vaultCycleId })
      .andWhere(
        "r.status NOT IN ('completed', 'failed', 'cancelled', 'refunded')",
      )
      .orderBy('r.requested_at', 'DESC')
      .getOne();
  }

  async markCustodyReceived(params: {
    redemptionId: string;
    custodyTxHash: string;
  }): Promise<VaultRedemption> {
    const row = await this.redemptions.findOne({
      where: { id: params.redemptionId },
    });
    if (!row) {
      throw new NotFoundException(`Redemption ${params.redemptionId} not found`);
    }
    if (row.status === 'in_custody' && row.custodyTxHash) {
      return row;
    }
    if (row.status !== 'ownership_verified') {
      throw new ConflictException(
        `Redemption ${row.id} cannot accept custody (status=${row.status})`,
      );
    }
    row.custodyTxHash = params.custodyTxHash.trim().toLowerCase();
    row.custodyAt = new Date();
    row.status = 'in_custody';
    return this.redemptions.save(row);
  }

  /** Token id for a redemption via vault_cycle → rwa_tokens. */
  async getTokenIdForRedemption(redemptionId: string): Promise<string | null> {
    const row = await this.redemptions
      .createQueryBuilder('r')
      .innerJoin(RwaToken, 't', 't.vault_cycle_id = r.vault_cycle_id')
      .where('r.id = :id', { id: redemptionId })
      .select('t.token_id', 'tokenId')
      .getRawOne<{ tokenId: string }>();
    return row?.tokenId != null ? String(row.tokenId) : null;
  }

  /** Guard used by redemption-request endpoints: throws unless the wallet truly owns the token. */
  assertOwnerMatches(actualOwner: string, expectedOwner: string): void {
    if (actualOwner.trim().toLowerCase() !== expectedOwner.trim().toLowerCase()) {
      throw new ForbiddenException('Wallet does not currently own this token');
    }
  }
}
