import { Injectable, Logger } from '@nestjs/common';

export type CatalogNameLocale = 'ja' | 'zh-CN' | 'zh-TW';

const CACHE_LIMIT = 4000;
const FETCH_LIMIT = 6;

/**
 * Display cache for catalog phrases. Not written to the database.
 * The client sends card-name leftovers, set names, and variants only.
 */
@Injectable()
export class CatalogNameTranslationService {
  private readonly logger = new Logger(CatalogNameTranslationService.name);
  private readonly cache = new Map<string, string>();
  private readonly pending = new Map<string, Promise<{ text: string; store: boolean }>>();

  async translate(
    locale: CatalogNameLocale,
    texts: string[],
  ): Promise<Record<string, string>> {
    const unique = [
      ...new Set(
        texts
          .map((text) => text.trim())
          .filter((text) => text.length > 0 && text.length <= 180 && !text.includes('\n')),
      ),
    ].slice(0, 40);
    const out: Record<string, string> = {};
    await this.mapPool(unique, FETCH_LIMIT, async (text) => {
      out[text] = await this.one(locale, text);
    });
    return out;
  }

  private async one(locale: CatalogNameLocale, text: string): Promise<string> {
    const key = `${locale}\0${text}`;
    const hit = this.cache.get(key);
    if (hit != null) return hit;
    if (this.cache.size >= CACHE_LIMIT) return text;
    let job = this.pending.get(key);
    if (!job) {
      const created = this.fetchOne(locale, text).finally(() => {
        this.pending.delete(key);
      });
      this.pending.set(key, created);
      job = created;
    }
    const result = await job;
    if (result.store) this.cache.set(key, result.text);
    return result.text;
  }

  private async fetchOne(
    locale: CatalogNameLocale,
    text: string,
  ): Promise<{ text: string; store: boolean }> {
    const url =
      'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=' +
      `${encodeURIComponent(locale)}&dt=t&q=${encodeURIComponent(text)}`;
    try {
      const res = await fetch(url, {
        headers: { accept: 'application/json', 'user-agent': 'TokenableCatalog/1.0' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return { text, store: false };
      const translated = readGoogleTranslation(await res.json());
      if (!translated) return { text, store: false };
      return { text: translated, store: true };
    } catch (err) {
      this.logger.warn(
        `Catalog name translation failed (${locale}): ${err instanceof Error ? err.message : String(err)}`,
      );
      return { text, store: false };
    }
  }

  private async mapPool<T>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<void>,
  ): Promise<void> {
    if (items.length === 0) return;
    let cursor = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor;
        cursor += 1;
        await fn(items[index] as T);
      }
    });
    await Promise.all(workers);
  }
}

function readGoogleTranslation(body: unknown): string | null {
  if (!Array.isArray(body) || !Array.isArray(body[0])) return null;
  const chunks: string[] = [];
  for (const part of body[0]) {
    if (Array.isArray(part) && typeof part[0] === 'string' && part[0]) chunks.push(part[0]);
  }
  const text = chunks.join('').trim();
  return text || null;
}
