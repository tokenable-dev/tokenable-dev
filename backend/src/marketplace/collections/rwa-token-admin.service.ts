import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RwaAssetResolveService } from '../../blockchain/rwa-asset-resolve.service';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { ChainConfigService } from '../../blockchain/chain-config.service';
import { RwaChainWriterService } from '../../blockchain/rwa-chain-writer.service';
import { IpfsGatewayResolverService } from '../../blockchain/ipfs-gateway-resolver.service';
import { VaultCycle } from '../../vault/entities/vault-cycle.entity';
import { VaultService } from '../../vault/vault.service';
import { Order, OrderSide, OrderStatus } from '../entities/order.entity';
import { RwaToken } from '../entities/rwa-token.entity';
import { pickRwaAssetDisplayImageRef } from '../utils/collection-image.util';
import { RwaTokenRegistryService } from './rwa-token-registry.service';
import {
  AdminRwaRoleKey,
  ADMIN_RWA_ROLE_KEYS,
} from './dto/admin-rwa-role.dto';
import { UserService } from '../../user/user.service';

export type AdminRwaCardRow = {
  tokenId: number;
  certNumber: string | null;
  displayName: string | null;
  displayImageUrl: string | null;
  catalogImageUrl: string | null;
  resolvedImageUrl: string | null;
  collectionKey: string | null;
  orderHash: string | null;
  priceUsdc: number | null;
  offerer: string | null;
  hasActiveListing: boolean;
  burnedAt: string | null;
  vaultCycleStatus: string | null;
};

/** @deprecated use AdminRwaCardRow */
export type AdminListedRwaCardRow = AdminRwaCardRow;

export type AdminCustodyNftRow = {
  tokenId: number;
  certNumber: string | null;
  displayName: string | null;
  resolvedImageUrl: string | null;
  onChainOwner: string;
  custodyWallet: string;
  vaultCycleStatus: string | null;
  depositedByUserId: string | null;
  recipientUserEmail: string | null;
  recipientUserName: string | null;
  recipientPrimaryWallet: string | null;
  hasActiveListing: boolean;
  burnedAt: string | null;
};

@Injectable()
export class RwaTokenAdminService {
  private readonly logger = new Logger(RwaTokenAdminService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepo: Repository<Order>,
    @InjectRepository(RwaToken)
    private readonly rwaTokenRepo: Repository<RwaToken>,
    @InjectRepository(VaultCycle)
    private readonly vaultCycleRepo: Repository<VaultCycle>,
    private readonly config: ConfigService,
    private readonly chainConfig: ChainConfigService,
    private readonly chainWriter: RwaChainWriterService,
    private readonly blockchain: BlockchainService,
    private readonly ipfs: IpfsGatewayResolverService,
    private readonly rwaAssetResolve: RwaAssetResolveService,
    private readonly rwaTokenRegistry: RwaTokenRegistryService,
    private readonly vault: VaultService,
    private readonly users: UserService,
  ) {}

  private rwaContractAddress(): string {
    return this.chainConfig.getRwaAddress(this.chainConfig.getDefaultChainId());
  }

  private assertImageUrl(url: string): void {
    const t = url.trim();
    if (!t) return;
    if (!/^https?:\/\//i.test(t) && !/^ipfs:\/\//i.test(t)) {
      throw new BadRequestException('Invalid display image URL');
    }
  }

  /** Cancel active marketplace orders for a token before admin burn/delivery. */
  private async cancelActiveOrdersForToken(
    tokenContract: string,
    tokenId: number,
  ): Promise<string[]> {
    const raw = String(Math.floor(tokenId));
    const variants = new Set<string>([raw]);
    let i = 0;
    while (i < raw.length - 1 && raw[i] === '0') i++;
    variants.add(raw.slice(i));

    const activeOrders = await this.orderRepo
      .createQueryBuilder('o')
      .where('LOWER(o.token_contract) = :contract', {
        contract: tokenContract.toLowerCase(),
      })
      .andWhere('o.token_id IN (:...variants)', { variants: [...variants] })
      .andWhere('o.status = :status', { status: OrderStatus.ACTIVE })
      .getMany();
    if (activeOrders.length === 0) return [];

    const cancelled: string[] = [];
    for (const order of activeOrders) {
      order.status = OrderStatus.CANCELLED;
      await this.orderRepo.save(order);
      cancelled.push(order.orderHash);
    }
    this.logger.log(
      `Cancelled ${cancelled.length} active order(s) for token #${tokenId} before admin action`,
    );
    return cancelled;
  }

  /** All minted RWA registry rows for the active chain (listed + unlisted + burned). */
  async listAllRegistryCards(): Promise<{ items: AdminRwaCardRow[] }> {
    const contract = this.rwaContractAddress();
    if (!contract) {
      return { items: [] };
    }

    const rows = await this.rwaTokenRepo
      .createQueryBuilder('t')
      .where('t.token_contract = :contract', { contract })
      .orderBy('CAST(t.token_id AS INTEGER)', 'DESC')
      .limit(5_000)
      .getMany();

    if (rows.length === 0) {
      return { items: [] };
    }

    const tokenIdStrs = rows.map((r) => r.tokenId);
    const orders = await this.orderRepo.find({
      where: {
        status: OrderStatus.ACTIVE,
        side: OrderSide.ASK,
        tokenId: In(tokenIdStrs),
      },
    });

    const orderByToken = new Map<number, Order>();
    for (const o of orders) {
      const tid = Number(o.tokenId);
      if (!Number.isFinite(tid) || tid < 0) continue;
      if (!orderByToken.has(tid)) orderByToken.set(tid, o);
    }

    const cycleIds = [
      ...new Set(
        rows
          .map((r) => r.vaultCycleId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ];
    const cycleById = new Map<string, VaultCycle>();
    if (cycleIds.length > 0) {
      const cycles = await this.vaultCycleRepo.find({
        where: { id: In(cycleIds) },
      });
      for (const c of cycles) cycleById.set(c.id, c);
    }

    const items = await Promise.all(
      rows.map(async (registry) => {
        const tokenId = Number(registry.tokenId);
        const order = orderByToken.get(tokenId);
        const cycle = registry.vaultCycleId
          ? cycleById.get(registry.vaultCycleId)
          : undefined;

        let catalogImageUrl: string | null = null;
        let resolvedImageUrl: string | null = null;
        try {
          const resolved =
            await this.rwaAssetResolve.resolveAssetFromRegistryRow(registry);
          catalogImageUrl = resolved.catalogImageUrl;
          resolvedImageUrl = resolved.resolvedImageUrl;
        } catch {
          /* skip image resolution */
        }

        const priceUsdc = order
          ? Number(order.considerationAmount) / 1_000_000
          : null;
        const collectionKey =
          registry.collectionKey?.trim().toLowerCase() ??
          order?.collectionKey?.trim().toLowerCase() ??
          null;

        return {
          tokenId,
          certNumber: registry.certNumber ?? null,
          displayName: registry.displayName ?? null,
          displayImageUrl: registry.displayImageUrl?.trim() ?? null,
          catalogImageUrl,
          resolvedImageUrl,
          collectionKey,
          orderHash: order?.orderHash ?? null,
          priceUsdc:
            priceUsdc != null && Number.isFinite(priceUsdc) ? priceUsdc : null,
          offerer: order?.offerer ?? null,
          hasActiveListing: Boolean(order),
          burnedAt: registry.burnedAt?.toISOString() ?? null,
          vaultCycleStatus: cycle?.status ?? null,
        };
      }),
    );

    return { items };
  }

  /** @deprecated use listAllRegistryCards — kept for backward-compatible route. */
  async listActiveListedCards(): Promise<{ items: AdminRwaCardRow[] }> {
    const all = await this.listAllRegistryCards();
    return {
      items: all.items.filter((row) => row.hasActiveListing),
    };
  }

  async updateTokenAdmin(
    tokenId: number,
    patch: {
      displayImageUrl?: string | null;
      displayName?: string | null;
      collectionKey?: string | null;
    },
  ): Promise<RwaToken> {
    const contract = this.rwaContractAddress();
    if (!contract) {
      throw new BadRequestException('RWA contract not configured');
    }

    await this.rwaTokenRegistry.syncTokenFromChain(tokenId);

    const row = await this.rwaTokenRepo.findOne({
      where: { tokenContract: contract, tokenId: String(tokenId) },
    });
    if (!row) {
      throw new NotFoundException(`RWA token #${tokenId} not found in registry`);
    }

    if (patch.displayImageUrl !== undefined) {
      const url = (patch.displayImageUrl ?? '').trim();
      if (url) {
        this.assertImageUrl(url);
        row.displayImageUrl = url;
      } else {
        row.displayImageUrl = null;
      }
    }

    if (patch.displayName !== undefined) {
      const name = (patch.displayName ?? '').trim();
      row.displayName = name || null;
    }

    if (patch.collectionKey !== undefined) {
      const key = (patch.collectionKey ?? '').trim().toLowerCase();
      row.collectionKey = key || null;
    }

    return this.rwaTokenRepo.save(row);
  }

  async previewImageRefFromMetadata(
    tokenId: number,
  ): Promise<{ imageRef: string | null; httpsUrl: string | null }> {
    const tokenURI = await this.blockchain.getRwaTokenURI(tokenId);
    const meta = await this.ipfs.fetchMetadataJson(tokenURI);
    const ref = pickRwaAssetDisplayImageRef(meta) ?? null;
    const httpsUrl = ref ? await this.ipfs.resolveUriToHttps(ref) : null;
    return { imageRef: ref, httpsUrl };
  }

  /** NFTs currently held in the platform custody wallet pending user delivery. */
  async listCustodyHeldNfts(): Promise<{
    custodyWallet: string;
    items: AdminCustodyNftRow[];
  }> {
    const chainId = this.chainConfig.getDefaultChainId();
    const contract = this.rwaContractAddress();
    const custodyWallet = await this.chainWriter.getCustodyWalletAddress(chainId);
    if (!contract) {
      return { custodyWallet, items: [] };
    }

    const tokenIds = await this.blockchain.getRwaTokensByOwner(custodyWallet);
    if (tokenIds.length === 0) {
      return { custodyWallet, items: [] };
    }

    const tokenIdStrs = tokenIds.map(String);
    const rows = await this.rwaTokenRepo.find({
      where: {
        tokenContract: contract,
        tokenId: In(tokenIdStrs),
      },
    });
    const rowByTokenId = new Map(rows.map((r) => [Number(r.tokenId), r]));

    const orders = await this.orderRepo.find({
      where: {
        status: OrderStatus.ACTIVE,
        side: OrderSide.ASK,
        tokenId: In(tokenIdStrs),
      },
    });
    const orderByToken = new Map<number, Order>();
    for (const o of orders) {
      const tid = Number(o.tokenId);
      if (!Number.isFinite(tid) || tid < 0) continue;
      if (!orderByToken.has(tid)) orderByToken.set(tid, o);
    }

    const cycleIds = [
      ...new Set(
        rows
          .map((r) => r.vaultCycleId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ];
    const cycleById = new Map<string, VaultCycle>();
    if (cycleIds.length > 0) {
      const cycles = await this.vaultCycleRepo.find({
        where: { id: In(cycleIds) },
      });
      for (const c of cycles) cycleById.set(c.id, c);
    }

    const userIds = [
      ...new Set(
        [...cycleById.values()]
          .map((c) => c.depositedByUserId)
          .filter((id): id is string => typeof id === 'string' && id.length > 0),
      ),
    ];
    const userById = new Map<
      string,
      { email: string; name: string | null; primaryWallet: string | null }
    >();
    for (const userId of userIds) {
      try {
        const user = await this.users.findByIdOrFail(userId);
        const wallets = await this.users.listWalletsForUser(userId);
        const primary =
          wallets.find((w) => w.isPrimary)?.walletAddress ??
          wallets[0]?.walletAddress ??
          user.walletAddress;
        userById.set(userId, {
          email: user.email,
          name: user.name,
          primaryWallet: primary?.trim().toLowerCase() ?? null,
        });
      } catch {
        /* skip missing user */
      }
    }

    const items = await Promise.all(
      tokenIds.map(async (tokenId) => {
        const registry = rowByTokenId.get(tokenId);
        const order = orderByToken.get(tokenId);
        const cycle = registry?.vaultCycleId
          ? cycleById.get(registry.vaultCycleId)
          : undefined;
        const depositor = cycle?.depositedByUserId
          ? userById.get(cycle.depositedByUserId)
          : undefined;

        let resolvedImageUrl: string | null = null;
        if (registry) {
          try {
            const resolved =
              await this.rwaAssetResolve.resolveAssetFromRegistryRow(registry);
            resolvedImageUrl = resolved.resolvedImageUrl;
          } catch {
            /* skip image resolution */
          }
        }

        return {
          tokenId,
          certNumber: registry?.certNumber ?? null,
          displayName: registry?.displayName ?? null,
          resolvedImageUrl,
          onChainOwner: custodyWallet,
          custodyWallet,
          vaultCycleStatus: cycle?.status ?? null,
          depositedByUserId: cycle?.depositedByUserId ?? null,
          recipientUserEmail: depositor?.email ?? null,
          recipientUserName: depositor?.name ?? null,
          recipientPrimaryWallet: depositor?.primaryWallet ?? null,
          hasActiveListing: Boolean(order),
          burnedAt: registry?.burnedAt?.toISOString() ?? null,
        };
      }),
    );

    items.sort((a, b) => b.tokenId - a.tokenId);
    return { custodyWallet, items };
  }

  /**
   * Transfer a custody-held NFT to the vault depositor's linked wallet
   * (primary by default, or an explicit override that must still be linked).
   */
  async deliverCustodyNftToUser(
    tokenId: number,
    recipientAddress?: string | null,
  ): Promise<{ txHash: string; recipientAddress: string }> {
    const contract = this.rwaContractAddress();
    if (!contract) {
      throw new BadRequestException('RWA contract not configured');
    }

    const tid = Math.floor(Number(tokenId));
    if (!Number.isFinite(tid) || tid < 0) {
      throw new BadRequestException('Invalid tokenId');
    }

    const registry = await this.rwaTokenRepo.findOne({
      where: { tokenContract: contract, tokenId: String(tid) },
    });
    if (registry?.burnedAt) {
      throw new BadRequestException(`Token #${tid} is already burned`);
    }

    const activeAsk = await this.orderRepo.findOne({
      where: { tokenId: String(tid), status: OrderStatus.ACTIVE, side: OrderSide.ASK },
    });
    if (activeAsk) {
      throw new BadRequestException('Cancel the active listing before delivering');
    }

    const chainId = this.chainConfig.getDefaultChainId();
    const custodyWallet = await this.chainWriter.getCustodyWalletAddress(chainId);
    const onChainOwner = await this.blockchain.getRwaTokenOwner(tid);
    if (onChainOwner !== custodyWallet) {
      throw new BadRequestException(
        `Token #${tid} is not in custody (on-chain owner=${onChainOwner})`,
      );
    }

    let cycle: VaultCycle | null = null;
    if (registry?.vaultCycleId) {
      cycle = await this.vaultCycleRepo.findOne({
        where: { id: registry.vaultCycleId },
      });
    }
    if (!cycle?.depositedByUserId) {
      throw new BadRequestException(
        `Token #${tid} has no vault depositor on record`,
      );
    }

    const override = recipientAddress?.trim().toLowerCase();
    let deliverTo: string;
    if (override) {
      const wallets = await this.users.listWalletsForUser(cycle.depositedByUserId);
      const linked = wallets.some(
        (w) => w.walletAddress.trim().toLowerCase() === override,
      );
      if (!linked) {
        throw new BadRequestException(
          'Recipient wallet must be linked to the vault depositor account',
        );
      }
      deliverTo = override;
    } else {
      const wallets = await this.users.listWalletsForUser(cycle.depositedByUserId);
      const primary =
        wallets.find((w) => w.isPrimary)?.walletAddress ??
        wallets[0]?.walletAddress;
      if (!primary?.trim()) {
        throw new BadRequestException(
          'Vault depositor has no linked wallet — link a Privy account wallet first',
        );
      }
      deliverTo = primary.trim().toLowerCase();
    }

    const result = await this.chainWriter.safeTransferFromCustody(
      tid,
      deliverTo,
      chainId,
    );
    return { txHash: result.txHash, recipientAddress: deliverTo };
  }

  /**
   * Executes "Redeem Request -> Execute admin burn -> Mark asset as redeemed"
   * (the physical vault release itself is a separate ops step — see
   * VaultService.confirmVaultRelease / confirmRedemptionRelease below).
   */
  async burnTokenOnChain(
    tokenId: number,
  ): Promise<{ txHash: string; cancelledOrderHashes: string[] }> {
    const contract = this.rwaContractAddress();
    if (!contract) {
      throw new BadRequestException('RWA contract not configured');
    }

    const tid = Math.floor(Number(tokenId));
    if (!Number.isFinite(tid) || tid < 0) {
      throw new BadRequestException('Invalid tokenId');
    }

    const existing = await this.rwaTokenRepo.findOne({
      where: { tokenContract: contract, tokenId: String(tid) },
    });
    if (existing?.burnedAt) {
      throw new BadRequestException(
        `Token #${tid} is already marked burned (${existing.burnTxHash ?? 'no tx hash'})`,
      );
    }

    const cancelledOrderHashes = await this.cancelActiveOrdersForToken(
      contract,
      tid,
    );

    let expectedOwner: string | null = null;
    try {
      expectedOwner = await this.blockchain.getRwaTokenOwner(tid);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new BadRequestException(
        msg.includes('does not exist')
          ? `Token #${tid} is not minted on chain (may already be burned).`
          : `Could not resolve on-chain owner for token #${tid}: ${msg}`,
      );
    }

    await this.rwaTokenRegistry.syncTokenFromChain(tid);
    const result = await this.chainWriter.adminBurn(
      tid,
      this.chainConfig.getDefaultChainId(),
      expectedOwner,
    );

    await this.vault.completeRedemptionBurn({
      tokenContract: contract,
      tokenId: String(tid),
      burnTxHash: result.txHash,
      burnedByWalletAddress: expectedOwner,
    });

    return { ...result, cancelledOrderHashes };
  }

  /** [Admin] Ops confirms the physical asset has been shipped/released from the vault. */
  async confirmRedemptionRelease(redemptionId: string) {
    return this.vault.confirmVaultRelease(redemptionId);
  }

  async getContractRolesOverview(): Promise<{
    chainId: number;
    contractAddress: string;
    adminSignerAddress: string;
    adminSignerHasDefaultAdmin: boolean;
    roles: { key: AdminRwaRoleKey; label: string; description: string }[];
  }> {
    const chainId = this.chainConfig.getDefaultChainId();
    const contractAddress = this.rwaContractAddress();
    if (!contractAddress) {
      throw new BadRequestException('RWA contract not configured');
    }

    const adminSignerAddress = await this.chainWriter.getAdminSignerAddress(chainId);
    const status = await this.chainWriter.getWalletRoleStatus(
      adminSignerAddress,
      chainId,
    );

    return {
      chainId,
      contractAddress,
      adminSignerAddress,
      adminSignerHasDefaultAdmin: status.roles.default_admin,
      roles: [
        {
          key: 'default_admin',
          label: 'Default admin',
          description: 'UUPS upgrades, royalty/contractURI, grant/revoke roles',
        },
        {
          key: 'minter',
          label: 'Minter',
          description: 'mint / mintBatch (vault deposits)',
        },
        {
          key: 'burner',
          label: 'Burner',
          description: 'adminBurn (redemptions)',
        },
        {
          key: 'pauser',
          label: 'Pauser',
          description: 'pause / unpause transfers and mints',
        },
      ],
    };
  }

  async getWalletContractRoles(walletAddress: string) {
    return this.chainWriter.getWalletRoleStatus(walletAddress);
  }

  async grantWalletContractRole(walletAddress: string, role: AdminRwaRoleKey) {
    if (!ADMIN_RWA_ROLE_KEYS.includes(role)) {
      throw new BadRequestException('Invalid role');
    }
    return this.chainWriter.grantAccessRole(walletAddress, role);
  }

  async revokeWalletContractRole(walletAddress: string, role: AdminRwaRoleKey) {
    if (!ADMIN_RWA_ROLE_KEYS.includes(role)) {
      throw new BadRequestException('Invalid role');
    }
    return this.chainWriter.revokeAccessRole(walletAddress, role);
  }

  /** [Admin] Full deposit/redeem history for a physical asset (audit view). */
  async getVaultHistoryForCert(certNumber: string) {
    return this.vault.getHistoryForCert(certNumber);
  }
}
