import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { DataSource } from 'typeorm';

export type DependencyHealth = {
  ok: boolean;
  enabled?: boolean;
  latencyMs?: number;
  error?: string;
  details?: Record<string, number>;
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
export class HealthService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly config: ConfigService,
  ) {}

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
      await this.dataSource.query('SELECT 1');
      const [collectionsRow, ordersRow] = await Promise.all([
        this.dataSource.query<{ count: string }[]>(
          'SELECT COUNT(*)::text AS count FROM marketplace_collections',
        ),
        this.dataSource.query<{ count: string }[]>(
          "SELECT COUNT(*)::text AS count FROM orders WHERE status = 'active'",
        ),
      ]);
      return {
        ok: true,
        latencyMs: Date.now() - started,
        details: {
          collections: Number(collectionsRow[0]?.count ?? 0),
          activeOrders: Number(ordersRow[0]?.count ?? 0),
        },
      };
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

    const started = Date.now();
    const client = new Redis(url, {
      connectTimeout: 2_000,
      maxRetriesPerRequest: 1,
      lazyConnect: true,
    });

    try {
      await client.connect();
      const pong = await client.ping();
      return {
        ok: pong === 'PONG',
        enabled: true,
        latencyMs: Date.now() - started,
      };
    } catch (err) {
      return {
        ok: false,
        enabled: true,
        latencyMs: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      client.disconnect();
    }
  }
}
