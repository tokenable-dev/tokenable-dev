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
import { In, Repository } from 'typeorm';
import { RwaToken } from '../marketplace/entities/rwa-token.entity';
import { VaultAsset, VaultAssetType } from './entities/vault-asset.entity';
import { VaultCycle } from './entities/vault-cycle.entity';
import { VaultRedemption } from './entities/vault-redemption.entity';

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
    @InjectRepository(RwaToken)
    private readonly rwaTokens: Repository<RwaToken>,
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
   * Pre-flight check usable before doing expensive work (e.g. IPFS upload):
   * throws if this physical asset already has an open (non-terminal) cycle
   * on the given chain. Cycles are chain-scoped — the on-chain
   * `activeTokenIdByVaultRef` invariant is per contract, so a live Sepolia
   * NFT must not block a Polygon mint.
   */
  async assertAvailableForNewCycle(
    certNumber: string,
    chainId: number,
    assetType: VaultAssetType = 'psa_graded',
  ): Promise<void> {
    const normalized = VaultService.normalizeCert(certNumber);
    const asset = await this.assets.findOne({
      where: { assetType, externalCertNumber: normalized },
    });
    if (!asset) return;

    const openCycle = await this.cycles
      .createQueryBuilder('c')
      .where('c.vault_asset_id = :assetId', { assetId: asset.id })
      .andWhere('c.chain_id = :chainId', { chainId })
      .andWhere("c.status NOT IN ('redeemed', 'cancelled')")
      .getOne();

    if (openCycle) {
      throw new ConflictException(
        `PSA cert #${normalized} already has an active vault cycle on chain ${chainId} (#${openCycle.cycleNumber}, status=${openCycle.status}). Redeem it before re-vaulting.`,
      );
    }
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
  }): Promise<void> {
    const cycle = await this.cycles.findOne({ where: { id: params.cycleId } });
    if (!cycle) {
      throw new NotFoundException(`Vault cycle ${params.cycleId} not found`);
    }

    cycle.status = 'minted';
    await this.cycles.save(cycle);

    const vaultRef = VaultService.computeVaultRef(params.certNumber);
    await this.rwaTokens.upsert(
      {
        tokenContract: params.tokenContract,
        tokenId: params.tokenId,
        certNumber: VaultService.normalizeCert(params.certNumber),
        tokenUri: params.tokenURI,
        displayName: params.displayName?.trim() || null,
        vaultCycleId: cycle.id,
        vaultRef,
        metadataSyncedAt: new Date(),
      },
      ['tokenContract', 'tokenId'],
    );
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
  }): Promise<VaultRedemption> {
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
      .andWhere("r.status NOT IN ('completed', 'failed', 'cancelled')")
      .getOne();
    if (existingOpen) {
      return existingOpen;
    }

    const redemption = this.redemptions.create({
      vaultCycleId: cycle.id,
      requestedByUserId: params.requestingUserId,
      ownerWalletAddress: params.ownerWalletAddress.toLowerCase(),
      status: 'ownership_verified',
      ownershipVerifiedAt: new Date(),
    });
    const saved = await this.redemptions.save(redemption);

    cycle.status = 'redemption_requested';
    await this.cycles.save(cycle);

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
    return this.redemptions.save(redemption);
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

  /** Guard used by redemption-request endpoints: throws unless the wallet truly owns the token. */
  assertOwnerMatches(actualOwner: string, expectedOwner: string): void {
    if (actualOwner.trim().toLowerCase() !== expectedOwner.trim().toLowerCase()) {
      throw new ForbiddenException('Wallet does not currently own this token');
    }
  }
}
