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

  /**
   * Chain-sensitive writes (mint / upload / redeem / bulk-mint / P2P vault).
   * Never silently fall back to DEFAULT_CHAIN_ID — a missing header would
   * reserve a Sepolia vault cycle while the UI shows Polygon (or vice versa).
   */
  requireChainId(headerValue?: string): SupportedChainId {
    const raw = headerValue?.trim();
    if (!raw) {
      throw new BadRequestException(
        `Missing ${CHAIN_ID_HEADER} header — required for chain-scoped vault writes`,
      );
    }
    const n = Number(raw);
    if (!SUPPORTED_CHAIN_IDS.includes(n as SupportedChainId)) {
      throw new BadRequestException(
        `Unsupported chain id "${raw}" — expected one of ${SUPPORTED_CHAIN_IDS.join(', ')}`,
      );
    }
    const chainId = n as SupportedChainId;
    if (!this.isChainConfigured(chainId)) {
      throw new BadRequestException(
        `Chain ${chainId} is not configured (set CHAIN_${chainId}_RPC_URL and CHAIN_${chainId}_RWA_ADDRESS)`,
      );
    }
    return chainId;
  }

  /** True when RPC + RWA address env vars are set for the chain. */
  isChainConfigured(chainId: SupportedChainId): boolean {
    const rpc = this.config.get<string>(`CHAIN_${chainId}_RPC_URL`)?.trim();
    const rwa = this.config
      .get<string>(`CHAIN_${chainId}_RWA_ADDRESS`)
      ?.trim()
      .toLowerCase();
    return Boolean(rpc && rwa && ADDR.test(rwa));
  }

  /** Chains with RPC + RWA configured (cron / multi-chain capture). Always includes default if none. */
  listConfiguredChainIds(): SupportedChainId[] {
    const configured = SUPPORTED_CHAIN_IDS.filter((id) =>
      this.isChainConfigured(id),
    );
    if (configured.length > 0) return [...configured];
    return [this.getDefaultChainId()];
  }

  /** Map an RWA proxy address back to a supported chain id (or null). */
  resolveChainIdFromRwaAddress(
    tokenContract?: string | null,
  ): SupportedChainId | null {
    const addr = String(tokenContract ?? '')
      .trim()
      .toLowerCase();
    if (!ADDR.test(addr)) return null;
    for (const id of this.listConfiguredChainIds()) {
      try {
        if (this.getRwaAddress(id) === addr) return id;
      } catch {
        /* skip unconfigured */
      }
    }
    return null;
  }

  /** Lowercased RWA addresses for all configured chains (SQL IN filters). */
  listConfiguredRwaAddresses(): string[] {
    return this.listConfiguredChainIds().map((id) => this.getRwaAddress(id));
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
