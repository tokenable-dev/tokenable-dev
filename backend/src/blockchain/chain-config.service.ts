import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JsonRpcProvider } from 'ethers';

export const SUPPORTED_CHAIN_IDS = [11155111, 1, 137] as const;
export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

export const CHAIN_ID_HEADER = 'x-tokenable-chain-id';

const ADDR = /^0x[a-fA-F0-9]{40}$/i;

@Injectable()
export class ChainConfigService {
  constructor(private readonly config: ConfigService) {}

  getDefaultChainId(): SupportedChainId {
    const raw = this.config.get<string>('DEFAULT_CHAIN_ID')?.trim();
    const n = Number(raw);
    if (SUPPORTED_CHAIN_IDS.includes(n as SupportedChainId)) {
      return n as SupportedChainId;
    }
    return 11155111;
  }

  resolveChainId(headerValue?: string): SupportedChainId {
    const n = Number(headerValue?.trim());
    if (SUPPORTED_CHAIN_IDS.includes(n as SupportedChainId)) {
      return n as SupportedChainId;
    }
    return this.getDefaultChainId();
  }

  getRpcUrl(chainId: SupportedChainId): string {
    const fromMap = this.config.get<string>(`CHAIN_${chainId}_RPC_URL`)?.trim();
    if (fromMap) return fromMap;
    throw new BadRequestException(
      `RPC not configured for chain ${chainId} — set CHAIN_${chainId}_RPC_URL`,
    );
  }

  getRwaAddress(chainId: SupportedChainId): string {
    const fromMap = this.config
      .get<string>(`CHAIN_${chainId}_RWA_ADDRESS`)
      ?.trim()
      .toLowerCase();
    if (fromMap && ADDR.test(fromMap)) return fromMap;
    throw new BadRequestException(
      `RWA contract not configured for chain ${chainId}`,
    );
  }

  getUsdcAddress(chainId: SupportedChainId): string {
    const fromMap = this.config
      .get<string>(`CHAIN_${chainId}_USDC_ADDRESS`)
      ?.trim()
      .toLowerCase();
    if (fromMap && ADDR.test(fromMap)) return fromMap;
    throw new BadRequestException(
      `USDC contract not configured for chain ${chainId}`,
    );
  }

  /** TokenablePaymentEscrow — optional until deployed for the chain. */
  getPaymentEscrowAddress(chainId: SupportedChainId): string {
    const fromMap = this.config
      .get<string>(`CHAIN_${chainId}_PAYMENT_ESCROW_ADDRESS`)
      ?.trim()
      .toLowerCase();
    if (fromMap && ADDR.test(fromMap)) return fromMap;
    throw new BadRequestException(
      `Payment escrow not configured for chain ${chainId} — set CHAIN_${chainId}_PAYMENT_ESCROW_ADDRESS`,
    );
  }

  /**
   * JsonRpcProvider with an explicit chain id — skips eth_chainId polling on boot.
   * Without this, ethers logs "failed to detect network" and retries every 1s when
   * the RPC is slow, blocked, or not enabled on the provider dashboard.
   */
  createJsonRpcProvider(chainId?: SupportedChainId): JsonRpcProvider {
    const id = chainId ?? this.getDefaultChainId();
    const rpcUrl = this.getRpcUrl(id);
    return new JsonRpcProvider(rpcUrl, id);
  }
}
