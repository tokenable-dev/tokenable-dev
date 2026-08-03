import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { RwaChainWriterService } from '../blockchain/rwa-chain-writer.service';
import {
  ChainConfigService,
  type SupportedChainId,
} from '../blockchain/chain-config.service';
import { assertKycApprovedForCustody } from '../kyc/utils/kyc-gate.util';
import { PortfolioDailySnapshotService } from '../marketplace/portfolio/portfolio-daily-snapshot.service';
import { PortfolioHoldingService } from '../marketplace/portfolio/portfolio-holding.service';
import { VaultService } from '../vault/vault.service';
import { VaultSubmissionService } from '../vault/vault-submission.service';
import { MintRwaDto, type MintDeliveryMode } from './dto/mint-rwa.dto';

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
    private readonly chainConfig: ChainConfigService,
    private readonly users: UserService,
    private readonly vault: VaultService,
    private readonly vaultSubmissions: VaultSubmissionService,
    private readonly portfolioHoldings: PortfolioHoldingService,
    private readonly portfolioSnapshots: PortfolioDailySnapshotService,
  ) {}

  async mintForUser(
    user: User,
    dto: MintRwaDto,
    chainId: SupportedChainId,
  ): Promise<MintRwaResult> {
    assertKycApprovedForCustody(user);

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
    await this.vault.recordMintResult({
      cycleId: cycle.id,
      tokenContract: contract,
      tokenId: String(tokenId),
      tokenURI,
      txHash,
      certNumber,
    });
    await this.vaultSubmissions.markItemCompletedForCycle(cycle.id);

    if (deliveryMode === 'direct') {
      await this.seedDirectMintCostBasis(recipient, tokenId, chainId);
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
