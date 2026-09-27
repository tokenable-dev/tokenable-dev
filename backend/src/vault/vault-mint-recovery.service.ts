import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BlockchainService,
} from '../blockchain/blockchain.service';
import {
  ChainConfigService,
  type SupportedChainId,
} from '../blockchain/chain-config.service';
import { VaultService } from './vault.service';

const DEFAULT_POLL_MS = 60_000;
/** Cancel minting cycles with no on-chain token after this age. */
const STALE_NO_CHAIN_MS = 30 * 60_000;
/** Partner self-mint retry — release abandoned in-flight cycles without waiting for cron. */
const INTERACTIVE_MINTING_STALE_MS = 90_000;
const INTERACTIVE_DEPOSIT_STALE_MS = 2 * 60_000;

/**
 * Completes `recordMintResult` for cycles left in `minting` after process death
 * between on-chain mint confirmation and DB registry write (e.g. non-zero-downtime
 * Docker redeploy).
 */
@Injectable()
export class VaultMintRecoveryService implements OnModuleInit {
  private readonly logger = new Logger(VaultMintRecoveryService.name);
  private running = false;

  constructor(
    private readonly vault: VaultService,
    private readonly blockchain: BlockchainService,
    private readonly chainConfig: ChainConfigService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    const enabled =
      this.config.get<string>('VAULT_MINT_RECOVERY_ENABLED') !== '0' &&
      this.config.get<string>('VAULT_MINT_RECOVERY_ENABLED') !== 'false';
    if (!enabled) {
      this.logger.log(
        'VaultMintRecoveryService disabled (VAULT_MINT_RECOVERY_ENABLED=0)',
      );
      return;
    }
    const pollMs = Number(
      this.config.get<string>('VAULT_MINT_RECOVERY_POLL_MS') ?? DEFAULT_POLL_MS,
    );
    const interval = Number.isFinite(pollMs) && pollMs >= 10_000
      ? pollMs
      : DEFAULT_POLL_MS;
    setTimeout(() => void this.recoverPass(), 8_000);
    setInterval(() => void this.recoverPass(), interval);
    this.logger.log(
      `VaultMintRecoveryService armed poll=${interval}ms (heal minting cycles after crash/redeploy)`,
    );
  }

  /**
   * Clears or heals a stuck open cycle so cert-availability / partner mint can retry.
   * Returns true when the blocking row was cancelled or healed (re-check availability).
   */
  async reconcileBlockingOpenCycle(
    certNumber: string,
    chainId: number,
  ): Promise<boolean> {
    const row = await this.vault.findOpenVaultCycleWithAsset(certNumber, chainId);
    if (!row) return false;

    const { cycle, asset } = row;
    const age = Date.now() - new Date(cycle.updatedAt).getTime();

    if (cycle.status === 'deposit_verified') {
      if (age < INTERACTIVE_DEPOSIT_STALE_MS) return false;
      await this.vault.cancelCycle(
        cycle.id,
        'interactive: deposit_verified without mint progress',
      );
      return true;
    }

    if (cycle.status !== 'minting') {
      return false;
    }

    const attempt = cycle.mintAttempt;
    if (attempt?.tokenURI && attempt.certNumber) {
      const outcome = await this.healOne(
        cycle.id,
        cycle.chainId,
        asset.vaultRef,
        attempt,
        cycle.updatedAt,
      );
      if (outcome === 'healed' || outcome === 'cancelled') {
        return true;
      }
    }

    const hasTx = Boolean(attempt?.txHash?.trim());
    const hasTokenHint = Boolean(attempt?.tokenId?.trim());
    if (!hasTx && !hasTokenHint && age >= INTERACTIVE_MINTING_STALE_MS) {
      await this.vault.cancelCycle(
        cycle.id,
        'interactive: minting with no on-chain tx',
      );
      return true;
    }

    return false;
  }

  async recoverPass(): Promise<{ healed: number; cancelled: number }> {
    if (this.running) return { healed: 0, cancelled: 0 };
    this.running = true;
    let healed = 0;
    let cancelled = 0;
    try {
      const rows = await this.vault.listMintingCyclesForRecovery(50);
      for (const { cycle, asset, attempt } of rows) {
        try {
          const outcome = await this.healOne(cycle.id, cycle.chainId, asset.vaultRef, attempt, cycle.updatedAt);
          if (outcome === 'healed') healed += 1;
          if (outcome === 'cancelled') cancelled += 1;
        } catch (e) {
          this.logger.warn(
            `mint recovery failed cycle=${cycle.id}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
      if (healed > 0 || cancelled > 0) {
        this.logger.log(
          `Vault mint recovery pass healed=${healed} cancelled=${cancelled}`,
        );
      }
    } finally {
      this.running = false;
    }
    return { healed, cancelled };
  }

  private async healOne(
    cycleId: string,
    chainId: number,
    _vaultRef: string,
    attempt: {
      tokenURI: string;
      certNumber: string;
      settlementPolicy: 'standard' | 'self_vault_hold';
      vaultPartnerId?: string | null;
      ownerWallet: string;
      displayName?: string | null;
      displayImageUrl?: string | null;
      displayImageBackUrl?: string | null;
      tokenId?: string | null;
      txHash?: string | null;
    },
    updatedAt: Date,
  ): Promise<'healed' | 'cancelled' | 'skip'> {
    const supported = this.chainConfig.listConfiguredChainIds();
    if (!supported.includes(chainId as SupportedChainId)) {
      return 'skip';
    }
    const chain = chainId as SupportedChainId;
    let tokenIdNum = Number(attempt.tokenId);
    if (!Number.isFinite(tokenIdNum) || tokenIdNum < 0) {
      tokenIdNum = 0;
    }
    if (!tokenIdNum && attempt.txHash) {
      tokenIdNum = await this.blockchain.getMintedTokenIdFromTx(
        attempt.txHash,
        chain,
      );
    }
    if (!tokenIdNum) {
      const age = Date.now() - new Date(updatedAt).getTime();
      if (age >= STALE_NO_CHAIN_MS) {
        await this.vault.cancelCycle(
          cycleId,
          'mint recovery: minting with no on-chain token after timeout',
        );
        return 'cancelled';
      }
      return 'skip';
    }

    let tokenURI = attempt.tokenURI?.trim() || '';
    if (!tokenURI) {
      tokenURI = await this.blockchain.getRwaTokenURI(tokenIdNum, chain);
    }
    let ownerWallet = attempt.ownerWallet?.trim().toLowerCase() || '';
    if (!ownerWallet) {
      ownerWallet = await this.blockchain.getRwaTokenOwner(tokenIdNum, chain);
    }

    const contract = this.chainConfig.getRwaAddress(chain);
    await this.vault.recordMintResult({
      cycleId,
      tokenContract: contract,
      tokenId: String(tokenIdNum),
      tokenURI,
      txHash: attempt.txHash?.trim() || `recovery:${cycleId}`,
      certNumber: attempt.certNumber,
      displayName: attempt.displayName,
      displayImageUrl: attempt.displayImageUrl,
      displayImageBackUrl: attempt.displayImageBackUrl,
      settlementPolicy: attempt.settlementPolicy,
      vaultPartnerId: attempt.vaultPartnerId,
      ownerWallet,
    });
    return 'healed';
  }
}
