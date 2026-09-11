/**
 * P3.14 — NestJS + TypeORM + Redis integration test harness.
 *
 * Uses testcontainers when Docker is available; falls back to env POSTGRES_* / REDIS_URL.
 */

import { Test, type TestingModule } from '@nestjs/testing';
import { ConfigModule } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { RedisContainer } from '@testcontainers/redis';
import Redis from 'ioredis';
import type { Repository } from 'typeorm';
import { CardhedgerMetricsModule } from '../../../common/metrics/cardhedger-metrics.module';
import { MarketplaceCollection } from '../../entities/marketplace-collection.entity';
import { CollectionIdentityService } from '../collection-identity.service';
import { IdentityCacheDecisionEngine } from '../identity-cache-decision.engine';
import { IdentityCacheExecutionService } from '../identity-cache-execution.service';
import { IdentityStructuredLogger } from '../identity-structured-logger';
import {
  IDENTITY_CACHE_PROVIDER,
  InProcessIdentityCacheProvider,
  identityCacheRedisKey,
} from '../identity-cache.provider';
import { LayeredIdentityCacheProvider } from '../layered-identity-cache.provider';
import { RedisIdentityCacheProvider } from '../redis-identity-cache.provider';
import { FaultInjectingRedisIdentityCacheProvider } from './fault-injecting-redis-cache.provider';

export interface IntegrationInfraConfig {
  postgres: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
  };
  redisUrl: string;
  source: 'testcontainers' | 'env';
}

export interface IdentityIntegrationHarness {
  moduleRef: TestingModule;
  identity: CollectionIdentityService;
  execution: IdentityCacheExecutionService;
  decision: IdentityCacheDecisionEngine;
  repo: Repository<MarketplaceCollection>;
  l1: InProcessIdentityCacheProvider;
  l2: FaultInjectingRedisIdentityCacheProvider;
  layered: LayeredIdentityCacheProvider;
  redisReader: Redis;
  spawnPod(): Promise<IdentityIntegrationHarness>;
  close(): Promise<void>;
}

let sharedInfra: (IntegrationInfraConfig & { stop?: () => Promise<void> }) | null =
  null;

export async function resolveIntegrationInfra(): Promise<
  (IntegrationInfraConfig & { stop?: () => Promise<void> }) | null
> {
  if (process.env.IDENTITY_INTEGRATION_SKIP === '1') return null;
  if (sharedInfra) return sharedInfra;

  if (process.env.IDENTITY_INTEGRATION_USE_ENV === '1') {
    const envInfra = readEnvInfra();
    if (envInfra) {
      sharedInfra = envInfra;
      return envInfra;
    }
  }

  try {
    const pg = await new PostgreSqlContainer('postgres:16-alpine').start();
    const redis = await new RedisContainer('redis:7-alpine').start();
    sharedInfra = {
      source: 'testcontainers',
      postgres: {
        host: pg.getHost(),
        port: pg.getPort(),
        username: pg.getUsername(),
        password: pg.getPassword(),
        database: pg.getDatabase(),
      },
      redisUrl: redis.getConnectionUrl(),
      stop: async () => {
        await pg.stop();
        await redis.stop();
        sharedInfra = null;
      },
    };
    return sharedInfra;
  } catch {
    const envInfra = readEnvInfra();
    if (envInfra) {
      sharedInfra = envInfra;
      return envInfra;
    }
    return null;
  }
}

function readEnvInfra():
  | (IntegrationInfraConfig & { stop?: () => Promise<void> })
  | null {
  const host = process.env.POSTGRES_HOST ?? process.env.TEST_POSTGRES_HOST;
  const user = process.env.POSTGRES_USER ?? process.env.TEST_POSTGRES_USER;
  const password =
    process.env.POSTGRES_PASSWORD ?? process.env.TEST_POSTGRES_PASSWORD;
  const database = process.env.POSTGRES_DB ?? process.env.TEST_POSTGRES_DB;
  const redisUrl = process.env.REDIS_URL ?? process.env.TEST_REDIS_URL;
  if (!host || !user || !password || !database || !redisUrl) return null;
  return {
    source: 'env',
    postgres: {
      host,
      port: Number(
        process.env.POSTGRES_PORT ?? process.env.TEST_POSTGRES_PORT ?? 5432,
      ),
      username: user,
      password,
      database,
    },
    redisUrl,
  };
}

export async function createIdentityIntegrationHarness(
  infra: IntegrationInfraConfig,
): Promise<IdentityIntegrationHarness> {
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        ignoreEnvFile: true,
        load: [
          () => ({
            NODE_ENV: 'test',
            POSTGRES_HOST: infra.postgres.host,
            POSTGRES_PORT: infra.postgres.port,
            POSTGRES_USER: infra.postgres.username,
            POSTGRES_PASSWORD: infra.postgres.password,
            POSTGRES_DB: infra.postgres.database,
            REDIS_URL: infra.redisUrl,
            IDENTITY_SERVICE_ENABLED: 'true',
            IDENTITY_RECONCILIATION_ENABLED: 'false',
            IDENTITY_CACHE_DRIFT_SAMPLE_RATE: '1',
          }),
        ],
      }),
      TypeOrmModule.forRoot({
        type: 'postgres',
        host: infra.postgres.host,
        port: infra.postgres.port,
        username: infra.postgres.username,
        password: infra.postgres.password,
        database: infra.postgres.database,
        entities: [MarketplaceCollection],
        synchronize: true,
        logging: false,
      }),
      TypeOrmModule.forFeature([MarketplaceCollection]),
      CardhedgerMetricsModule,
    ],
    providers: [
      InProcessIdentityCacheProvider,
      FaultInjectingRedisIdentityCacheProvider,
      {
        provide: RedisIdentityCacheProvider,
        useExisting: FaultInjectingRedisIdentityCacheProvider,
      },
      LayeredIdentityCacheProvider,
      {
        provide: IDENTITY_CACHE_PROVIDER,
        useExisting: LayeredIdentityCacheProvider,
      },
      CollectionIdentityService,
      IdentityCacheDecisionEngine,
      IdentityCacheExecutionService,
      IdentityStructuredLogger,
    ],
  }).compile();

  await moduleRef.init();

  const l2 = moduleRef.get(FaultInjectingRedisIdentityCacheProvider);
  await waitForRedisReady(l2, 8_000);

  const redisReader = new Redis(infra.redisUrl, {
    connectTimeout: 2_000,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  });
  await redisReader.connect();

  const harness: IdentityIntegrationHarness = {
    moduleRef,
    identity: moduleRef.get(CollectionIdentityService),
    execution: moduleRef.get(IdentityCacheExecutionService),
    decision: moduleRef.get(IdentityCacheDecisionEngine),
    repo: moduleRef.get(getRepositoryToken(MarketplaceCollection)),
    l1: moduleRef.get(InProcessIdentityCacheProvider),
    l2,
    layered: moduleRef.get(LayeredIdentityCacheProvider),
    redisReader,
    spawnPod: async () => createIdentityIntegrationHarness(infra),
    close: async () => {
      await redisReader.quit();
      await moduleRef.close();
    },
  };

  return harness;
}

export async function waitForRedisReady(
  redis: RedisIdentityCacheProvider,
  timeoutMs: number,
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (redis.isConnected()) return;
    await sleep(100);
  }
  if (!redis.isEnabled()) {
    throw new Error('Redis provider not enabled — REDIS_URL missing in harness');
  }
  throw new Error('Redis not ready within timeout');
}

export async function seedCollectionRow(
  repo: Repository<MarketplaceCollection>,
  key: string,
  cardId?: string,
): Promise<void> {
  const normalized = key.toLowerCase();
  const existing = await repo.findOne({ where: { collectionKey: normalized } });
  const components: Record<string, unknown> = cardId
    ? { cardhedgerCardId: cardId }
    : {};
  if (existing) {
    existing.components = { ...existing.components, ...components };
    await repo.save(existing);
    return;
  }
  await repo.save({
    collectionKey: normalized,
    displayLabel: `integration-${normalized.slice(0, 8)}`,
    components,
    marketParallelKey: 'base',
    bucketKeyVersion: 2,
  });
}

export async function readDbCardId(
  repo: Repository<MarketplaceCollection>,
  key: string,
): Promise<string> {
  const row = await repo.findOne({
    where: { collectionKey: key.toLowerCase() },
  });
  const raw = row?.components?.cardhedgerCardId;
  return typeof raw === 'string' ? raw.trim() : '';
}

export async function readRedisL2(
  redis: Redis,
  key: string,
): Promise<string | null> {
  const raw = await redis.get(identityCacheRedisKey(key));
  if (raw === null) return null;
  return raw === '__null__' ? null : raw;
}

export async function readL1Direct(
  l1: InProcessIdentityCacheProvider,
  key: string,
): Promise<string | null> {
  return l1.get(key.toLowerCase());
}

export async function clearIntegrationKey(
  harness: IdentityIntegrationHarness,
  key: string,
): Promise<void> {
  const k = key.toLowerCase();
  await harness.repo.delete({ collectionKey: k });
  await harness.l1.delete(k);
  await harness.redisReader.del(identityCacheRedisKey(k));
}

export async function stopSharedIntegrationInfra(): Promise<void> {
  if (sharedInfra?.stop) await sharedInfra.stop();
  sharedInfra = null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
