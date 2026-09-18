import { Injectable } from '@nestjs/common';
import { RedisIdentityCacheProvider } from '../redis-identity-cache.provider';

/** Test-only fault profile for Redis L2 chaos injection (P3.15). */
export interface RedisFaultProfile {
  writeFail: boolean;
  readFail: boolean;
  /** Read succeeds but writes are dropped — partial outage. */
  readOkWriteFail: boolean;
  disconnected: boolean;
}

/**
 * Extends production Redis provider with injectable failures.
 * Used only in integration / chaos tests — no production wiring.
 */
@Injectable()
export class FaultInjectingRedisIdentityCacheProvider extends RedisIdentityCacheProvider {
  readonly faults: RedisFaultProfile = {
    writeFail: false,
    readFail: false,
    readOkWriteFail: false,
    disconnected: false,
  };

  override isConnected(): boolean {
    if (this.faults.disconnected) return false;
    return super.isConnected();
  }

  override async get(key: string): Promise<string | null> {
    if (this.faults.readFail) return null;
    return super.get(key);
  }

  override async trySet(
    key: string,
    value: string | null,
    ttlMs: number,
  ): Promise<boolean> {
    if (this.faults.writeFail || this.faults.readOkWriteFail) return false;
    return super.trySet(key, value, ttlMs);
  }

  override async exists(key: string): Promise<boolean> {
    if (this.faults.readFail) return false;
    return super.exists(key);
  }

  override async delete(key: string): Promise<void> {
    if (this.faults.writeFail || this.faults.readOkWriteFail) return;
    await super.delete(key);
  }

  applyFault(event: {
    type: string;
    enabled?: boolean;
    connected?: boolean;
  }): void {
    switch (event.type) {
      case 'inject_l2_write_fail':
        this.faults.writeFail = Boolean(event.enabled);
        this.faults.readOkWriteFail = false;
        break;
      case 'inject_l2_read_fail':
        this.faults.readFail = Boolean(event.enabled);
        break;
      case 'inject_l2_disconnect':
        this.faults.disconnected = !event.connected;
        break;
      case 'chaos_redis_partition':
        this.faults.readOkWriteFail = Boolean(event.enabled);
        this.faults.writeFail = Boolean(event.enabled);
        break;
      default:
        break;
    }
  }

  resetFaults(): void {
    this.faults.writeFail = false;
    this.faults.readFail = false;
    this.faults.readOkWriteFail = false;
    this.faults.disconnected = false;
  }
}
