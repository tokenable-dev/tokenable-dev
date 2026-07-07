import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CollectionService,
  type CollectionSummary,
} from '../collections/collection.service';
import type { SupportedChainId } from '../../blockchain/chain-config.service';
import { UserWatchlist } from '../entities/user-watchlist.entity';

const MAX_WATCHLIST_ITEMS = 200;

@Injectable()
export class WatchlistService {
  constructor(
    @InjectRepository(UserWatchlist)
    private readonly watchlist: Repository<UserWatchlist>,
    private readonly collections: CollectionService,
  ) {}

  private normalizeKey(raw: string): string {
    const key = decodeURIComponent(raw).trim().toLowerCase();
    if (!key) {
      throw new BadRequestException('collectionKey is required');
    }
    return key;
  }

  async listForUser(
    userId: string,
    chainId?: SupportedChainId,
  ): Promise<{
    collectionKeys: string[];
    items: CollectionSummary[];
  }> {
    const rows = await this.watchlist.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: MAX_WATCHLIST_ITEMS,
    });
    const collectionKeys = rows.map((r) => r.collectionKey);
    const items = await this.collections.listSummariesByKeys(
      collectionKeys,
      chainId,
    );
    return { collectionKeys, items };
  }

  async listKeySetForUser(userId: string): Promise<Set<string>> {
    const rows = await this.watchlist.find({
      where: { userId },
      select: ['collectionKey'],
      take: MAX_WATCHLIST_ITEMS,
    });
    return new Set(rows.map((r) => r.collectionKey.toLowerCase()));
  }

  async add(userId: string, rawKey: string): Promise<{ collectionKey: string }> {
    const collectionKey = this.normalizeKey(rawKey);
    const row = await this.collections.findOne(collectionKey);
    if (!row) {
      throw new NotFoundException('Collection not found');
    }

    const count = await this.watchlist.count({ where: { userId } });
    const existing = await this.watchlist.findOne({
      where: { userId, collectionKey },
    });
    if (!existing && count >= MAX_WATCHLIST_ITEMS) {
      throw new BadRequestException('Watchlist limit reached');
    }

    await this.watchlist.upsert({ userId, collectionKey }, [
      'userId',
      'collectionKey',
    ]);
    return { collectionKey };
  }

  async remove(userId: string, rawKey: string): Promise<void> {
    const collectionKey = this.normalizeKey(rawKey);
    await this.watchlist.delete({ userId, collectionKey });
  }
}
