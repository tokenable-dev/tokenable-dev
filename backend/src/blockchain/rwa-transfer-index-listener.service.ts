import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Contract } from 'ethers';
import {
  ChainConfigService,
  type SupportedChainId,
} from './chain-config.service';
import { TOKENABLE_RWA_ABI } from './abis/tokenable-rwa.abi';
import { RwaTokenOwnerIndexService } from './rwa-token-owner-index.service';

/**
 * Keeps `rwa_tokens.owner_wallet` fresh via ERC-721 Transfer events.
 * Runs an initial log backfill on boot when enabled.
 *
 * Enable: RWA_OWNER_INDEX_ENABLED=1
 */
@Injectable()
export class RwaTransferIndexListenerService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RwaTransferIndexListenerService.name);
  private readonly contracts = new Map<SupportedChainId, Contract>();
  private listening = false;

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
    if (!this.listening) return;
    for (const contract of this.contracts.values()) {
      try {
        await contract.removeAllListeners('Transfer');
      } catch (e) {
        this.logger.warn(`removeAllListeners error: ${String(e)}`);
      }
    }
    this.listening = false;
    this.logger.log('RwaTransferIndexListenerService: stopped');
  }

  private rwaContract(chainId: SupportedChainId): Contract {
    const cached = this.contracts.get(chainId);
    if (cached) return cached;
    const address = this.chainConfig.getRwaAddress(chainId);
    const provider = this.chainConfig.createJsonRpcProvider(chainId);
    const contract = new Contract(address, TOKENABLE_RWA_ABI, provider);
    this.contracts.set(chainId, contract);
    return contract;
  }

  private async bootstrap(): Promise<void> {
    const chains = this.chainConfig.listConfiguredChainIds();
    for (const chainId of chains) {
      try {
        await this.ownerIndex.backfillFromTransferLogs(chainId);
      } catch (e) {
        this.logger.error(
          `Owner index backfill failed chain=${chainId}: ${String(e)}`,
        );
      }
    }

    for (const chainId of chains) {
      try {
        await this.attachListener(chainId);
      } catch (e) {
        this.logger.error(
          `Transfer listener attach failed chain=${chainId}: ${String(e)}`,
        );
      }
    }
    this.listening = true;
  }

  private async attachListener(chainId: SupportedChainId): Promise<void> {
    const contract = this.rwaContract(chainId);
    const contractAddr = this.chainConfig.getRwaAddress(chainId);
    await contract.on(
      'Transfer',
      (from: string, to: string, tokenId: bigint) => {
        const id = Number(tokenId);
        void this.ownerIndex
          .recordTransfer(
            contractAddr,
            id,
            String(from).trim().toLowerCase(),
            String(to).trim().toLowerCase(),
          )
          .catch((err: unknown) => {
            this.logger.warn(
              `recordTransfer failed #${id} chain=${chainId}: ${String(err)}`,
            );
          });
      },
    );
    this.logger.log(
      `RwaTransferIndexListenerService: listening Transfer chain=${chainId}`,
    );
  }
}
