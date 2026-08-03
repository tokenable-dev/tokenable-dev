import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import {
  ChainConfigService,
  type SupportedChainId,
} from '../blockchain/chain-config.service';
import { assertKycApprovedForCustody } from '../kyc/utils/kyc-gate.util';
import { VaultService } from '../vault/vault.service';
import { RedeemRequestDto } from './dto/redeem-request.dto';

/** PSA Vault published shipping & handling (USD), covers up to 50 items. */
const PSA_SHIPPING_USD = {
  us: 5.99,
  ca: 24.99,
  intl: 31.99,
} as const;

/**
 * Default per-card PSA Vault withdrawal fee (USD). Prefer early-withdrawal
 * schedule for estimates when vault age is unknown — override via env.
 * @see https://www.psacard.com/info/psa-vault
 */
const DEFAULT_PSA_WITHDRAW_FEE_USD = 4.99;

export type RedeemEstimate = {
  currency: 'USD';
  country: 'us' | 'ca' | 'intl';
  cardCount: number;
  shippingUsd: number;
  withdrawFeePerCardUsd: number;
  withdrawFeeTotalUsd: number;
  totalUsd: number;
  source: 'psa_vault_published_schedule';
};

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
    private readonly config: ConfigService,
  ) {}

  /**
   * Estimate redeem cost from PSA Vault withdraw + shipping rates.
   * Payment collection remains Phase B — this powers the FE estimate UI.
   */
  estimateRedeemCost(
    country: 'us' | 'ca' | 'intl',
    cardCount = 1,
  ): RedeemEstimate {
    const count = Math.min(50, Math.max(1, Math.floor(cardCount)));
    const raw = this.config.get<string>('PSA_VAULT_WITHDRAW_FEE_USD');
    const parsed = raw != null && raw !== '' ? Number(raw) : NaN;
    const withdrawFeePerCardUsd = Number.isFinite(parsed)
      ? parsed
      : DEFAULT_PSA_WITHDRAW_FEE_USD;
    const shippingUsd = PSA_SHIPPING_USD[country];
    const withdrawFeeTotalUsd =
      Math.round(withdrawFeePerCardUsd * count * 100) / 100;
    const totalUsd =
      Math.round((shippingUsd + withdrawFeeTotalUsd) * 100) / 100;
    return {
      currency: 'USD',
      country,
      cardCount: count,
      shippingUsd,
      withdrawFeePerCardUsd,
      withdrawFeeTotalUsd,
      totalUsd,
      source: 'psa_vault_published_schedule',
    };
  }

  async requestRedemption(
    user: User,
    dto: RedeemRequestDto,
    chainId: SupportedChainId,
  ) {
    assertKycApprovedForCustody(user);

    const tokenId = Math.floor(Number(dto.tokenId));
    const onChainOwner = await this.blockchain.getRwaTokenOwner(tokenId, chainId);

    const wallets = await this.users.listWalletsForUser(user.id);
    const ownsViaLinkedWallet = wallets.some(
      (w) => w.walletAddress.trim().toLowerCase() === onChainOwner,
    );
    if (!ownsViaLinkedWallet) {
      throw new ForbiddenException(
        'The current on-chain owner of this token is not a wallet linked to your account',
      );
    }

    const contract = this.chainConfig.getRwaAddress(chainId);
    return this.vault.requestRedemption({
      tokenContract: contract,
      tokenId: String(tokenId),
      requestingUserId: user.id,
      ownerWalletAddress: onChainOwner,
      shipTo: dto.shipTo
        ? {
            name: dto.shipTo.name,
            line1: dto.shipTo.line1,
            line2: dto.shipTo.line2,
            city: dto.shipTo.city,
            region: dto.shipTo.region,
            postal: dto.shipTo.postal,
            country: dto.shipTo.country,
            phone: dto.shipTo.phone,
          }
        : null,
    });
  }

  listMyRedemptions(user: User, tokenIdsCsv?: string) {
    const tokenIds = tokenIdsCsv
      ? tokenIdsCsv
          .split(',')
          .map((s) => s.trim())
          .filter((s) => /^\d+$/.test(s))
      : undefined;
    return this.vault.listOpenRedemptionsForUser(user.id, tokenIds);
  }
}
