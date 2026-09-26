import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract } from 'ethers';
import type { SupportedChainId } from '../../blockchain/chain-config.service';
import { TOKENABLE_RWA_CONTRACT } from '../../blockchain/constants/injection-tokens';
import { RwaTokenOwnerIndexService } from '../../blockchain/rwa-token-owner-index.service';
import { RwaTokenRegistryService } from './rwa-token-registry.service';

/**
 * Listens to ERC-721 `Transfer(from=0x0)` mints and syncs `rwa_tokens`.
 * Marketplace collection rows are still created on first ask listing.
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
    private readonly ownerIndex: RwaTokenOwnerIndexService,
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
        await this.contract.removeAllListeners('Transfer');
        this.listening = false;
        this.logger.log('MintEventListenerService: removed Transfer listener');
      } catch (e) {
        this.logger.warn(`removeAllListeners error: ${String(e)}`);
      }
    }
  }

  private async startListening(): Promise<void> {
    try {
      await this.contract.on(
        'Transfer',
        (from: string, to: string, tokenId: bigint) => {
          if (
            String(from).toLowerCase() !==
            '0x0000000000000000000000000000000000000000'
          ) {
            return;
          }
          const id = Number(tokenId);
          const owner = String(to).trim().toLowerCase();
          this.logger.log(`Mint Transfer: tokenId=${id} to=${owner}`);
          void this.handleMintedToken(id, undefined, owner).catch(
            (err: unknown) => {
              this.logger.warn(
                `handleMintedToken failed for #${id}: ${String(err)}`,
              );
            },
          );
        },
      );
      this.listening = true;
      this.logger.log('MintEventListenerService: listening for Transfer mints');
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
  async handleMintedToken(
    tokenId: number,
    chainId?: SupportedChainId,
    mintedTo?: string,
  ): Promise<string | null> {
    const id = Math.floor(tokenId);
    if (!Number.isFinite(id) || id < 0) return null;

    const collectionKey = await this.rwaTokenRegistry.syncTokenFromChain(
      id,
      null,
      chainId,
    );
    if (mintedTo) {
      const contract = this.contract.target;
      if (typeof contract === 'string') {
        await this.ownerIndex.recordOwner(contract, id, mintedTo);
      }
    }
    this.logger.log(
      `MintEventListenerService: synced rwa_tokens for #${id} chain=${chainId ?? 'default'} key=${collectionKey ?? 'none'}`,
    );
    return collectionKey;
  }
}
