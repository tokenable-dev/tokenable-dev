import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Contract } from 'ethers';
import { IsNull, Repository } from 'typeorm';
import {
  ChainConfigService,
  type SupportedChainId,
} from './chain-config.service';
import { RwaOwnerIndexCursor } from './entities/rwa-owner-index-cursor.entity';
import { RwaToken } from '../marketplace/entities/rwa-token.entity';
import { TOKENABLE_RWA_ABI } from './abis/tokenable-rwa.abi';
import { perfNow, perfLog, elapsedMs } from '../common/perf/perf';
import {
  isRpcRateLimitError,
  withRpcRateLimitRetry,
} from './rpc-retry.util';

const ZERO = '0x0000000000000000000000000000000000000000';
const ETH_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const DEFAULT_LOG_CHUNK = 4_000;
const DEFAULT_LOG_DELAY_MS = 150;
const DEFAULT_LOG_MAX_RETRIES = 6;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type TransferLogRow = {
  blockNumber: number;
  index: number;
  from: string;
  to: string;
  tokenId: number;
};

@Injectable()
export class RwaTokenOwnerIndexService {
  private readonly logger = new Logger(RwaTokenOwnerIndexService.name);

  constructor(
    @InjectRepository(RwaToken)
    private readonly rwaTokens: Repository<RwaToken>,
    @InjectRepository(RwaOwnerIndexCursor)
    private readonly cursors: Repository<RwaOwnerIndexCursor>,
    private readonly chainConfig: ChainConfigService,
    private readonly config: ConfigService,
  ) {}

  private normalizeWallet(address: string): string {
    return address.trim().toLowerCase();
  }

  private contractAddress(chainId?: SupportedChainId): string {
    return this.chainConfig.getRwaAddress(
      chainId ?? this.chainConfig.getDefaultChainId(),
    );
  }

  async isIndexReady(chainId?: SupportedChainId): Promise<boolean> {
    const contract = this.contractAddress(chainId);
    const cursor = await this.cursors.findOne({
      where: { tokenContract: contract },
      select: ['backfillComplete'],
    });
    return Boolean(cursor?.backfillComplete);
  }

  /** True while log backfill has started but not marked complete. */
  async isBackfillInProgress(chainId?: SupportedChainId): Promise<boolean> {
    const contract = this.contractAddress(chainId);
    const cursor = await this.cursors.findOne({
      where: { tokenContract: contract },
      select: ['backfillComplete', 'lastScannedBlock'],
    });
    if (!cursor || cursor.backfillComplete) return false;
    return cursor.lastScannedBlock != null;
  }

  async getTokenIdsByOwner(
    wallet: string,
    chainId?: SupportedChainId,
  ): Promise<number[]> {
    const owner = this.normalizeWallet(wallet);
    const contract = this.contractAddress(chainId);
    const rows = await this.rwaTokens.find({
      where: {
        tokenContract: contract,
        ownerWallet: owner,
        burnedAt: IsNull(),
      },
      select: ['tokenId'],
      order: { tokenId: 'ASC' },
    });
    const ids = rows
      .map((r) => Number(r.tokenId))
      .filter((id) => Number.isFinite(id) && id > 0);
    ids.sort((a, b) => a - b);
    return ids;
  }

  async recordOwner(
    tokenContract: string,
    tokenId: number | string,
    owner: string,
  ): Promise<void> {
    const contract = this.normalizeWallet(tokenContract);
    const tid = String(tokenId).trim();
    const wallet = this.normalizeWallet(owner);
    if (!tid || !ETH_ADDRESS.test(wallet)) return;

    await this.rwaTokens
      .createQueryBuilder()
      .insert()
      .into(RwaToken)
      .values({
        tokenContract: contract,
        tokenId: tid,
        ownerWallet: wallet,
        burnedAt: null,
      })
      .orUpdate(['owner_wallet', 'burned_at'], ['token_contract', 'token_id'])
      .execute();
  }

  async recordBurn(
    tokenContract: string,
    tokenId: number | string,
  ): Promise<void> {
    const contract = this.normalizeWallet(tokenContract);
    const tid = String(tokenId).trim();
    if (!tid) return;

    await this.rwaTokens
      .createQueryBuilder()
      .update(RwaToken)
      .set({ ownerWallet: null })
      .where('token_contract = :contract AND token_id = :tid', {
        contract,
        tid,
      })
      .execute();
  }

  async recordTransfer(
    tokenContract: string,
    tokenId: number | string,
    _from: string,
    to: string,
  ): Promise<void> {
    const recipient = this.normalizeWallet(to);
    if (recipient === ZERO) {
      await this.recordBurn(tokenContract, tokenId);
      return;
    }
    await this.recordOwner(tokenContract, tokenId, recipient);
  }

  /** Persist owners discovered by a full-supply ownerOf scan. */
  async persistOwnerMap(
    tokenContract: string,
    owners: Map<number, string>,
    chainId?: SupportedChainId,
  ): Promise<void> {
    const contract = this.normalizeWallet(tokenContract);
    if (owners.size === 0) return;

    const entries = [...owners.entries()].filter(
      ([id, owner]) =>
        Number.isFinite(id) && id > 0 && ETH_ADDRESS.test(owner),
    );
    if (entries.length === 0) return;

    const chunkSize = 100;
    for (let i = 0; i < entries.length; i += chunkSize) {
      const chunk = entries.slice(i, i + chunkSize);
      await this.rwaTokens
        .createQueryBuilder()
        .insert()
        .into(RwaToken)
        .values(
          chunk.map(([tokenId, ownerWallet]) => ({
            tokenContract: contract,
            tokenId: String(tokenId),
            ownerWallet: this.normalizeWallet(ownerWallet),
            burnedAt: null,
          })),
        )
        .orUpdate(['owner_wallet', 'burned_at'], ['token_contract', 'token_id'])
        .execute();
    }

    try {
      const { totalMinted } = await this.readTotalMinted(chainId);
      if (totalMinted > 0 && entries.length >= totalMinted) {
        await this.markBackfillComplete(contract);
      }
    } catch (err) {
      this.logger.warn(
        `persistOwnerMap totalMinted check skipped: ${String(err)}`,
      );
    }
  }

  async markBackfillComplete(tokenContract: string): Promise<void> {
    const contract = this.normalizeWallet(tokenContract);
    await this.cursors.save({
      tokenContract: contract,
      backfillComplete: true,
    });
    this.logger.log(`RWA owner index ready for contract ${contract}`);
  }

  async countLiveIndexedOwners(tokenContract: string): Promise<number> {
    return this.rwaTokens
      .createQueryBuilder('t')
      .where('t.token_contract = :contract', {
        contract: this.normalizeWallet(tokenContract),
      })
      .andWhere('t.owner_wallet IS NOT NULL')
      .andWhere('t.burned_at IS NULL')
      .getCount();
  }

  /**
   * Replay ERC-721 Transfer logs to populate owner_wallet.
   * Incremental when a cursor row exists; full replay from deploy block otherwise.
   */
  async backfillFromTransferLogs(
    chainId?: SupportedChainId,
    opts?: { fromBlock?: number; toBlock?: number },
  ): Promise<{ transfers: number; lastBlock: number }> {
    const id = chainId ?? this.chainConfig.getDefaultChainId();
    const contractAddr = this.contractAddress(id);
    const provider = this.chainConfig.createJsonRpcProvider(id);
    const contract = new Contract(contractAddr, TOKENABLE_RWA_ABI, provider);

    const deployBlock = this.deployBlock(id);
    if (!this.shouldBackfillChain(id, deployBlock)) {
      return { transfers: 0, lastBlock: 0 };
    }

    const cursor = await this.cursors.findOne({
      where: { tokenContract: contractAddr },
    });
    const lastScanned =
      cursor?.lastScannedBlock != null
        ? Number(cursor.lastScannedBlock)
        : Number.NaN;
    const resumeAfter =
      Number.isFinite(lastScanned) && lastScanned >= deployBlock
        ? lastScanned + 1
        : deployBlock;
    const fromBlock = Math.max(deployBlock, opts?.fromBlock ?? resumeAfter);
    const latest =
      opts?.toBlock ?? Number(await provider.getBlockNumber());
    if (fromBlock > latest) {
      return { transfers: 0, lastBlock: latest };
    }

    const chunk = this.logChunkSize();
    const delayMs = this.logDelayMs();
    const _t0 = perfNow();
    let transfers = 0;

    // `chunk` = inclusive block count per eth_getLogs (Alchemy Free max 10).
    for (let start = fromBlock; start <= latest; start += chunk) {
      const end = Math.min(start + chunk - 1, latest);
      const logs = await this.queryTransferLogs(contract, start, end);
      const batch: TransferLogRow[] = [];
      for (const log of logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (!parsed || parsed.name !== 'Transfer') continue;
          const tokenId = Number(parsed.args.tokenId);
          if (!Number.isFinite(tokenId) || tokenId <= 0) continue;
          batch.push({
            blockNumber: Number(log.blockNumber),
            index: Number(log.index),
            from: String(parsed.args.from).trim().toLowerCase(),
            to: String(parsed.args.to).trim().toLowerCase(),
            tokenId,
          });
        } catch {
          /* skip malformed */
        }
      }

      batch.sort(
        (a, b) => a.blockNumber - b.blockNumber || a.index - b.index,
      );
      for (const ev of batch) {
        await this.recordTransfer(
          contractAddr,
          ev.tokenId,
          ev.from,
          ev.to,
        );
      }
      transfers += batch.length;

      await this.cursors.save({
        tokenContract: contractAddr,
        lastScannedBlock: String(end),
        backfillComplete: cursor?.backfillComplete ?? false,
      });

      if (end < latest && delayMs > 0) {
        await sleep(delayMs);
      }
    }

    const { totalMinted } = await this.readTotalMinted(id);
    const liveOwners = await this.countLiveIndexedOwners(contractAddr);
    if (totalMinted > 0 && liveOwners >= totalMinted) {
      await this.markBackfillComplete(contractAddr);
    }

    perfLog('rpc', 'ownerIndexBackfill', elapsedMs(_t0), {
      chainId: id,
      transfers,
      fromBlock,
      toBlock: latest,
    });
    this.logger.log(
      `RWA owner index backfill chain=${id} transfers=${transfers} blocks=${fromBlock}-${latest} liveOwners=${liveOwners}/${totalMinted}`,
    );
    return { transfers, lastBlock: latest };
  }

  /** Skip non-default chains until `CHAIN_{id}_RWA_DEPLOY_BLOCK` is set (avoids genesis scan + 429). */
  shouldBackfillChain(chainId: SupportedChainId, deployBlock: number): boolean {
    if (deployBlock > 0) return true;
    const defaultId = this.chainConfig.getDefaultChainId();
    if (chainId === defaultId) return true;
    this.logger.log(
      `RWA owner index backfill skipped chain=${chainId} (set CHAIN_${chainId}_RWA_DEPLOY_BLOCK)`,
    );
    return false;
  }

  private async queryTransferLogs(
    contract: Contract,
    start: number,
    end: number,
  ) {
    const maxRetries = this.logMaxRetries();
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await contract.queryFilter(
          contract.filters.Transfer(),
          start,
          end,
        );
      } catch (err) {
        if (!isRpcRateLimitError(err) || attempt >= maxRetries) throw err;
        const waitMs = Math.min(30_000, 400 * 2 ** (attempt - 1));
        this.logger.warn(
          `owner index getLogs rate limited blocks=${start}-${end}; retry ${attempt}/${maxRetries} in ${waitMs}ms`,
        );
        await sleep(waitMs);
      }
    }
    return [];
  }

  private async readTotalMinted(
    chainId?: SupportedChainId,
  ): Promise<{ totalMinted: number }> {
    return withRpcRateLimitRetry(
      async () => {
        const id = chainId ?? this.chainConfig.getDefaultChainId();
        const provider = this.chainConfig.createJsonRpcProvider(id);
        const contract = new Contract(
          this.contractAddress(id),
          TOKENABLE_RWA_ABI,
          provider,
        );
        const totalMinted = Number(await contract.totalMinted());
        return { totalMinted: Number.isFinite(totalMinted) ? totalMinted : 0 };
      },
      { label: 'totalMinted' },
    );
  }

  private deployBlock(chainId: SupportedChainId): number {
    const raw = this.config
      .get<string>(`CHAIN_${chainId}_RWA_DEPLOY_BLOCK`)
      ?.trim();
    const n = Number(raw ?? '0');
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  }

  private logChunkSize(): number {
    const raw = this.config.get<string>('RWA_OWNER_INDEX_LOG_CHUNK')?.trim();
    const n = Number(raw ?? DEFAULT_LOG_CHUNK);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_LOG_CHUNK;
  }

  private logDelayMs(): number {
    const raw = this.config.get<string>('RWA_OWNER_INDEX_LOG_DELAY_MS')?.trim();
    const n = Number(raw ?? DEFAULT_LOG_DELAY_MS);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : DEFAULT_LOG_DELAY_MS;
  }

  private logMaxRetries(): number {
    const raw = this.config.get<string>('RWA_OWNER_INDEX_LOG_MAX_RETRIES')?.trim();
    const n = Number(raw ?? DEFAULT_LOG_MAX_RETRIES);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_LOG_MAX_RETRIES;
  }
}
