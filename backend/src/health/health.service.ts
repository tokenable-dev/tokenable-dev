import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';

export type DependencyHealth = {
  ok: boolean;
  enabled?: boolean;
  latencyMs?: number;
  error?: string;
};

export type HealthReport = {
  ok: boolean;
  service: string;
  dependencies: {
    postgres: DependencyHealth;
    redis: DependencyHealth;
  };
};

@Injectable()
export class HealthService implements OnModuleDestroy {
  /** Reused across probes — health is polled every ~20s; a fresh TCP+auth handshake per probe is wasted load. */
  private redisClient: Redis | null = null;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

  onModuleDestroy(): void {
    this.redisClient?.disconnect();
    this.redisClient = null;
  }

  async getReport(): Promise<HealthReport> {
    const [postgres, redis] = await Promise.all([
      this.checkPostgres(),
      this.checkRedis(),
    ]);
    const ok = postgres.ok && redis.ok;
    return {
      ok,
      service: 'tokenable-api',
      dependencies: { postgres, redis },
    };
  }

  private async checkPostgres(): Promise<DependencyHealth> {
    const started = Date.now();
    try {
      // SELECT 1 only — health is hit by Docker/LB every ~20s and must never
      // add table-scan load while the DB is already under pressure.
      await this.dataSource.query('SELECT 1');
      return { ok: true, latencyMs: Date.now() - started };
    } catch (err) {
      return {
        ok: false,
        latencyMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  private async checkRedis(): Promise<DependencyHealth> {
    const url = this.config.get<string>('REDIS_URL')?.trim();
    if (!url) {
      return { ok: true, enabled: false };
    }

    if (!this.redisClient) {
      this.redisClient = new Redis(url, {
        connectTimeout: 2_000,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
        // Health probes report failure instead of stacking reconnect attempts.
        retryStrategy: () => null,
      });
      this.redisClient.on('error', () => {
        /* reported via ping() rejection — avoid unhandled error event */
      });
    }

    const started = Date.now();
    try {
      if (this.redisClient.status === 'wait' || this.redisClient.status === 'end') {
        await this.redisClient.connect();
      }
      const pong = await this.redisClient.ping();
      return {
        ok: pong === 'PONG',
        enabled: true,
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      // Drop the broken client so the next probe reconnects cleanly.
      this.redisClient.disconnect();
      this.redisClient = null;
      return {
        ok: false,
        enabled: true,
        latencyMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
