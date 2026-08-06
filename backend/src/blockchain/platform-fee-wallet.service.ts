import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract, Wallet } from 'ethers';
import {
  ChainConfigService,
  type SupportedChainId,
} from './chain-config.service';

const ADDR = /^0x[a-fA-F0-9]{40}$/i;

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
] as const;

/**
 * Signs USDC transfers from PLATFORM_FEE_RECIPIENT (self-vault seller payouts).
 * Key: PLATFORM_FEE_PRIVATE_KEY — must match PLATFORM_FEE_RECIPIENT.
 */
@Injectable()
export class PlatformFeeWalletService {
  private readonly logger = new Logger(PlatformFeeWalletService.name);
  private readonly writeLocks = new Map<string, Promise<unknown>>();

  constructor(
    private readonly config: ConfigService,
    private readonly chainConfig: ChainConfigService,
  ) {}

  private withSignerLock<T>(
    chainId: number,
    privateKey: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    const key = `${chainId}:${new Wallet(privateKey).address.toLowerCase()}`;
    const prev = this.writeLocks.get(key) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    this.writeLocks.set(
      key,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  }

  private normalizePrivateKey(raw: string): string {
    const key = raw.trim();
    if (!key) {
      throw new InternalServerErrorException(
        'PLATFORM_FEE_PRIVATE_KEY is not configured',
      );
    }
    return key.startsWith('0x') ? key : `0x${key}`;
  }

  private feePrivateKey(): string {
    return this.normalizePrivateKey(
      this.config.get<string>('PLATFORM_FEE_PRIVATE_KEY') ?? '',
    );
  }

  /** Configured recipient address (lowercase), or null if unset/invalid. */
  getConfiguredRecipient(): string | null {
    const raw = (
      this.config.get<string>('PLATFORM_FEE_RECIPIENT') ?? ''
    )
      .trim()
      .toLowerCase();
    return ADDR.test(raw) ? raw : null;
  }

  isConfigured(): boolean {
    const key = this.config.get<string>('PLATFORM_FEE_PRIVATE_KEY')?.trim();
    return Boolean(key) && Boolean(this.getConfiguredRecipient());
  }

  async getSignerAddress(
    chainId = this.chainConfig.getDefaultChainId(),
  ): Promise<string> {
    const provider = this.chainConfig.createJsonRpcProvider(chainId);
    const wallet = new Wallet(this.feePrivateKey(), provider);
    return (await wallet.getAddress()).toLowerCase();
  }

  /**
   * Assert fee key ↔ PLATFORM_FEE_RECIPIENT, then ERC-20 transfer USDC micros.
   */
  async transferUsdc(params: {
    to: string;
    amountMicros: string;
    chainId: SupportedChainId;
  }): Promise<{ txHash: string; from: string }> {
    const to = params.to.trim().toLowerCase();
    if (!ADDR.test(to)) {
      throw new BadRequestException('Invalid payout recipient address');
    }
    if (
      !/^\d+$/.test(params.amountMicros) ||
      BigInt(params.amountMicros) <= BigInt(0)
    ) {
      throw new BadRequestException('Invalid USDC payout amount');
    }

    const expected = this.getConfiguredRecipient();
    if (!expected) {
      throw new InternalServerErrorException(
        'PLATFORM_FEE_RECIPIENT is not configured',
      );
    }

    const privateKey = this.feePrivateKey();
    const chainId = params.chainId;

    return this.withSignerLock(chainId, privateKey, async () => {
      const provider = this.chainConfig.createJsonRpcProvider(chainId);
      const wallet = new Wallet(privateKey, provider);
      const from = (await wallet.getAddress()).toLowerCase();
      if (from !== expected) {
        throw new InternalServerErrorException(
          `PLATFORM_FEE_PRIVATE_KEY address (${from}) does not match PLATFORM_FEE_RECIPIENT (${expected})`,
        );
      }

      const usdc = this.chainConfig.getUsdcAddress(chainId);
      const token = new Contract(usdc, ERC20_ABI, wallet);
      const amount = BigInt(params.amountMicros);
      const bal: bigint = await token.balanceOf(from);
      if (bal < amount) {
        throw new BadRequestException(
          `Platform fee wallet USDC balance too low (have ${bal}, need ${amount})`,
        );
      }

      this.logger.log(
        `Platform fee USDC transfer: ${amount} → ${to} on chain ${chainId}`,
      );
      const tx = await token.transfer(to, amount);
      this.logger.log(`Platform fee USDC tx submitted: ${tx.hash}`);
      await tx.wait();
      return { txHash: String(tx.hash), from };
    });
  }
}
