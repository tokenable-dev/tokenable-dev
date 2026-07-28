import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { RwaChainWriterService } from '../blockchain/rwa-chain-writer.service';
import {
  ChainConfigService,
  type SupportedChainId,
} from '../blockchain/chain-config.service';
import { assertKycApprovedForCustody } from '../kyc/utils/kyc-gate.util';
import { VaultService } from '../vault/vault.service';
import { VaultSubmissionService } from '../vault/vault-submission.service';
import { MintRwaDto } from './dto/mint-rwa.dto';

export type MintRwaResult = {
  tokenId: number;
  tokenURI: string;
  vaultRef: string;
  txHash: string;
  chainId: number;
  custodyWallet: string;
  intendedRecipient: string;
};

/**
 * Orchestrates the "Vault Deposit" pipeline end to end:
 *   verify wallet link -> reserve vault cycle -> mint on-chain -> record result.
 */
@Injectable()
export class RwaMintService {
  constructor(
    private readonly chainWriter: RwaChainWriterService,
    private readonly chainConfig: ChainConfigService,
    private readonly users: UserService,
    private readonly vault: VaultService,
    private readonly vaultSubmissions: VaultSubmissionService,
  ) {}

  async mintForUser(
    user: User,
    dto: MintRwaDto,
    chainId: SupportedChainId,
  ): Promise<MintRwaResult> {
    assertKycApprovedForCustody(user);

    const recipient = dto.recipientAddress.trim().toLowerCase();

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
      depositedByUserId: user.id,
    });

    await this.vaultSubmissions.attachCycleForCert({
      userId: user.id,
      certNumber,
      cycleId: cycle.id,
    });

    const custodyRecipient = await this.chainWriter.getCustodyWalletAddress(chainId);
    let tokenId: number;
    let txHash: string;
    try {
      // Mint to platform custody first — ops delivers to `recipient` via admin UI.
      ({ tokenId, txHash } = await this.chainWriter.mintTo(
        custodyRecipient,
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

    return {
      tokenId,
      tokenURI,
      vaultRef,
      txHash,
      chainId,
      custodyWallet: custodyRecipient,
      intendedRecipient: recipient,
    };
  }
}
