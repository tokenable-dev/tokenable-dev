import { createHash } from 'crypto';
import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import {
  TTL_CACHE_PROVIDER,
  type TtlCacheProvider,
} from '../../common/cache/ttl-cache.interface';
import type { PortfolioAssetsPageResponse } from './portfolio-assets-page.service';

export type CachedPortfolioAssetsPagePayload = Omit<
  PortfolioAssetsPageResponse,
  'holdings' | 'ownedTokenIds'
>;

const MEMORY_NS = 'portfolio:assets-page:v4';
const REDIS_KEY_PREFIX = 'portfolio:assets-page:v4:';

const REDIS_CONNECT_TIMEOUT_MS = 2_000;
const REDIS_COMMAND_TIMEOUT_MS = 1_000;
const REDIS_MAX_RECONNECT_ATTEMPTS = 5;

function parseEnvMs(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (!raw) return defaultValue;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : defaultValue;
}

function parseEnvBool(key: string, defaultValue: boolean): boolean {
  const raw = process.env[key]?.trim().toLowerCase();
  if (!raw) return defaultValue;
  if (raw === '0' || raw === 'false' || raw === 'no') return false;
  if (raw === '1' || raw === 'true' || raw === 'yes') return true;
  return defaultValue;
}

/** L1 memory + optional Redis L2 for portfolio assets-page payloads (holdings excluded). */
@Injectable()
export class PortfolioAssetsPageCacheService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PortfolioAssetsPageCacheService.name);
  private client: Redis | null = null;
  private connected = false;
  private lastErrorLogAtMs = 0;

  constructor(
    private readonly config: ConfigService,
    @Inject(TTL_CACHE_PROVIDER) private readonly memory: TtlCacheProvider,
  ) {}

  isEnabled(): boolean {
    return parseEnvBool('PORTFOLIO_ASSETS_PAGE_CACHE_ENABLED', true);
  }

  ttlMs(): number {
    return parseEnvMs('PORTFOLIO_ASSETS_PAGE_CACHE_TTL_MS', 90_000);
  }

  redisEnabled(): boolean {
    return Boolean(this.config.get<string>('REDIS_URL')?.trim());
  }

  isRedisConnected(): boolean {
    return this.redisEnabled() && this.connected;
  }

  buildKey(
    chainId: number,
    wallet: string,
    tokenIds: number[],
  ): string {
    const sorted = [...tokenIds].sort((a, b) => a - b).join(',');
    const sig = createHash('sha256').update(sorted).digest('hex').slice(0, 20);
    return `${chainId}:${wallet}:${sig}`;
  }

  redisKey(key: string): string {
    return `${REDIS_KEY_PREFIX}${key}`;
  }

  onModuleInit(): void {
    const url = this.config.get<string>('REDIS_URL')?.trim();
    if (!url) return;

    this.client = new Redis(url, {
      connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
      commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
      maxRetriesPerRequest: 1,
      enableReadyCheck: true,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: (times) =>
        times > REDIS_MAX_RECONNECT_ATTEMPTS
          ? null
          : Math.min(times * 200, 5_000),
    });

    this.client.on('ready', () => {
      this.connected = true;
      this.logger.log('[portfolio:cache] redis layer=L2 action=connected');
    });
    this.client.on('error', (err: Error) => {
      this.connected = false;
      this.logThrottled('error', err.message);
    });
    this.client.on('close', () => {
      this.connected = false;
    });

    void this.client.connect().catch((err: Error) => {
      this.logger.warn(
        `[portfolio:cache] redis layer=L2 action=connect_failed detail=${err.message}`,
      );
    });
  }

  onModuleDestroy(): void {
    void this.client?.quit();
    this.client = null;
    this.connected = false;
  }

  async get(
    key: string,
  ): Promise<{ payload: CachedPortfolioAssetsPagePayload; layer: 'memory' | 'redis' } | null> {
    const mem = this.memory.get<CachedPortfolioAssetsPagePayload>(MEMORY_NS, key);
    if (mem) return { payload: mem, layer: 'memory' };

    if (!this.client) return null;
    try {
      const raw = await this.client.get(this.redisKey(key));
      if (!raw) return null;
      const payload = JSON.parse(raw) as CachedPortfolioAssetsPagePayload;
      this.memory.set(MEMORY_NS, key, payload, this.ttlMs());
      return { payload, layer: 'redis' };
    } catch (err) {
      this.logThrottled('get_failed', err instanceof Error ? err.message : String(err));
      return null;
    }
  }

  async set(key: string, payload: CachedPortfolioAssetsPagePayload): Promise<void> {
    const ttl = this.ttlMs();
    this.memory.set(MEMORY_NS, key, payload, ttl);

    if (!this.client) return;
    try {
      await this.client.set(this.redisKey(key), JSON.stringify(payload), 'PX', ttl);
    } catch (err) {
      this.logThrottled('set_failed', err instanceof Error ? err.message : String(err));
    }
  }

  private logThrottled(action: string, detail: string): void {
    const now = Date.now();
    if (now - this.lastErrorLogAtMs < 60_000) return;
    this.lastErrorLogAtMs = now;
    this.logger.warn(`[portfolio:cache] redis layer=L2 action=${action} detail=${detail}`);
  }
}
