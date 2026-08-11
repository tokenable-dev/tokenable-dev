import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { Interface, id as ethersId, getAddress } from 'ethers';
import { randomUUID } from 'crypto';
import { User } from '../user/entities/user.entity';
import { UserService } from '../user/user.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import {
  ChainConfigService,
  type SupportedChainId,
} from '../blockchain/chain-config.service';
import { PlatformFeeWalletService } from '../blockchain/platform-fee-wallet.service';
import { RwaChainWriterService } from '../blockchain/rwa-chain-writer.service';
import { KycService } from '../kyc/kyc.service';
import { VaultService } from '../vault/vault.service';
import {
  RedeemBatchCustodyDto,
  RedeemBatchRequestDto,
  RedeemRequestDto,
} from './dto/redeem-request.dto';
import type { RedeemCountry, RedeemEstimate } from './redeem-fee.types';
import { RedeemShippingFeeCalculator } from './redeem-shipping-fee.calculator';
import { resolveShipToDestinationIso2 } from './shipping/destination-country';

const ERC20_TRANSFER_IFACE = new Interface([
  'event Transfer(address indexed from, address indexed to, uint256 value)',
]);
const ERC721_TRANSFER_IFACE = new Interface([
  'event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)',
]);
const ERC20_TRANSFER_TOPIC = ethersId('Transfer(address,address,uint256)');
/** v1: Sepolia only for redeem custody intake (multi-chain later). */
const REDEEM_V1_CHAIN_ID = 11155111 as SupportedChainId;

/**
 * Redeem orchestration: KYC → multi-shipment fee estimate → USDC verify → redemptions.
 * Fee math lives in RedeemShippingFeeCalculator (PSA schedule vs Partner Rate/stub).
 */
@Injectable()
export class RwaRedeemService {
  constructor(
    private readonly users: UserService,
    private readonly blockchain: BlockchainService,
    private readonly chainConfig: ChainConfigService,
    private readonly vault: VaultService,
    private readonly platformFee: PlatformFeeWalletService,
    private readonly feeCalculator: RedeemShippingFeeCalculator,
    private readonly chainWriter: RwaChainWriterService,
    private readonly kyc: KycService,
  ) {}

  async estimateRedeemCost(params: {
    country: RedeemCountry;
    cardCount?: number;
    tokenIds?: number[];
    chainId?: SupportedChainId;
    shipTo?: {
      name: string;
      line1: string;
      line2?: string | null;
      city: string;
      region?: string | null;
      postal: string;
      phone: string;
      countryCode?: string | null;
    };
  }): Promise<RedeemEstimate> {
    return this.feeCalculator.estimate(params);
  }

  /** Legacy single-card path without payment — blocked. Use redeem-batch. */
  async requestRedemption(
    _user: User,
    _dto: RedeemRequestDto,
    _chainId: SupportedChainId,
  ) {
    throw new BadRequestException(
      'Use POST /rwa/redeem-batch with paymentTxHash (USDC to platform fee recipient)',
    );
  }

  async requestRedemptionBatch(
    user: User,
    dto: RedeemBatchRequestDto,
    chainId: SupportedChainId,
  ) {
    await this.kyc.assertApprovedForCustody(user);
    if (chainId !== REDEEM_V1_CHAIN_ID) {
      throw new BadRequestException(
        'Redeem payment + custody intake is Sepolia-only in v1',
      );
    }

    const tokenIds = [
      ...new Set(dto.tokenIds.map((n) => Math.floor(Number(n))).filter((n) => n > 0)),
    ];
    if (tokenIds.length === 0) {
      throw new BadRequestException('tokenIds required');
    }

    const shipTo = dto.shipTo;
    if (!shipTo) throw new BadRequestException('shipTo required');

    const destinationCountryIso = resolveShipToDestinationIso2({
      country: shipTo.country,
      countryCode: shipTo.countryCode,
    });

    const estimate = await this.feeCalculator.estimate({
      country: shipTo.country,
      tokenIds,
      chainId,
      shipTo: {
        name: shipTo.name,
        line1: shipTo.line1,
        line2: shipTo.line2,
        city: shipTo.city,
        region: shipTo.region,
        postal: shipTo.postal,
        phone: shipTo.phone,
        countryCode: shipTo.countryCode ?? destinationCountryIso,
      },
    });
    if (estimate.cardCount !== tokenIds.length) {
      throw new BadRequestException('Could not resolve fees for all tokens');
    }

    const wallets = await this.users.listWalletsForUser(user.id);
    if (wallets.length === 0) {
      throw new BadRequestException('Link a wallet before redeeming');
    }

    const paymentTxHash = dto.paymentTxHash.trim().toLowerCase();
    if (await this.vault.hasPaymentClaim(paymentTxHash)) {
      throw new ConflictException(
        'This payment transaction was already used for a redeem batch',
      );
    }

    const payerCandidates = wallets.map((w) =>
      w.walletAddress.trim().toLowerCase(),
    );
    const paidMicros = await this.verifyUsdcPaymentToFeeRecipient({
      txHash: paymentTxHash,
      fromAddresses: payerCandidates,
      expectedMicros: BigInt(estimate.totalUsdcMicros),
      chainId,
    });

    const contract = this.chainConfig.getRwaAddress(chainId);
    const batchId = randomUUID();
    const paidAt = new Date();
    const paymentReceivedUsdcMicros = paidMicros.toString();

    const prepared: Array<{
      tokenContract: string;
      tokenId: string;
      requestingUserId: string;
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
    }> = [];

    for (const tokenId of tokenIds) {
      const line = estimate.cards.find((c) => c.tokenId === tokenId);
      if (!line) {
        throw new BadRequestException(`Missing fee line for token #${tokenId}`);
      }

      const onChainOwner = await this.blockchain.getRwaTokenOwner(
        tokenId,
        chainId,
      );
      const ownsViaLinkedWallet = wallets.some(
        (w) => w.walletAddress.trim().toLowerCase() === onChainOwner,
      );
      if (!ownsViaLinkedWallet) {
        throw new ForbiddenException(
          `Token #${tokenId}: on-chain owner is not a wallet linked to your account`,
        );
      }

      prepared.push({
        tokenContract: contract,
        tokenId: String(tokenId),
        requestingUserId: user.id,
        ownerWalletAddress: onChainOwner,
        shipTo: {
          name: shipTo.name,
          line1: shipTo.line1,
          line2: shipTo.line2,
          city: shipTo.city,
          region: shipTo.region,
          postal: shipTo.postal,
          country: destinationCountryIso,
          phone: shipTo.phone,
        },
        feeRetrievalUsd: line.retrievalUsd,
        feeEarlyWithdrawalUsd: line.earlyWithdrawalUsd,
        feeShippingUsd: line.shippingUsd,
        feeTotalUsd: line.totalUsd,
        vaultedAt: line.vaultedAt ? new Date(line.vaultedAt) : null,
        earlyWithdrawal: line.earlyWithdrawal,
      });
    }

    const results = await this.vault.createPaidRedemptionBatch({
      paymentTxHash,
      paymentBatchId: batchId,
      paymentReceivedUsdcMicros,
      paidAt,
      chainId,
      items: prepared,
    });

    const custodyWalletAddress =
      await this.chainWriter.getCustodyWalletAddress(chainId);

    return {
      paymentBatchId: batchId,
      paymentTxHash,
      paymentReceivedUsdcMicros,
      custodyWalletAddress,
      chainId,
      nextStep: 'transfer_nfts_to_custody' as const,
      estimate,
      redemptions: results.map(({ redemption: r, tokenId }) => ({
        id: r.id,
        status: r.status,
        vaultCycleId: r.vaultCycleId,
        tokenId: Number(tokenId),
      })),
    };
  }

  /**
   * After user-signed ERC-721 transfers into RWA custody: verify each tx and
   * mark redemptions `in_custody`. Does not advance until EVERY NFT in the
   * batch is in custody (call with the full set of outstanding transfers).
   */
  async confirmCustodyTransfers(
    user: User,
    batchId: string,
    dto: RedeemBatchCustodyDto,
    chainId: SupportedChainId,
  ) {
    await this.kyc.assertApprovedForCustody(user);
    if (chainId !== REDEEM_V1_CHAIN_ID) {
      throw new BadRequestException(
        'Redeem custody intake is Sepolia-only in v1',
      );
    }

    const rows = await this.vault.findRedemptionsByBatchId(batchId);
    if (rows.length === 0) {
      throw new BadRequestException('Unknown paymentBatchId');
    }
    if (rows.some((r) => r.requestedByUserId !== user.id)) {
      throw new ForbiddenException('Batch does not belong to this user');
    }
    if (rows.some((r) => r.refundStatus !== 'none' || r.status === 'refunded')) {
      throw new BadRequestException('This redeem batch was refunded');
    }

    const custodyWallet = (
      await this.chainWriter.getCustodyWalletAddress(chainId)
    ).toLowerCase();
    const rwa = this.chainConfig.getRwaAddress(chainId).toLowerCase();

    const pending = rows.filter((r) => r.status === 'ownership_verified');
    const already = rows.filter((r) => r.status === 'in_custody');

    if (pending.length === 0) {
      const allInCustody = rows.every((r) => r.status === 'in_custody');
      return {
        paymentBatchId: batchId,
        allInCustody,
        custodyWalletAddress: custodyWallet,
        redemptions: rows.map((r) => ({
          id: r.id,
          status: r.status,
          custodyTxHash: r.custodyTxHash,
        })),
      };
    }

    const transferByToken = new Map(
      dto.transfers.map((t) => [
        Math.floor(Number(t.tokenId)),
        t.txHash.trim().toLowerCase(),
      ]),
    );

    for (const row of pending) {
      const tokenIdStr = await this.vault.getTokenIdForRedemption(row.id);
      if (!tokenIdStr) {
        throw new BadRequestException(
          `Could not resolve tokenId for redemption ${row.id}`,
        );
      }
      const tokenId = Number(tokenIdStr);
      const onChainOwner = (
        await this.blockchain.getRwaTokenOwner(tokenId, chainId)
      ).toLowerCase();

      /* Already moved on-chain (user cancelled before POST .../custody). */
      if (onChainOwner === custodyWallet) {
        const txHash =
          transferByToken.get(tokenId) ??
          row.custodyTxHash ??
          `0x${'0'.repeat(64)}`;
        await this.vault.markCustodyReceived({
          redemptionId: row.id,
          custodyTxHash: txHash,
        });
        continue;
      }

      const expectedFrom = row.ownerWalletAddress.trim().toLowerCase();
      if (onChainOwner !== expectedFrom) {
        throw new BadRequestException(
          `Token #${tokenId} is owned by ${onChainOwner}, not your redeem wallet (${expectedFrom}) or custody — cannot confirm transfers`,
        );
      }

      const txHash = transferByToken.get(tokenId);
      if (!txHash) {
        throw new BadRequestException(
          `Missing custody transfer tx for token #${tokenId} — all NFTs must be transferred before Preparing`,
        );
      }
      await this.verifyNftTransferredToCustody({
        txHash,
        tokenId,
        fromAddress: row.ownerWalletAddress,
        toAddress: custodyWallet,
        rwaContract: rwa,
        chainId,
      });
      await this.vault.markCustodyReceived({
        redemptionId: row.id,
        custodyTxHash: txHash,
      });
    }

    const updated = await this.vault.findRedemptionsByBatchId(batchId);
    const allInCustody = updated.every((r) => r.status === 'in_custody');
    if (!allInCustody) {
      throw new BadRequestException(
        'Not all NFTs in this batch are in custody yet',
      );
    }

    return {
      paymentBatchId: batchId,
      allInCustody: true,
      custodyWalletAddress: custodyWallet,
      alreadyInCustodyCount: already.length,
      redemptions: updated.map((r) => ({
        id: r.id,
        status: r.status,
        custodyTxHash: r.custodyTxHash,
      })),
    };
  }

  private async verifyNftTransferredToCustody(params: {
    txHash: string;
    tokenId: number;
    fromAddress: string;
    toAddress: string;
    rwaContract: string;
    chainId: SupportedChainId;
  }): Promise<void> {
    const provider = this.chainConfig.createJsonRpcProvider(params.chainId);
    const receipt = await provider.getTransactionReceipt(params.txHash);
    if (!receipt || receipt.status !== 1) {
      throw new BadRequestException(
        `NFT transfer tx not found or failed: ${params.txHash}`,
      );
    }

    const fromWant = params.fromAddress.toLowerCase();
    const toWant = params.toAddress.toLowerCase();
    let matched = false;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== params.rwaContract) continue;
      try {
        const parsed = ERC721_TRANSFER_IFACE.parseLog({
          topics: [...log.topics],
          data: log.data,
        });
        if (!parsed || parsed.name !== 'Transfer') continue;
        const from = String(parsed.args.from).toLowerCase();
        const to = String(parsed.args.to).toLowerCase();
        const tid = Number(parsed.args.tokenId);
        if (tid === params.tokenId && from === fromWant && to === toWant) {
          matched = true;
          break;
        }
      } catch {
        /* ignore */
      }
    }
    if (!matched) {
      throw new BadRequestException(
        `Tx ${params.txHash} does not transfer token #${params.tokenId} from ${fromWant} to custody ${toWant}`,
      );
    }

    const owner = await this.blockchain.getRwaTokenOwner(
      params.tokenId,
      params.chainId,
    );
    if (owner !== toWant) {
      throw new BadRequestException(
        `After transfer, token #${params.tokenId} owner is ${owner}, expected custody ${toWant}`,
      );
    }
  }

  private async verifyUsdcPaymentToFeeRecipient(params: {
    txHash: string;
    fromAddresses: string[];
    expectedMicros: bigint;
    chainId: SupportedChainId;
  }): Promise<bigint> {
    const payTo = this.platformFee.getConfiguredRecipient();
    if (!payTo) {
      throw new InternalServerErrorException(
        'PLATFORM_FEE_RECIPIENT is not configured',
      );
    }
    const fromSet = new Set(
      params.fromAddresses.map((a) => a.toLowerCase()).filter(Boolean),
    );
    if (fromSet.size === 0) {
      throw new BadRequestException('No payer wallet linked');
    }

    const provider = this.chainConfig.createJsonRpcProvider(params.chainId);
    const receipt = await provider.getTransactionReceipt(params.txHash);
    if (!receipt || receipt.status !== 1) {
      throw new BadRequestException(
        'Payment transaction not found or failed on-chain',
      );
    }

    const usdc = this.chainConfig.getUsdcAddress(params.chainId).toLowerCase();
    let paid = BigInt(0);
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== usdc) continue;
      if (log.topics[0]?.toLowerCase() !== ERC20_TRANSFER_TOPIC.toLowerCase()) {
        continue;
      }
      try {
        const parsed = ERC20_TRANSFER_IFACE.parseLog({
          topics: [...log.topics],
          data: log.data,
        });
        if (!parsed || parsed.name !== 'Transfer') continue;
        const from = String(parsed.args.from).toLowerCase();
        const to = String(parsed.args.to).toLowerCase();
        const value = BigInt(parsed.args.value);
        if (to === payTo && fromSet.has(from)) {
          paid += value;
        }
      } catch {
        /* ignore non-transfer */
      }
    }

    if (paid < params.expectedMicros) {
      throw new BadRequestException(
        `USDC payment insufficient: got ${paid} micros, need ${params.expectedMicros} to ${getAddress(payTo)}`,
      );
    }
    return paid;
  }

  async getCustodyWallet(chainId: SupportedChainId) {
    const custodyWalletAddress =
      await this.chainWriter.getCustodyWalletAddress(chainId);
    return { custodyWalletAddress, chainId };
  }

  /**
   * User confirms physical receipt for a paid batch → status `completed`.
   * Requires every card in the batch to have a tracking number (all vaults shipped).
   */
  async confirmReceipt(user: User, batchId: string) {
    const rows = await this.vault.findRedemptionsByBatchId(batchId);
    if (rows.length === 0) {
      throw new BadRequestException('Unknown paymentBatchId');
    }
    if (rows.some((r) => r.requestedByUserId !== user.id)) {
      throw new ForbiddenException('Batch does not belong to this user');
    }
    if (rows.some((r) => r.refundStatus !== 'none' || r.status === 'refunded')) {
      throw new BadRequestException('This redeem batch was refunded');
    }

    if (rows.every((r) => r.status === 'completed')) {
      return {
        paymentBatchId: batchId,
        status: 'completed' as const,
        alreadyCompleted: true,
        redemptions: rows.map((r) => ({
          id: r.id,
          status: r.status,
          vaultReleasedAt: r.vaultReleasedAt,
        })),
      };
    }

    const eligibleStatuses = new Set([
      'in_custody',
      'burned',
      'vault_release_pending',
      'completed',
    ]);
    if (rows.some((r) => !eligibleStatuses.has(r.status))) {
      throw new BadRequestException(
        'All cards must be in custody (or further) before confirming receipt',
      );
    }
    if (rows.some((r) => !r.trackingNumber?.trim())) {
      throw new BadRequestException(
        'Every vault shipment needs a tracking number before you can confirm receipt',
      );
    }

    const saved = await this.vault.markUserReceiptConfirmed(rows);
    return {
      paymentBatchId: batchId,
      status: 'completed' as const,
      alreadyCompleted: false,
      redemptions: saved.map((r) => ({
        id: r.id,
        status: r.status,
        vaultReleasedAt: r.vaultReleasedAt,
      })),
    };
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
