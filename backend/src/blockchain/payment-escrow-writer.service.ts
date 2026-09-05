import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, Wallet, id as keccakId } from 'ethers';
import { TOKENABLE_PAYMENT_ESCROW_ABI } from './abis/tokenable-payment-escrow.abi';
import { ChainConfigService } from './chain-config.service';

const ADDR = /^0x[a-fA-F0-9]{40}$/;

/**
 * Arbiter-signed writes against TokenablePaymentEscrow.
 * Buyer deposit / confirm / settleAfterTimeout are user-wallet txs (frontend).
 */
@Injectable()
export class PaymentEscrowWriterService {
  private readonly logger = new Logger(PaymentEscrowWriterService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly chainConfig: ChainConfigService,
  ) {}

  private normalizePrivateKey(raw: string, label: string): string {
    const key = raw.trim();
    if (!key) {
      throw new InternalServerErrorException(`${label} is not configured`);
    }
    return key.startsWith('0x') ? key : `0x${key}`;
  }

  private arbiterPrivateKey(): string {
    const key =
      this.config.get<string>('PAYMENT_ESCROW_ARBITER_PRIVATE_KEY')?.trim() ||
      this.config.get<string>('RWA_OWNER_PRIVATE_KEY')?.trim() ||
      this.config.get<string>('DEPLOYER_PRIVATE_KEY')?.trim() ||
      '';
    return this.normalizePrivateKey(key, 'PAYMENT_ESCROW_ARBITER_PRIVATE_KEY');
  }

  private signedContract(chainId = this.chainConfig.getDefaultChainId()): Contract {
    const provider = this.chainConfig.createJsonRpcProvider(chainId);
    const wallet = new Wallet(this.arbiterPrivateKey(), provider);
    const address = this.chainConfig.getPaymentEscrowAddress(chainId);
    return new Contract(address, TOKENABLE_PAYMENT_ESCROW_ABI, wallet);
  }

  private readContract(chainId = this.chainConfig.getDefaultChainId()): Contract {
    const provider = this.chainConfig.createJsonRpcProvider(chainId);
    const address = this.chainConfig.getPaymentEscrowAddress(chainId);
    return new Contract(address, TOKENABLE_PAYMENT_ESCROW_ABI, provider);
  }

  /**
   * Deterministic bytes32 escrow key.
   * Prefer listing UUID so only one on-chain escrow slot exists per listing
   * (prevents two buyers locking USDC under different order ids).
   */
  static escrowOrderIdFromUuid(id: string): string {
    return keccakId(`tokenable:p2p:${id.trim().toLowerCase()}`);
  }

  /** Alias — escrow slots are keyed by listing id. */
  static escrowOrderIdForListing(listingId: string): string {
    return PaymentEscrowWriterService.escrowOrderIdFromUuid(listingId);
  }

  async getEscrowAddress(
    chainId = this.chainConfig.getDefaultChainId(),
  ): Promise<string> {
    return this.chainConfig.getPaymentEscrowAddress(chainId);
  }

  async getEscrowState(
    escrowOrderId: string,
    chainId = this.chainConfig.getDefaultChainId(),
  ): Promise<{
    buyer: string;
    seller: string;
    amount: string;
    autoReleaseAt: number;
    state: number;
  }> {
    if (!escrowOrderId.startsWith('0x') || escrowOrderId.length !== 66) {
      throw new BadRequestException('Invalid escrowOrderId');
    }
    const contract = this.readContract(chainId);
    const e = await contract.escrows(escrowOrderId);
    return {
      buyer: String(e.buyer).toLowerCase(),
      seller: String(e.seller).toLowerCase(),
      amount: e.amount.toString(),
      autoReleaseAt: Number(e.autoReleaseAt),
      state: Number(e.state),
    };
  }

  async refund(
    escrowOrderId: string,
    chainId = this.chainConfig.getDefaultChainId(),
  ): Promise<{ txHash: string }> {
    if (!escrowOrderId.startsWith('0x') || escrowOrderId.length !== 66) {
      throw new BadRequestException('Invalid escrowOrderId');
    }
    const contract = this.signedContract(chainId);
    const tx = await contract.refund(escrowOrderId);
    this.logger.log(`escrow refund tx submitted: ${tx.hash}`);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new InternalServerErrorException('Escrow refund tx failed');
    }
    return { txHash: tx.hash as string };
  }

  async settleAfterTimeout(
    escrowOrderId: string,
    chainId = this.chainConfig.getDefaultChainId(),
  ): Promise<{ txHash: string }> {
    if (!escrowOrderId.startsWith('0x') || escrowOrderId.length !== 66) {
      throw new BadRequestException('Invalid escrowOrderId');
    }
    const contract = this.signedContract(chainId);
    const tx = await contract.settleAfterTimeout(escrowOrderId);
    this.logger.log(`escrow settleAfterTimeout tx submitted: ${tx.hash}`);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) {
      throw new InternalServerErrorException('Escrow settle tx failed');
    }
    return { txHash: tx.hash as string };
  }

  async getArbiterAddress(
    chainId = this.chainConfig.getDefaultChainId(),
  ): Promise<string> {
    const provider = this.chainConfig.createJsonRpcProvider(chainId);
    const wallet = new Wallet(this.arbiterPrivateKey(), provider);
    const addr = await wallet.getAddress();
    if (!ADDR.test(addr)) {
      throw new InternalServerErrorException('Invalid arbiter address');
    }
    return addr.toLowerCase();
  }
}
