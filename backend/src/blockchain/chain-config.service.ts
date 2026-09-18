import {
  Injectable,
  BadRequestException,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AbstractProvider,
  FallbackProvider,
  JsonRpcProvider,
} from 'ethers';

export const SUPPORTED_CHAIN_IDS = [11155111, 1, 137] as const;
export type SupportedChainId = (typeof SUPPORTED_CHAIN_IDS)[number];

export const CHAIN_ID_HEADER = 'x-tokenable-chain-id';

const ADDR = /^0x[a-fA-F0-9]{40}$/i;

/** Public JSON-RPC fallbacks when primary (e.g. Alchemy) returns 429 / is down. */
const PUBLIC_RPC_FALLBACKS: Record<SupportedChainId, readonly string[]> = {
  11155111: [
    'https://ethereum-sepolia-rpc.publicnode.com',
    'https://sepolia.drpc.org',
  ],
  1: ['https://ethereum.publicnode.com', 'https://cloudflare-eth.com'],
  137: ['https://polygon-bor.publicnode.com', 'https://polygon-rpc.com'],
};

function isHttpRpcUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

@Injectable()
export class ChainConfigService implements OnModuleDestroy {
  private readonly providers = new Map<SupportedChainId, AbstractProvider>();

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
   * Chain-sensitive writes (mint / upload / redeem / bulk-mint).
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

  /**
   * Ordered RPC URLs: env primary first, then public fallbacks (deduped).
   * Used so Alchemy CU exhaustion can fail over without editing env.
   */
  getRpcUrls(chainId: SupportedChainId): string[] {
    const primary = this.getRpcUrl(chainId);
    const seen = new Set<string>();
    const out: string[] = [];
    for (const url of [primary, ...PUBLIC_RPC_FALLBACKS[chainId]]) {
      const u = url.trim();
      if (!u || !isHttpRpcUrl(u) || seen.has(u)) continue;
      seen.add(u);
      out.push(u);
    }
    return out;
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

  /**
   * Cached provider. Primary = `CHAIN_*_RPC_URL` (Alchemy). Extra URLs use
   * ethers FallbackProvider so 429 / dead primary fails over to public RPCs.
   * `staticNetwork: true` avoids eth_chainId spam on a broken primary.
   * `quorum: 1` — this is failover, not multi-RPC consensus. Default quorum
   * (ceil(n/2)) throws "quorum not met" when only one RPC returns a valid
   * result (common under Alchemy 429 / flaky public nodes).
   */
  createJsonRpcProvider(chainId?: SupportedChainId): AbstractProvider {
    const id = chainId ?? this.getDefaultChainId();
    const existing = this.providers.get(id);
    if (existing) return existing;

    const urls = this.getRpcUrls(id);
    const provider =
      urls.length === 1
        ? new JsonRpcProvider(urls[0], id, { staticNetwork: true })
        : new FallbackProvider(
            urls.map((url, index) => ({
              provider: new JsonRpcProvider(url, id, { staticNetwork: true }),
              // Lower priority = preferred (Alchemy at index 0).
              priority: index + 1,
              stallTimeout: 2_500,
              weight: 1,
            })),
            id,
            { quorum: 1 },
          );

    this.providers.set(id, provider);
    return provider;
  }

  onModuleDestroy(): void {
    for (const provider of this.providers.values()) {
      void provider.destroy();
    }
    this.providers.clear();
  }
}
