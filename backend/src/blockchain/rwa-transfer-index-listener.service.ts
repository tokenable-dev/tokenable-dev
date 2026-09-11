import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChainConfigService,
  type SupportedChainId,
} from './chain-config.service';
import { RwaTokenOwnerIndexService } from './rwa-token-owner-index.service';

/**
 * Keeps `rwa_tokens.owner_wallet` fresh via ERC-721 Transfer logs.
 * Uses periodic `eth_getLogs` (not `eth_newFilter` subscriptions) — Alchemy Free
 * expires filter IDs quickly and ethers logs noisy "filter not found" errors.
 *
 * Enable: RWA_OWNER_INDEX_ENABLED=1
 *
 * Poll cadence slows automatically once backfill completes on all chains
 * (`RWA_OWNER_INDEX_IDLE_POLL_MS`, default 2 min) to avoid idle RPC spend.
 */
@Injectable()
export class RwaTransferIndexListenerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RwaTransferIndexListenerService.name);
  private backfillTimer: ReturnType<typeof setTimeout> | null = null;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private backfillRunning = false;
  private pollRunning = false;
  private stopped = false;

  constructor(
    private readonly config: ConfigService,
    private readonly chainConfig: ChainConfigService,
    private readonly ownerIndex: RwaTokenOwnerIndexService,
  ) {}

  onModuleInit(): void {
    const enabled =
      this.config.get<string>('RWA_OWNER_INDEX_ENABLED') === '1' ||
      this.config.get<string>('RWA_OWNER_INDEX_ENABLED') === 'true';
    if (!enabled) {
      this.logger.log(
        'RwaTransferIndexListenerService disabled (set RWA_OWNER_INDEX_ENABLED=1)',
      );
      return;
    }

    setImmediate(() => void this.bootstrap());
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.backfillTimer) {
      clearTimeout(this.backfillTimer);
      this.backfillTimer = null;
    }
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    this.logger.log('RwaTransferIndexListenerService: stopped');
  }

  private deployBlock(chainId: SupportedChainId): number {
    const raw = this.config
      .get<string>(`CHAIN_${chainId}_RWA_DEPLOY_BLOCK`)
      ?.trim();
    const n = Number(raw ?? '0');
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }

  /** Only chains with a deploy block — avoids useless RPC on unconfigured chains. */
  private pollableChainIds(): SupportedChainId[] {
    return this.chainConfig
      .listConfiguredChainIds()
      .filter((id) => this.deployBlock(id) > 0);
  }

  private backfillPassDelayMs(): number {
    const raw = this.config
      .get<string>('RWA_OWNER_INDEX_BACKFILL_PASS_DELAY_MS')
      ?.trim();
    const n = Number(raw ?? 60_000);
    return Number.isFinite(n) && n >= 5_000 ? Math.floor(n) : 60_000;
  }

  /** While any chain is still backfilling. */
  private activePollIntervalMs(): number {
    const raw = this.config.get<string>('RWA_OWNER_INDEX_POLL_MS')?.trim();
    const n = Number(raw ?? 60_000);
    return Number.isFinite(n) && n >= 5_000 ? Math.floor(n) : 60_000;
  }

  /** After all chains indexed — catch new transfers with minimal RPC. */
  private idlePollIntervalMs(): number {
    const raw = this.config
      .get<string>('RWA_OWNER_INDEX_IDLE_POLL_MS')
      ?.trim();
    const n = Number(raw ?? 120_000);
    return Number.isFinite(n) && n >= 10_000 ? Math.floor(n) : 120_000;
  }

  private async allChainsIndexed(): Promise<boolean> {
    const chains = this.pollableChainIds();
    if (chains.length === 0) return true;
    for (const chainId of chains) {
      if (!(await this.ownerIndex.isIndexReady(chainId))) return false;
    }
    return true;
  }

  private scheduleBackfillPass(): void {
    if (this.stopped || this.backfillTimer) return;
    this.backfillTimer = setTimeout(() => {
      this.backfillTimer = null;
      void this.runBackfillPass();
    }, this.backfillPassDelayMs());
  }

  private async runBackfillPass(): Promise<void> {
    if (this.stopped || this.backfillRunning) return;
    this.backfillRunning = true;
    const chains = this.pollableChainIds();
    let needsAnotherPass = false;
    try {
      for (const chainId of chains) {
        if (await this.ownerIndex.isIndexReady(chainId)) continue;
        try {
          await this.ownerIndex.backfillFromTransferLogs(chainId);
        } catch (e) {
          this.logger.error(
            `Owner index backfill failed chain=${chainId}: ${String(e)}`,
          );
        }
        if (!(await this.ownerIndex.isIndexReady(chainId))) {
          needsAnotherPass = true;
        }
      }
    } finally {
      this.backfillRunning = false;
    }
    if (needsAnotherPass) {
      this.scheduleBackfillPass();
    }
  }

  private scheduleNextPoll(): void {
    if (this.stopped || this.pollTimer) return;
    const chains = this.pollableChainIds();
    if (chains.length === 0) {
      this.logger.warn(
        'RwaTransferIndexListenerService: no chains with CHAIN_{id}_RWA_DEPLOY_BLOCK — live Transfer poll disabled',
      );
      return;
    }
    void this.allChainsIndexed().then((indexed) => {
      if (this.stopped) return;
      const delayMs = indexed
        ? this.idlePollIntervalMs()
        : this.activePollIntervalMs();
      this.pollTimer = setTimeout(() => {
        this.pollTimer = null;
        void this.pollAllChains();
      }, delayMs);
    });
  }

  private async pollAllChains(): Promise<void> {
    if (this.stopped || this.pollRunning) {
      this.scheduleNextPoll();
      return;
    }
    this.pollRunning = true;
    try {
      for (const chainId of this.pollableChainIds()) {
        try {
          const { transfers, lastBlock } =
            await this.ownerIndex.pollTransferLogsSinceCursor(chainId);
          if (transfers > 0) {
            this.logger.log(
              `RWA owner index poll chain=${chainId} transfers=${transfers} through block ${lastBlock}`,
            );
          }
        } catch (e) {
          this.logger.warn(
            `Transfer log poll failed chain=${chainId}: ${String(e)}`,
          );
        }
      }
    } finally {
      this.pollRunning = false;
      this.scheduleNextPoll();
    }
  }

  private async bootstrap(): Promise<void> {
    await this.runBackfillPass();
    const chains = this.pollableChainIds();
    if (chains.length === 0) return;
    const indexed = await this.allChainsIndexed();
    this.logger.log(
      `RwaTransferIndexListenerService: live Transfer poll ` +
        `(active=${this.activePollIntervalMs()}ms idle=${this.idlePollIntervalMs()}ms) ` +
        `chains=${chains.join(',')} indexed=${indexed}`,
    );
    void this.pollAllChains();
  }
}
