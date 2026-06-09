import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CardhedgerService } from './cardhedger.service';
import {
  CardTop100DailySnapshot,
  type Top100Card,
} from './entities/card-top100-snapshot.entity';

// ─── Constants ────────────────────────────────────────────────────────────

export const FALLBACK_CATEGORIES = [
  'Pokemon',
  'Baseball',
  'Basketball',
  'Football',
] as const;

export const TOP100_GRADE = 'PSA 10';
const DISCOVERY_PAGE_SIZE = 500;
const TOP100_PAGE_SIZE = 100;

const CATEGORY_CACHE_PATH = path.join(
  os.tmpdir(),
  'card-top100-categories.json',
);
const CATEGORY_CACHE_VERSION = 1;

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Returns today's date in Asia/Seoul timezone as YYYY-MM-DD. */
function kstToday(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

// ─── Response types ───────────────────────────────────────────────────────

export type Top100Response = {
  category: string;
  grade: string;
  cards: Top100Card[];
  totalPages: number;
  snapshotDate: string;
  fetchedAt: string;
  /** True when serving a previous day's data because today's row is missing. */
  stale: boolean;
};

export type CategoriesResponse = {
  categories: string[];
  discoveredAt: string | null;
  source: 'live' | 'cache' | 'fallback';
};

type CardhedgerPageResponse = {
  page: number;
  pages: number;
  cards: Top100Card[];
};

// ─── Service ─────────────────────────────────────────────────────────────

@Injectable()
export class CardTop100Service implements OnApplicationBootstrap {
  private readonly logger = new Logger(CardTop100Service.name);

  /**
   * In-memory SWR layer: keyed by category (stores only today's data).
   * Cleared at midnight KST so the next request re-reads from DB.
   */
  private cache = new Map<string, Top100Response>();
  private cacheDateKst: string = kstToday();

  private knownCategories: string[] = [...FALLBACK_CATEGORIES];
  private categoriesDiscoveredAt: Date | null = null;

  constructor(
    private readonly cardhedger: CardhedgerService,
    @InjectRepository(CardTop100DailySnapshot)
    private readonly repo: Repository<CardTop100DailySnapshot>,
  ) {}

  // ─── Bootstrap ───────────────────────────────────────────────────────────

  async onApplicationBootstrap(): Promise<void> {
    this.hydrateCategoriesFromDisk();
    await this.warmCacheFromDb();
    void this.ensureTodayDataExists();
  }

  /**
   * Load today's rows from DB into memory.
   * Also registers any extra categories found in the DB.
   */
  private async warmCacheFromDb(): Promise<void> {
    const today = kstToday();
    try {
      const rows = await this.repo.find({
        where: { snapshotDateKst: today, grade: TOP100_GRADE },
      });
      for (const row of rows) {
        if (row.cardsJson.length > 0) {
          this.cache.set(row.category, this.rowToResponse(row, false));
          if (!this.knownCategories.includes(row.category)) {
            this.knownCategories.push(row.category);
          }
        }
      }
      this.logger.log(
        `Card Top100: warmed ${this.cache.size} categories from DB (date=${today})`,
      );
    } catch (err) {
      this.logger.warn(
        `Card Top100: DB warm failed — ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  /**
   * For any known category that doesn't have today's row yet, trigger a
   * background fetch so users never see empty data after a server restart.
   */
  private async ensureTodayDataExists(): Promise<void> {
    const today = kstToday();
    for (const category of this.knownCategories) {
      if (!this.cache.has(category)) {
        this.logger.log(
          `Card Top100: [${category}] missing today's row (${today}) — fetching now`,
        );
        try {
          await this.fetchAndInsert(category, today);
        } catch (err) {
          this.logger.error(
            `Card Top100: [${category}] bootstrap fetch failed — ${err instanceof Error ? err.message : err}`,
          );
        }
      }
    }
  }

  // ─── Cron ────────────────────────────────────────────────────────────────

  /**
   * Daily at 09:00 KST.
   * 1. Discover all live categories.
   * 2. Insert today's top-100 for each (skips if row already exists).
   */
  @Cron('0 0 9 * * *', { timeZone: 'Asia/Seoul' })
  async scheduledRefresh(): Promise<void> {
    this.logger.log('Card Top100: daily refresh — discovering categories');
    this.invalidateDayCache(); // clear stale in-memory cache from yesterday
    const categories = await this.discoverCategoriesLive();
    const today = kstToday();

    for (const category of categories) {
      try {
        await this.fetchAndInsert(category, today);
      } catch (err) {
        this.logger.error(
          `Card Top100: [${category}] daily insert failed — ${err instanceof Error ? err.message : err}`,
        );
      }
    }
    this.logger.log('Card Top100: daily refresh complete');
  }

  // ─── Public API ──────────────────────────────────────────────────────────

  getCategories(): CategoriesResponse {
    return {
      categories: [...this.knownCategories],
      discoveredAt: this.categoriesDiscoveredAt?.toISOString() ?? null,
      source: this.categoriesDiscoveredAt ? 'cache' : 'fallback',
    };
  }

  async getTop100(category: string): Promise<Top100Response> {
    this.invalidateDayCache();

    // 1. Fast path: in-memory (today's data)
    const cached = this.cache.get(category);
    if (cached) return cached;

    const today = kstToday();

    // 2. DB: today's row
    try {
      const row = await this.repo.findOne({
        where: { snapshotDateKst: today, category, grade: TOP100_GRADE },
      });
      if (row && row.cardsJson.length > 0) {
        const resp = this.rowToResponse(row, false);
        this.cache.set(category, resp);
        return resp;
      }
    } catch {
      // fall through
    }

    // 3. DB: most recent row (yesterday or earlier) — serve stale while fetching
    try {
      const latest = await this.repo.findOne({
        where: { category, grade: TOP100_GRADE },
        order: { snapshotDateKst: 'DESC' },
      });
      if (latest && latest.cardsJson.length > 0) {
        this.logger.log(
          `Card Top100: [${category}] serving stale row from ${latest.snapshotDateKst} — fetching today's`,
        );
        // Async refresh without blocking the response
        void this.fetchAndInsert(category, today).catch(() => undefined);
        return this.rowToResponse(latest, true);
      }
    } catch {
      // fall through
    }

    // 4. Nothing in DB — live fetch (blocks until complete)
    return this.fetchAndInsert(category, today);
  }

  /**
   * Returns all historical snapshots for a category, newest first.
   * Useful for future charting / trend features.
   */
  async getHistory(category: string, limit = 90): Promise<Top100Response[]> {
    const rows = await this.repo.find({
      where: { category, grade: TOP100_GRADE },
      order: { snapshotDateKst: 'DESC' },
      take: limit,
    });
    return rows.map((r) => this.rowToResponse(r, false));
  }

  async forceRefresh(category: string): Promise<Top100Response> {
    const today = kstToday();
    // Delete today's existing row so we insert a fresh one
    await this.repo.delete({
      snapshotDateKst: today,
      category,
      grade: TOP100_GRADE,
    });
    this.cache.delete(category);
    return this.fetchAndInsert(category, today);
  }

  async forceRefreshAll(): Promise<{ refreshed: string[]; failed: string[] }> {
    const categories = await this.discoverCategoriesLive();
    const today = kstToday();
    const refreshed: string[] = [];
    const failed: string[] = [];

    for (const category of categories) {
      try {
        await this.repo.delete({
          snapshotDateKst: today,
          category,
          grade: TOP100_GRADE,
        });
        this.cache.delete(category);
        await this.fetchAndInsert(category, today);
        refreshed.push(category);
      } catch {
        failed.push(category);
      }
    }
    return { refreshed, failed };
  }

  async discoverCategoriesLive(): Promise<string[]> {
    try {
      const raw = (await this.cardhedger.forwardJson(
        'POST',
        '/v1/cards/90day-prices-by-grade',
        { body: { grade: TOP100_GRADE, page: 1, page_size: DISCOVERY_PAGE_SIZE } },
      )) as CardhedgerPageResponse;

      const seen = new Set<string>();
      for (const card of Array.isArray(raw.cards) ? raw.cards : []) {
        if (card.category && typeof card.category === 'string') {
          seen.add(card.category);
        }
      }

      if (seen.size === 0) {
        this.logger.warn('Card Top100: discovery returned 0 categories — keeping existing list');
        return [...this.knownCategories];
      }

      const discovered = [...seen].sort();
      this.knownCategories = discovered;
      this.categoriesDiscoveredAt = new Date();
      this.writeCategoryDiskCache(discovered);
      this.logger.log(`Card Top100: discovered categories: ${discovered.join(', ')}`);
      return discovered;
    } catch (err) {
      this.logger.warn(
        `Card Top100: discovery failed — ${err instanceof Error ? err.message : err}. Using existing list.`,
      );
      return [...this.knownCategories];
    }
  }

  // ─── Internal ────────────────────────────────────────────────────────────

  /**
   * Fetch from CardHedger and INSERT a new daily row.
   * If a row for (today, category, grade) already exists, skips the insert
   * and returns the existing row (idempotent).
   */
  private async fetchAndInsert(
    category: string,
    dateKst: string,
  ): Promise<Top100Response> {
    // Guard: if row already exists for this date, skip fetch
    const existing = await this.repo.findOne({
      where: { snapshotDateKst: dateKst, category, grade: TOP100_GRADE },
    });
    if (existing && existing.cardsJson.length > 0) {
      const resp = this.rowToResponse(existing, false);
      this.cache.set(category, resp);
      return resp;
    }

    const started = Date.now();
    const raw = (await this.cardhedger.forwardJson(
      'POST',
      '/v1/cards/90day-prices-by-grade',
      { body: { grade: TOP100_GRADE, category, page: 1, page_size: TOP100_PAGE_SIZE } },
    )) as CardhedgerPageResponse;

    const cards: Top100Card[] = Array.isArray(raw.cards) ? raw.cards : [];
    const totalPages = typeof raw.pages === 'number' ? raw.pages : 0;
    const fetchedAt = new Date();

    const row = this.repo.create({
      snapshotDateKst: dateKst,
      category,
      grade: TOP100_GRADE,
      cardsJson: cards,
      totalPages,
      fetchedAt,
    });
    await this.repo.save(row);

    if (!this.knownCategories.includes(category)) {
      this.knownCategories = [...this.knownCategories, category].sort();
    }

    const resp = this.rowToResponse(row, false);
    this.cache.set(category, resp);

    this.logger.log(
      `Card Top100: [${category}] date=${dateKst} — inserted ${cards.length} cards in ${Date.now() - started}ms`,
    );
    return resp;
  }

  private rowToResponse(
    row: CardTop100DailySnapshot,
    stale: boolean,
  ): Top100Response {
    return {
      category: row.category,
      grade: row.grade,
      cards: row.cardsJson,
      totalPages: row.totalPages,
      snapshotDate: row.snapshotDateKst,
      fetchedAt: row.fetchedAt.toISOString(),
      stale,
    };
  }

  /**
   * Invalidates in-memory cache when the KST date rolls over midnight.
   * Called lazily on every read so no timer is needed.
   */
  private invalidateDayCache(): void {
    const today = kstToday();
    if (this.cacheDateKst !== today) {
      this.logger.log(
        `Card Top100: KST date changed ${this.cacheDateKst} → ${today} — clearing memory cache`,
      );
      this.cache.clear();
      this.cacheDateKst = today;
    }
  }

  private hydrateCategoriesFromDisk(): void {
    try {
      if (!fs.existsSync(CATEGORY_CACHE_PATH)) return;
      const raw = fs.readFileSync(CATEGORY_CACHE_PATH, 'utf8');
      const parsed = JSON.parse(raw) as {
        version?: number;
        categories?: string[];
        discoveredAt?: string;
      };
      if (parsed.version !== CATEGORY_CACHE_VERSION) return;
      if (!Array.isArray(parsed.categories) || parsed.categories.length === 0) return;
      this.knownCategories = parsed.categories;
      this.categoriesDiscoveredAt = parsed.discoveredAt
        ? new Date(parsed.discoveredAt)
        : null;
      this.logger.log(
        `Card Top100: hydrated ${this.knownCategories.length} categories from disk`,
      );
    } catch {
      // non-critical
    }
  }

  private writeCategoryDiskCache(categories: string[]): void {
    try {
      fs.writeFileSync(
        CATEGORY_CACHE_PATH,
        JSON.stringify({
          version: CATEGORY_CACHE_VERSION,
          categories,
          discoveredAt: this.categoriesDiscoveredAt?.toISOString(),
        }),
        'utf8',
      );
    } catch {
      // non-critical
    }
  }
}
