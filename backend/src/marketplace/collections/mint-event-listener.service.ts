import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract } from 'ethers';
import { TOKENABLE_RWA_CONTRACT } from '../../blockchain/constants/injection-tokens';
import { RwaTokenRegistryService } from './rwa-token-registry.service';

/**
 * Listens to the on-chain `Minted(address to, uint256 tokenId, string tokenURI)` event.
 * Syncs `rwa_tokens` only — marketplace collection rows are created on first ask listing.
 *
 * Enable via env:  MINT_EVENT_LISTENER_ENABLED=1
 */
@Injectable()
export class MintEventListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MintEventListenerService.name);
  private listening = false;

  constructor(
    @Inject(TOKENABLE_RWA_CONTRACT)
    private readonly contract: Contract,
    private readonly rwaTokenRegistry: RwaTokenRegistryService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const enabled =
      this.config.get<string>('MINT_EVENT_LISTENER_ENABLED') === '1' ||
      this.config.get<string>('MINT_EVENT_LISTENER_ENABLED') === 'true';
    if (!enabled) {
      this.logger.log(
        'MintEventListenerService disabled (set MINT_EVENT_LISTENER_ENABLED=1 to enable)',
      );
      return;
    }

    setImmediate(() => void this.startListening());
  }

  async onModuleDestroy(): Promise<void> {
    if (this.listening) {
      try {
        await this.contract.removeAllListeners('Minted');
        this.listening = false;
        this.logger.log('MintEventListenerService: removed Minted listener');
      } catch (e) {
        this.logger.warn(`removeAllListeners error: ${String(e)}`);
      }
    }
  }

  private async startListening(): Promise<void> {
    try {
      await this.contract.on(
        'Minted',
        (to: string, tokenId: bigint, tokenURI: string) => {
          const id = Number(tokenId);
          this.logger.log(
            `Minted event: tokenId=${id} to=${to} uri=${tokenURI.slice(0, 80)}`,
          );
          void this.handleMintedToken(id).catch((err: unknown) => {
            this.logger.warn(
              `handleMintedToken failed for #${id}: ${String(err)}`,
            );
          });
        },
      );
      this.listening = true;
      this.logger.log('MintEventListenerService: listening for Minted events');
    } catch (e) {
      this.logger.error(
        `MintEventListenerService failed to attach listener: ${String(e)}`,
      );
    }
  }

  /**
   * Mint hook: sync `rwa_tokens` from chain metadata only.
   * Collection bootstrap runs in `ensureCollectionForListing` on first ask listing.
   *
   * Called from the on-chain event listener AND from POST /collections/on-mint.
   */
  async handleMintedToken(tokenId: number): Promise<string | null> {
    const id = Math.floor(tokenId);
    if (!Number.isFinite(id) || id < 0) return null;

    await this.rwaTokenRegistry.syncTokenFromChain(id, null);
    this.logger.log(
      `MintEventListenerService: synced rwa_tokens for #${id} (collection deferred to first listing)`,
    );
    return null;
  }
}
