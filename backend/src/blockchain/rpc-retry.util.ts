const DEFAULT_MAX_RETRIES = 6;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** True when the RPC provider throttled the request (Alchemy Free CU/s, etc.). */
export function isRpcRateLimitError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return /429|rate limit|compute units per second|too many requests/i.test(
      String(err),
    );
  }
  const e = err as {
    code?: unknown;
    message?: string;
    shortMessage?: string;
    info?: { error?: { code?: unknown; message?: string } };
  };
  const code = e.info?.error?.code ?? e.code;
  if (code === 429 || code === '429') return true;
  const blob = `${e.message ?? ''} ${e.shortMessage ?? ''} ${e.info?.error?.message ?? ''}`;
  return /429|rate limit|compute units per second|too many requests/i.test(blob);
}

/** Retry read-only RPC calls when the provider returns 429 / CU throttling. */
export async function withRpcRateLimitRetry<T>(
  fn: () => Promise<T>,
  opts?: { maxRetries?: number; label?: string },
): Promise<T> {
  const maxRetries = opts?.maxRetries ?? DEFAULT_MAX_RETRIES;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRpcRateLimitError(err) || attempt >= maxRetries) throw err;
      const waitMs = Math.min(30_000, 400 * 2 ** (attempt - 1));
      await sleep(waitMs);
    }
  }
  throw lastErr;
}

/** Max in-flight JSON-RPC calls (Alchemy Free default: 2). */
export function rpcMaxConcurrency(): number {
  const raw = process.env.RPC_MAX_CONCURRENCY;
  if (!raw) return 2;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 8) : 2;
}

/** Pause between batched RPC chunks (ms). */
export function rpcBatchChunkDelayMs(): number {
  const raw = process.env.RPC_BATCH_CHUNK_DELAY_MS;
  if (!raw) return 250;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 250;
}

/** Parallel `ownerOf` calls during full-supply wallet scans. */
export function rpcOwnerScanConcurrency(): number {
  const raw = process.env.RPC_OWNER_SCAN_CONCURRENCY;
  if (!raw) return 4;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 16) : 4;
}

/** Parallel on-chain `tokenURI` reads in metadata batch. */
export function rpcMetadataBatchConcurrency(): number {
  const raw = process.env.RPC_METADATA_BATCH_CONCURRENCY;
  if (!raw) return 2;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.min(Math.floor(n), 8) : 2;
}

class RpcSemaphore {
  private inflight = 0;
  private readonly queue: Array<() => void> = [];

  constructor(private readonly max: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.inflight < this.max) {
      this.inflight++;
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      this.queue.push(() => {
        this.inflight++;
        resolve();
      });
    });
  }

  private release(): void {
    this.inflight--;
    const next = this.queue.shift();
    if (next) next();
  }
}

let globalRpcSemaphore: RpcSemaphore | null = null;

function rpcSemaphore(): RpcSemaphore {
  if (!globalRpcSemaphore) {
    globalRpcSemaphore = new RpcSemaphore(rpcMaxConcurrency());
  }
  return globalRpcSemaphore;
}

/** Global concurrency cap + 429 backoff — use for all Alchemy JSON-RPC calls. */
export async function withRpcProviderCall<T>(
  fn: () => Promise<T>,
  opts?: { maxRetries?: number; label?: string },
): Promise<T> {
  return rpcSemaphore().run(() => withRpcRateLimitRetry(fn, opts));
}

/** Reset semaphore between unit tests. */
export function resetRpcSemaphoreForTests(): void {
  globalRpcSemaphore = null;
}
