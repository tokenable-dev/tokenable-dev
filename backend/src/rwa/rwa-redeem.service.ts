import { ForbiddenException, Injectable } from '@nestjs/common';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { ChainConfigService } from '../blockchain/chain-config.service';
import { assertKycApprovedForCustody } from '../kyc/utils/kyc-gate.util';
import { VaultService } from '../vault/vault.service';
import { RedeemRequestDto } from './dto/redeem-request.dto';

/**
 * Step 1 of "Redeem Request" (see VaultService for the rest of the pipeline):
 * the token owner asks the platform to redeem their NFT for the physical
 * asset. Ownership is verified here (against chain + account wallet link)
 * before the request is recorded — the actual burn is a separate admin
 * action (RwaTokenAdminService.burnTokenOnChain) once ops has coordinated
 * the physical vault release logistics.
 */
@Injectable()
export class RwaRedeemService {
  constructor(
    private readonly users: UserService,
    private readonly blockchain: BlockchainService,
    private readonly chainConfig: ChainConfigService,
    private readonly vault: VaultService,
  ) {}

  async requestRedemption(user: User, dto: RedeemRequestDto) {
    assertKycApprovedForCustody(user);

    const tokenId = Math.floor(Number(dto.tokenId));
    const onChainOwner = await this.blockchain.getRwaTokenOwner(tokenId);

    const wallets = await this.users.listWalletsForUser(user.id);
    const ownsViaLinkedWallet = wallets.some(
      (w) => w.walletAddress.trim().toLowerCase() === onChainOwner,
    );
    if (!ownsViaLinkedWallet) {
      throw new ForbiddenException(
        'The current on-chain owner of this token is not a wallet linked to your account',
      );
    }

    const contract = this.chainConfig.getRwaAddress(this.chainConfig.getDefaultChainId());
    return this.vault.requestRedemption({
      tokenContract: contract,
      tokenId: String(tokenId),
      requestingUserId: user.id,
      ownerWalletAddress: onChainOwner,
    });
  }
}
