/**
 * Browser: same-origin `/api` via Next rewrites (leave NEXT_PUBLIC_API_URL unset).
 * Server/SSR: INTERNAL_API_URL, else API_PROXY_TARGET / http://127.0.0.1:4100 (dev) or :4000 (prod).
 * Set NEXT_PUBLIC_API_URL only when the API is on a different host.
 */
export function getApiUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`;
  }
  const { internalApiUrl } =
    require("@/lib/core/backendOrigin") as typeof import("@/lib/core/backendOrigin");
  return internalApiUrl();
}

import { getActiveChainIdForApi, CHAIN_ID_HEADER } from "@/lib/chains/apiHeader";

const DEFAULT_API_FETCH_TIMEOUT_MS = 25_000;

export type BackendFetchInit = RequestInit & { timeoutMs?: number };
/** Retry count after the first attempt (2 retries = 3 total attempts). */
const TRANSIENT_NETWORK_RETRY_COUNT = 2;
const TRANSIENT_NETWORK_RETRY_BASE_MS = 400;

function mergeAbortSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (a.aborted) return a;
  if (b.aborted) return b;
  const merged = new AbortController();
  const onAbort = () => merged.abort();
  a.addEventListener("abort", onAbort);
  b.addEventListener("abort", onAbort);
  return merged.signal;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function errorCauseCode(err: unknown): string | undefined {
  if (!err || typeof err !== "object" || !("cause" in err)) return undefined;
  const cause = (err as { cause?: unknown }).cause;
  if (!cause || typeof cause !== "object" || !("code" in cause)) return undefined;
  const code = (cause as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/** True for proxy/backend blips (restart, socket hang up, refused). */
function isTransientNetworkError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === "AbortError") return false;
  const code = errorCauseCode(err);
  if (code === "ECONNRESET" || code === "ECONNREFUSED" || code === "EPIPE") {
    return true;
  }
  if (err instanceof TypeError) return true;
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("socket hang up") ||
      msg.includes("econnreset") ||
      msg.includes("fetch failed") ||
      msg.includes("cannot reach api")
    );
  }
  return false;
}

function toBackendFetchError(err: unknown, url: string, timeoutMs: number): Error {
  if (err instanceof DOMException && err.name === "AbortError") {
    return new Error(
      `API request timed out after ${Math.round(timeoutMs / 1000)}s (${url}). Is the backend running on ${getApiUrl()}?`,
    );
  }
  if (isTransientNetworkError(err)) {
    return new Error(
      `Cannot reach API at ${url}. Start the Nest backend (pnpm start:dev in backend/) and Postgres.`,
    );
  }
  return err instanceof Error ? err : new Error(String(err));
}

async function backendFetchOnce(url: string, init?: BackendFetchInit): Promise<Response> {
  const timeoutMs = init?.timeoutMs ?? DEFAULT_API_FETCH_TIMEOUT_MS;
  const { timeoutMs: _timeoutMs, ...fetchInit } = init ?? {};
  const activeChainId = getActiveChainIdForApi();
  const headers = new Headers(fetchInit.headers);
  if (activeChainId != null && !headers.has(CHAIN_ID_HEADER)) {
    headers.set(CHAIN_ID_HEADER, String(activeChainId));
  }
  const timeoutSignal =
    typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(timeoutMs)
      : null;
  const signal =
    fetchInit.signal && timeoutSignal
      ? mergeAbortSignals(fetchInit.signal, timeoutSignal)
      : fetchInit.signal ?? timeoutSignal ?? undefined;

  try {
    return await fetch(url, { ...fetchInit, headers, credentials: "include", signal });
  } catch (err) {
    throw toBackendFetchError(err, url, timeoutMs);
  }
}

export async function backendFetch(url: string, init?: BackendFetchInit): Promise<Response> {
  let lastError: unknown;
  const maxAttempts = TRANSIENT_NETWORK_RETRY_COUNT + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await backendFetchOnce(url, init);
    } catch (err) {
      lastError = err;
      const canRetry =
        attempt < maxAttempts - 1 &&
        isTransientNetworkError(err) &&
        !init?.signal?.aborted;
      if (!canRetry) throw err;
      await sleep(TRANSIENT_NETWORK_RETRY_BASE_MS * (attempt + 1));
    }
  }

  throw lastError;
}
