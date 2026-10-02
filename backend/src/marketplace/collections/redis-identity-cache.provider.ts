import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CardhedgerMetricsService } from '../../common/metrics/cardhedger-metrics.service';
import {
  IDENTITY_CACHE_DEFAULT_TTL_MS,
  IDENTITY_CACHE_NULL_SENTINEL,
  identityCacheRedisKey,
  type IdentityCacheProvider,
} from './identity-cache.provider';

/** Fail-fast connect cap — avoids 10s ioredis default on DNS / TCP hang. */
const REDIS_CONNECT_TIMEOUT_MS = 2_000;

/** Per-command cap — bounds identity read/write latency under partition. */
const REDIS_COMMAND_TIMEOUT_MS = 1_000;

/** Stop reconnect loops after repeated failures (L1-only fallback). */
const REDIS_MAX_RECONNECT_ATTEMPTS = 5;

/**
 * Redis-backed L2 cache for `collection.components.cardhedgerCardId`.
 *
 * Disabled when `REDIS_URL` is unset — all methods degrade to no-op / miss
 * without throwing, so the app boots and runs on L1 only.
 *
 * Key format: `identity:cardhedger:{collectionKey}`
 */
@Injectable()
export class RedisIdentityCacheProvider
  implements IdentityCacheProvider, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RedisIdentityCacheProvider.name);
  private client: Redis | null = null;
  private connected = false;
  private lastErrorLogAtMs = 0;

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly metrics?: CardhedgerMetricsService,
  ) {}

  isEnabled(): boolean {
    return Boolean(this.config.get<string>('REDIS_URL')?.trim());
  }

  isConnected(): boolean {
    return this.isEnabled() && this.connected;
  }

  onModuleInit(): void {
    const url = this.config.get<string>('REDIS_URL')?.trim();
    if (!url) {
      this.pushHealth(false);
      return;
    }

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
      this.logger.log('[identity:cache] redis layer=L2 action=connected');
      this.pushHealth(true);
    });
    this.client.on('error', (err: Error) => {
      this.connected = false;
      this.logThrottledRedisError('error', err.message);
      this.pushHealth(false);
    });
    this.client.on('close', () => {
      this.connected = false;
      this.pushHealth(false);
    });
    this.client.on('reconnecting', () => {
      this.connected = false;
      this.pushHealth(false);
    });

    void this.client.connect().catch((err: Error) => {
      this.logger.warn(
        `[identity:cache] redis layer=L2 action=connect_failed detail=${err.message} hint=${localRedisConnectHint(url)}`,
      );
      this.pushHealth(false);
    });
  }

  onModuleDestroy(): void {
    void this.client?.quit();
    this.client = null;
    this.connected = false;
  }

  async get(key: string): Promise<string | null> {
    if (!this.client) return null;
    try {
      const raw = await this.client.get(identityCacheRedisKey(key));
      if (raw === null) return null;
      return raw === IDENTITY_CACHE_NULL_SENTINEL ? null : raw;
    } catch (err) {
      this.logRedisFailure('get', err);
      return null;
    }
  }

  async set(key: string, value: string | null, ttlMs: number): Promise<void> {
    await this.trySet(key, value, ttlMs);
  }

  /** @returns true when Redis accepted the write; false when disabled or on error. */
  async trySet(
    key: string,
    value: string | null,
    ttlMs: number,
  ): Promise<boolean> {
    if (!this.client) {
      this.recordFailure('set', 'not_connected');
      return false;
    }
    const ttl = ttlMs > 0 ? ttlMs : IDENTITY_CACHE_DEFAULT_TTL_MS;
    try {
      await this.client.set(
        identityCacheRedisKey(key),
        value ?? IDENTITY_CACHE_NULL_SENTINEL,
        'PX',
        ttl,
      );
      return true;
    } catch (err) {
      this.logRedisFailure('set', err);
      return false;
    }
  }

  async exists(key: string): Promise<boolean> {
    if (!this.client) {
      this.recordFailure('exists', 'not_connected');
      return false;
    }
    try {
      return (await this.client.exists(identityCacheRedisKey(key))) === 1;
    } catch (err) {
      this.logRedisFailure('exists', err);
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    if (!this.client) {
      this.recordFailure('delete', 'not_connected');
      return;
    }
    try {
      await this.client.del(identityCacheRedisKey(key));
    } catch (err) {
      this.logRedisFailure('delete', err);
    }
  }

  private pushHealth(redisConnected: boolean): void {
    this.metrics?.recordIdentityCacheHealth({
      mode: this.isEnabled() ? 'layered' : 'local',
      redisConnected,
    });
  }

  private recordFailure(
    op: 'get' | 'set' | 'exists' | 'delete',
    reason: 'timeout' | 'command_error' | 'not_connected',
  ): void {
    this.metrics?.recordIdentityRedisFailure(op, reason);
  }

  private classifyRedisError(err: unknown): 'timeout' | 'command_error' {
    const msg = err instanceof Error ? err.message : String(err);
    if (/timed out|timeout|ETIMEDOUT|Command timed out/i.test(msg)) {
      return 'timeout';
    }
    return 'command_error';
  }

  private logThrottledRedisError(action: string, detail: string): void {
    const now = Date.now();
    if (now - this.lastErrorLogAtMs < 60_000) return;
    this.lastErrorLogAtMs = now;
    this.logger.warn(
      `[identity:cache] redis layer=L2 action=${action} detail=${detail}`,
    );
  }

  private logRedisFailure(op: string, err: unknown): void {
    const detail = err instanceof Error ? err.message : String(err);
    this.logThrottledRedisError(`${op}_failed`, detail);
    if (
      op === 'get' ||
      op === 'set' ||
      op === 'exists' ||
      op === 'delete'
    ) {
      this.recordFailure(op, this.classifyRedisError(err));
    }
  }
}

/** Actionable hint when host dev Redis is mis-pointed (common macOS port clash). */
function localRedisConnectHint(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const port = parsed.port || '6379';
    if (
      (host === '127.0.0.1' || host === 'localhost') &&
      port === '6379'
    ) {
      return 'run `docker compose up -d redis` and set REDIS_URL=redis://127.0.0.1:6380 (VS Code may occupy :6379)';
    }
    return 'run `docker compose up -d redis` and verify REDIS_URL';
  } catch {
    return 'verify REDIS_URL and `docker compose up -d redis`';
  }
}
