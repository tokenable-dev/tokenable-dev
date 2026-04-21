import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type CacheEntry<T> = { value: T; expiresAtMs: number };

/**
 * Single server-side IPFS read path: gateway fallbacks, retries, CID-keyed cache.
 * No browser should fetch IPFS directly — use BlockchainController endpoints.
 */
@Injectable()
export class IpfsGatewayResolverService {
  private readonly logger = new Logger(IpfsGatewayResolverService.name);

  private readonly metadataByKey = new Map<string, CacheEntry<Record<string, unknown>>>();
  private readonly httpsByImageKey = new Map<string, CacheEntry<string>>();

  constructor(private readonly config: ConfigService) {}

  private cacheTtlMs(): number {
    const sec = Number(this.config.get<string>('IPFS_RESOLVE_CACHE_TTL_SEC') ?? '3600');
    return (Number.isFinite(sec) && sec > 0 ? sec : 3600) * 1000;
  }

  private maxCacheEntries(): number {
    const n = Number(this.config.get<string>('IPFS_RESOLVE_CACHE_MAX') ?? '5000');
    return Number.isFinite(n) && n > 100 ? Math.floor(n) : 5000;
  }

  private pruneMap(map: Map<string, unknown>): void {
    const max = this.maxCacheEntries();
    if (map.size <= max) return;
    const drop = map.size - max + 100;
    let i = 0;
    for (const k of map.keys()) {
      map.delete(k);
      if (++i >= drop) break;
    }
  }

  /** Hostnames without scheme: Pinata first, then fallbacks (env or defaults). */
  getGatewayHosts(): string[] {
    const pinata =
      this.config.get<string>('PINATA_GATEWAY')?.trim() ||
      'gray-immense-roadrunner-588.mypinata.cloud';
    const raw = this.config.get<string>('IPFS_GATEWAY_FALLBACKS')?.trim();
    const defaults = 'ipfs.io,dweb.link';
    const rest = (raw || defaults)
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean);
    const hosts = [pinata, ...rest.filter((h) => h !== pinata)];
    return [...new Set(hosts)];
  }

  normalizeIpfsSubpath(rawUri: string): string | null {
    const t = rawUri.trim();
    if (!t) return null;
    if (/^ipfs:\/\//i.test(t)) {
      return t.replace(/^ipfs:\/\//i, '').replace(/^ipfs\//i, '').replace(/^\/+/, '');
    }
    if (/^https?:\/\//i.test(t)) {
      try {
        const u = new URL(t);
        const idx = u.pathname.indexOf('/ipfs/');
        if (idx === -1) return null;
        const tail = u.pathname.slice(idx + '/ipfs/'.length) + (u.search || '');
        return tail.replace(/^\/+/, '') || null;
      } catch {
        return null;
      }
    }
    if (/^(Qm[1-9A-HJ-NP-Za-km-z]{40,}|bafy[a-z2-7]{50,})$/i.test(t)) {
      return t;
    }
    return null;
  }

  private cacheKeyForMetadata(tokenUri: string): string {
    return `m:${tokenUri.trim()}`;
  }

  private cacheKeyForImage(imageRef: string): string {
    const sub = this.normalizeIpfsSubpath(imageRef);
    return sub ? `i:${sub}` : `r:${imageRef.trim()}`;
  }

  /**
   * GET JSON from ipfs:// or https-ipfs URL; gateway rotation + retriable backoff.
   */
  async fetchMetadataJson(tokenUri: string): Promise<Record<string, unknown>> {
    const key = this.cacheKeyForMetadata(tokenUri);
    const now = Date.now();
    const hit = this.metadataByKey.get(key);
    if (hit && hit.expiresAtMs > now) {
      return { ...hit.value };
    }

    const subpath = this.normalizeIpfsSubpath(tokenUri);
    if (!subpath) {
      throw new Error('Unsupported tokenURI for IPFS metadata fetch');
    }

    const json = await this.fetchJsonFromIpfsSubpath(subpath);
    this.metadataByKey.set(key, {
      value: json,
      expiresAtMs: now + this.cacheTtlMs(),
    });
    this.pruneMap(this.metadataByKey as unknown as Map<string, unknown>);
    return { ...json };
  }

  private async fetchJsonFromIpfsSubpath(subpath: string): Promise<Record<string, unknown>> {
    const hosts = this.getGatewayHosts();
    let lastErr: Error | null = null;
    for (const host of hosts) {
      const url = `https://${host}/ipfs/${subpath}`;
      try {
        const body = await this.fetchWithRetries(url, true);
        return JSON.parse(body) as Record<string, unknown>;
      } catch (e) {
        lastErr = e instanceof Error ? e : new Error(String(e));
        this.logger.debug(`metadata gateway miss ${host}: ${lastErr.message}`);
      }
    }
    throw lastErr ?? new Error('All IPFS gateways failed for metadata');
  }

  /**
   * HEAD/GET first byte check is heavy; use GET and status for image URL probing.
   */
  async resolveImageToHttps(imageRef: string | undefined): Promise<string | null> {
    if (imageRef == null || String(imageRef).trim() === '') return null;
    const raw = String(imageRef).trim();
    if (/^https?:\/\//i.test(raw) && raw.toLowerCase().includes('/ipfs/')) {
      /* fall through to subpath gateways */
    } else if (/^https?:\/\//i.test(raw) && !/^https?:\/\/[^/]+\/ipfs\//i.test(raw)) {
      return raw;
    }

    const key = this.cacheKeyForImage(raw);
    const now = Date.now();
    const hit = this.httpsByImageKey.get(key);
    if (hit && hit.expiresAtMs > now) {
      return hit.value;
    }

    const subpath = this.normalizeIpfsSubpath(raw);
    if (!subpath) {
      return /^https?:\/\//i.test(raw) ? raw : null;
    }

    const hosts = this.getGatewayHosts();
    for (const host of hosts) {
      const url = `https://${host}/ipfs/${subpath}`;
      const ok = await this.urlIsReachable(url);
      if (ok) {
        this.httpsByImageKey.set(key, {
          value: url,
          expiresAtMs: now + this.cacheTtlMs(),
        });
        this.pruneMap(this.httpsByImageKey as unknown as Map<string, unknown>);
        return url;
      }
    }
    return null;
  }

  private async urlIsReachable(url: string): Promise<boolean> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12_000);
    try {
      let res = await fetch(url, { method: 'HEAD', signal: ctrl.signal });
      if (res.status === 405) {
        res = await fetch(url, {
          headers: { Range: 'bytes=0-0' },
          signal: ctrl.signal,
        });
      }
      return res.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(t);
    }
  }

  /**
   * Resolve any display URI (ipfs, https+ipfs path, bare CID, or passthrough https) to a browser-loadable https URL when possible.
   */
  async resolveUriToHttps(uri: string): Promise<string | null> {
    const t = uri.trim();
    if (!t) return null;
    if (/^https?:\/\//i.test(t) && !t.toLowerCase().includes('/ipfs/')) {
      return t;
    }
    return this.resolveImageToHttps(t);
  }

  private async fetchWithRetries(url: string, isJson: boolean): Promise<string> {
    const maxAttempts = 6;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await fetch(url, {
        headers: isJson ? { Accept: 'application/json' } : undefined,
      });
      if (res.ok) {
        return await res.text();
      }
      const retriable =
        res.status === 429 ||
        res.status === 408 ||
        res.status === 500 ||
        res.status === 502 ||
        res.status === 503 ||
        res.status === 504;
      if (!retriable || attempt === maxAttempts - 1) {
        throw new Error(`HTTP ${res.status} for ${url}`);
      }
      let delayMs = 900 * Math.pow(2, attempt) + Math.floor(Math.random() * 350);
      const ra = res.headers.get('retry-after');
      if (ra && /^\d+$/.test(ra.trim())) {
        delayMs = Math.max(delayMs, Math.min(60_000, parseInt(ra.trim(), 10) * 1000));
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
    throw new Error('fetchWithRetries exhausted');
  }
}
