import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { RwaChainWriterService } from '../blockchain/rwa-chain-writer.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import {
  ChainConfigService,
  type SupportedChainId,
} from '../blockchain/chain-config.service';
import { KycService } from '../kyc/kyc.service';
import { PortfolioDailySnapshotService } from '../marketplace/portfolio/portfolio-daily-snapshot.service';
import { PortfolioHoldingService } from '../marketplace/portfolio/portfolio-holding.service';
import { VaultService } from '../vault/vault.service';
import { VaultSubmissionService } from '../vault/vault-submission.service';
import { MarketplacePartnersService } from '../marketplace/partners/marketplace-partners.service';
import { MintRwaDto, type MintDeliveryMode } from './dto/mint-rwa.dto';
import { RwaSlabS3Service } from './rwa-slab-s3.service';

export type MintRwaResult = {
  tokenId: number;
  tokenURI: string;
  vaultRef: string;
  txHash: string;
  chainId: number;
  /** Platform custody wallet address (always returned for ops reference). */
  custodyWallet: string;
  /** On-chain mint recipient (custody or user wallet). */
  mintedTo: string;
  intendedRecipient: string;
  deliveryMode: MintDeliveryMode;
};

/**
 * Orchestrates the "Vault Deposit" pipeline end to end:
 *   verify wallet link -> reserve vault cycle -> mint on-chain -> record result.
 *
 * Default `deliveryMode=custody`: mint to platform custody; admin delivers later.
 * Self vault uses `deliveryMode=direct`: mint straight to the user's linked wallet.
 */
@Injectable()
export class RwaMintService {
  private readonly logger = new Logger(RwaMintService.name);

  constructor(
    private readonly chainWriter: RwaChainWriterService,
    private readonly blockchain: BlockchainService,
    private readonly chainConfig: ChainConfigService,
    private readonly users: UserService,
    private readonly vault: VaultService,
    private readonly vaultSubmissions: VaultSubmissionService,
    private readonly portfolioHoldings: PortfolioHoldingService,
    private readonly portfolioSnapshots: PortfolioDailySnapshotService,
    private readonly partners: MarketplacePartnersService,
    private readonly kyc: KycService,
    private readonly rwaSlabS3: RwaSlabS3Service,
  ) {}

  async mintForUser(
    user: User,
    dto: MintRwaDto,
    chainId: SupportedChainId,
  ): Promise<MintRwaResult> {
    await this.kyc.assertApprovedForCustody(user);

    const recipient = dto.recipientAddress.trim().toLowerCase();
    const deliveryMode: MintDeliveryMode =
      dto.deliveryMode === 'direct' ? 'direct' : 'custody';

    // Ensure the recipient wallet is linked to this Tokenable account.
    const wallets = await this.users.listWalletsForUser(user.id);
    const linked = wallets.some(
      (w) => w.walletAddress.trim().toLowerCase() === recipient,
    );
    if (!linked) {
      throw new ForbiddenException(
        'Recipient wallet must be linked to your Tokenable account',
      );
    }

    const tokenURI = dto.tokenURI.trim();
    if (!tokenURI) {
      throw new BadRequestException('tokenURI is required');
    }
    const certNumber = dto.certNumber.trim();
    if (!certNumber) {
      throw new BadRequestException('certNumber is required');
    }

    // Self vault must never mint a slab that already finished PSA ship
    // (in transit / at PSA). Custody mint for that PSA path remains allowed.
    // Only contracted (active) partners with company Origin may mint direct.
    let vaultPartnerId: string | null = null;
    if (deliveryMode === 'direct') {
      const partner = await this.partners.assertSelfVaultEligibleForUser(
        user.id,
      );
      vaultPartnerId = partner.partnerId;
      await this.vaultSubmissions.assertCertAvailableForSelfVault(certNumber);
    }

    // The on-chain vaultRef MUST be derived from the permanent physical-asset
    // identity (PSA cert number), never from tokenURI — otherwise the
    // contract's anti-double-claim check across vault re-deposits is defeated.
    const vaultRef = VaultService.computeVaultRef(certNumber);

    // "Vault Deposit -> Verify deposit -> Create asset record" — reserves the
    // physical asset's cycle before spending gas on-chain. Throws if this
    // cert already has an open (non-redeemed) cycle.
    const { cycle } = await this.vault.reserveCycleForDeposit({
      certNumber,
      chainId,
      depositedByUserId: user.id,
    });

    await this.vaultSubmissions.attachCycleForCert({
      userId: user.id,
      certNumber,
      cycleId: cycle.id,
    });

    const custodyWallet = await this.chainWriter.getCustodyWalletAddress(chainId);
    const mintToAddress = deliveryMode === 'direct' ? recipient : custodyWallet;
    let tokenId: number;
    let txHash: string;
    try {
      ({ tokenId, txHash } = await this.chainWriter.mintTo(
        mintToAddress,
        tokenURI,
        vaultRef,
        chainId,
      ));
    } catch (err) {
      // Release the reserved cycle so this cert isn't stuck "occupied" by a
      // deposit that never actually minted on-chain.
      await this.vault.cancelCycle(cycle.id, `on-chain mint failed: ${String(err)}`);
      throw err;
    }

    const contract = this.chainConfig.getRwaAddress(chainId);
    const displayImageUrl = this.rwaSlabS3.normalizeTrustedMintSlabUrl(
      dto.displayImageUrl,
      chainId,
      certNumber,
      'front',
    );
    const displayImageBackUrl = this.rwaSlabS3.normalizeTrustedMintSlabUrl(
      dto.displayImageBackUrl,
      chainId,
      certNumber,
      'back',
    );
    await this.vault.recordMintResult({
      cycleId: cycle.id,
      tokenContract: contract,
      tokenId: String(tokenId),
      tokenURI,
      txHash,
      certNumber,
      displayImageUrl,
      displayImageBackUrl,
      settlementPolicy:
        deliveryMode === 'direct' ? 'self_vault_hold' : 'standard',
      vaultPartnerId,
      ownerWallet: mintToAddress,
    });
    await this.vaultSubmissions.markItemCompletedForCycle(cycle.id);

    if (deliveryMode === 'direct') {
      await this.seedDirectMintCostBasis(recipient, tokenId, chainId);
      await this.portfolioSnapshots.refreshCurrentSlotSnapshot(
        recipient,
        chainId,
        1500,
      );
    }

    return {
      tokenId,
      tokenURI,
      vaultRef,
      txHash,
      chainId,
      custodyWallet,
      mintedTo: mintToAddress,
      intendedRecipient: recipient,
      deliveryMode,
    };
  }

  /**
   * Admin PSA-vault path: mint to custody (standard settlement), then
   * immediately transfer to the depositor's linked wallet — one ops action.
   * Does not use deliveryMode=direct (that path is blocked for shipped certs).
   */
  async mintCustodyThenDeliverForUser(
    user: User,
    dto: MintRwaDto,
    chainId: SupportedChainId,
  ): Promise<MintRwaResult & { deliverTxHash: string }> {
    const mint = await this.mintForUser(
      user,
      { ...dto, deliveryMode: 'custody' },
      chainId,
    );
    const recipient = mint.intendedRecipient;
    const { txHash: deliverTxHash } =
      await this.chainWriter.safeTransferFromCustody(
        mint.tokenId,
        recipient,
        chainId,
      );
    await this.seedDirectMintCostBasis(recipient, mint.tokenId, chainId);
    await this.portfolioSnapshots.refreshCurrentSlotSnapshot(
      recipient,
      chainId,
      1500,
    );
    return {
      ...mint,
      mintedTo: recipient,
      deliverTxHash,
    };
  }

  /**
   * Admin mint-queue: cert already has a minted cycle — attach sell-flow item
   * and deliver from custody (or skip transfer if the user already holds it).
   */
  async adoptExistingMintedAndDeliverForUser(
    user: User,
    params: {
      recipientAddress: string;
      certNumber: string;
      tokenId: number;
      tokenURI: string;
      vaultRef: string;
      cycleId: string;
    },
    chainId: SupportedChainId,
  ): Promise<
    MintRwaResult & {
      deliverTxHash: string | null;
      adoptedExisting: true;
      alreadyWithUser: boolean;
    }
  > {
    await this.kyc.assertApprovedForCustody(user);

    const recipient = params.recipientAddress.trim().toLowerCase();
    const wallets = await this.users.listWalletsForUser(user.id);
    const linked = wallets.some(
      (w) => w.walletAddress.trim().toLowerCase() === recipient,
    );
    if (!linked) {
      throw new ForbiddenException(
        'Recipient wallet must be linked to the depositor Tokenable account',
      );
    }

    await this.vaultSubmissions.attachCycleForCert({
      userId: user.id,
      certNumber: params.certNumber,
      cycleId: params.cycleId,
    });

    const custodyWallet =
      await this.chainWriter.getCustodyWalletAddress(chainId);
    const onChainOwner = await this.blockchain.getRwaTokenOwner(
      params.tokenId,
      chainId,
    );

    let deliverTxHash: string | null = null;
    let alreadyWithUser = false;

    if (onChainOwner === recipient) {
      alreadyWithUser = true;
      this.logger.log(
        `Adopt existing mint: token #${params.tokenId} already with user ${recipient}`,
      );
    } else if (onChainOwner === custodyWallet) {
      const transferred = await this.chainWriter.safeTransferFromCustody(
        params.tokenId,
        recipient,
        chainId,
      );
      deliverTxHash = transferred.txHash;
      await this.seedDirectMintCostBasis(recipient, params.tokenId, chainId);
    } else {
      throw new BadRequestException(
        `Token #${params.tokenId} is neither in custody nor the depositor wallet (owner=${onChainOwner}). Resolve ownership before mint-queue adopt.`,
      );
    }

    await this.vaultSubmissions.markItemCompletedForCycle(params.cycleId);
    await this.portfolioSnapshots.refreshCurrentSlotSnapshot(
      recipient,
      chainId,
      alreadyWithUser ? 0 : 1500,
    );

    return {
      tokenId: params.tokenId,
      tokenURI: params.tokenURI,
      vaultRef: params.vaultRef,
      txHash: deliverTxHash ?? '0x',
      chainId,
      custodyWallet,
      mintedTo: recipient,
      intendedRecipient: recipient,
      deliveryMode: 'custody',
      deliverTxHash,
      adoptedExisting: true,
      alreadyWithUser,
    };
  }

  /** Same cost-basis seed as admin deliver, for self-vault direct mints. */
  private async seedDirectMintCostBasis(
    walletAddress: string,
    tokenId: number,
    chainId: SupportedChainId,
  ): Promise<void> {
    try {
      const marks = await this.portfolioSnapshots.resolveMarkUsdByTokenIds(
        [tokenId],
        chainId,
      );
      const markUsd = marks.get(tokenId);
      if (markUsd != null && Number.isFinite(markUsd)) {
        await this.portfolioHoldings.seedVaultDeliveryCostBasis(
          walletAddress,
          tokenId,
          markUsd,
          new Date(),
          chainId,
        );
      } else {
        this.logger.warn(
          `Direct mint: no mark USD for token #${tokenId} — cost basis not seeded`,
        );
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      this.logger.warn(
        `Direct mint: cost basis seed failed for token #${tokenId}: ${msg}`,
      );
    }
  }
}
