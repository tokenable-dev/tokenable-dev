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
 * Keeps `rwa_tokens.owner_wallet` fresh via ERC-721 Transfer logs (`eth_getLogs`).
 *
 * Enable: `RWA_OWNER_INDEX_ENABLED=1` + `CHAIN_{id}_RWA_DEPLOY_BLOCK`.
 *
 * Catch-up = backfill passes only (no live poll until indexed — polling during
 * backfill doubled `eth_getLogs` and burned Alchemy CU). After ready, idle poll
 * only. Failed passes back off so a dead RPC does not hammer every minute.
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
  private backfillFailStreak = 0;

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
    const n = Number(raw ?? 120_000);
    return Number.isFinite(n) && n >= 5_000 ? Math.floor(n) : 120_000;
  }

  /** After all chains indexed — catch new transfers with minimal RPC. */
  private idlePollIntervalMs(): number {
    const raw = this.config
      .get<string>('RWA_OWNER_INDEX_IDLE_POLL_MS')
      ?.trim();
    const n = Number(raw ?? 300_000);
    return Number.isFinite(n) && n >= 10_000 ? Math.floor(n) : 300_000;
  }

  /** On RPC failure: 2m → 4m → 8m … cap 15m. */
  private backfillFailureDelayMs(): number {
    const base = this.backfillPassDelayMs();
    const streak = Math.min(this.backfillFailStreak, 4);
    return Math.min(15 * 60_000, base * 2 ** streak);
  }

  private async allChainsIndexed(): Promise<boolean> {
    const chains = this.pollableChainIds();
    if (chains.length === 0) return true;
    for (const chainId of chains) {
      if (!(await this.ownerIndex.isIndexReady(chainId))) return false;
    }
    return true;
  }

  private scheduleBackfillPass(delayMs: number): void {
    if (this.stopped || this.backfillTimer) return;
    this.backfillTimer = setTimeout(() => {
      this.backfillTimer = null;
      void this.runBackfillPass();
    }, delayMs);
  }

  private async runBackfillPass(): Promise<void> {
    if (this.stopped || this.backfillRunning) return;
    this.backfillRunning = true;
    const chains = this.pollableChainIds();
    let needsAnotherPass = false;
    let hadFailure = false;
    try {
      for (const chainId of chains) {
        if (await this.ownerIndex.isIndexReady(chainId)) continue;
        try {
          await this.ownerIndex.backfillFromTransferLogs(chainId);
        } catch (e) {
          hadFailure = true;
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

    if (this.stopped) return;

    if (hadFailure) {
      this.backfillFailStreak += 1;
      const delay = this.backfillFailureDelayMs();
      this.logger.warn(
        `Owner index backfill backing off ${delay}ms (fail streak=${this.backfillFailStreak})`,
      );
      this.scheduleBackfillPass(delay);
      return;
    }

    this.backfillFailStreak = 0;
    if (needsAnotherPass) {
      this.scheduleBackfillPass(this.backfillPassDelayMs());
      return;
    }

    this.logger.log(
      'Owner index backfill complete — starting idle Transfer poll only',
    );
    this.scheduleNextIdlePoll();
  }

  private scheduleNextIdlePoll(): void {
    if (this.stopped || this.pollTimer) return;
    const chains = this.pollableChainIds();
    if (chains.length === 0) {
      this.logger.warn(
        'RwaTransferIndexListenerService: no chains with CHAIN_{id}_RWA_DEPLOY_BLOCK — live Transfer poll disabled',
      );
      return;
    }
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      void this.pollAllChains();
    }, this.idlePollIntervalMs());
  }

  private async pollAllChains(): Promise<void> {
    if (this.stopped || this.pollRunning) {
      this.scheduleNextIdlePoll();
      return;
    }

    // Never poll while catch-up is incomplete — backfill owns the cursor.
    if (!(await this.allChainsIndexed())) {
      this.logger.log(
        'Idle Transfer poll skipped — backfill still in progress',
      );
      if (!this.backfillTimer && !this.backfillRunning) {
        this.scheduleBackfillPass(this.backfillPassDelayMs());
      }
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
      this.scheduleNextIdlePoll();
    }
  }

  private async bootstrap(): Promise<void> {
    const chains = this.pollableChainIds();
    if (chains.length === 0) {
      this.logger.warn(
        'RwaTransferIndexListenerService: no chains with CHAIN_{id}_RWA_DEPLOY_BLOCK — disabled',
      );
      return;
    }

    const indexed = await this.allChainsIndexed();
    this.logger.log(
      `RwaTransferIndexListenerService: chains=${chains.join(',')} ` +
        `indexed=${indexed} backfillDelay=${this.backfillPassDelayMs()}ms ` +
        `idlePoll=${this.idlePollIntervalMs()}ms (no poll during catch-up)`,
    );

    if (indexed) {
      this.scheduleNextIdlePoll();
      return;
    }

    await this.runBackfillPass();
  }
}
