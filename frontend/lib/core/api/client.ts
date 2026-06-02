/**
 * EC2+Nginx: leave NEXT_PUBLIC_API_URL unset so the browser uses
 * `window.location.origin + '/api'` (IP, http/https domain; avoids mixed content).
 * Set NEXT_PUBLIC_API_URL only when the API is on a different host.
 * Server/SSR: INTERNAL_API_URL or direct backend URL.
 */
export function getApiUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return `${window.location.origin}/api`;
  }
  // Server-only: `backendOrigin` uses `os` — must not be a static client import.
  const { internalApiUrl } =
    require("@/lib/core/backendOrigin") as typeof import("@/lib/core/backendOrigin");
  return internalApiUrl();
}

const DEFAULT_API_FETCH_TIMEOUT_MS = 25_000;

function mergeAbortSignals(a: AbortSignal, b: AbortSignal): AbortSignal {
  if (a.aborted) return a;
  if (b.aborted) return b;
  const merged = new AbortController();
  const onAbort = () => merged.abort();
  a.addEventListener("abort", onAbort);
  b.addEventListener("abort", onAbort);
  return merged.signal;
}

export function backendFetch(url: string, init?: RequestInit): Promise<Response> {
  const timeoutMs = DEFAULT_API_FETCH_TIMEOUT_MS;
  const timeoutSignal =
    typeof AbortSignal !== "undefined" && "timeout" in AbortSignal
      ? AbortSignal.timeout(timeoutMs)
      : null;
  const signal =
    init?.signal && timeoutSignal
      ? mergeAbortSignals(init.signal, timeoutSignal)
      : init?.signal ?? timeoutSignal ?? undefined;

  return fetch(url, { ...init, credentials: "include", signal }).catch((err) => {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error(
        `API request timed out after ${Math.round(timeoutMs / 1000)}s (${url}). Is the backend running on ${getApiUrl()}?`,
      );
    }
    if (err instanceof TypeError) {
      throw new Error(
        `Cannot reach API at ${url}. Start the Nest backend (pnpm start:dev in backend/) and Postgres.`,
      );
    }
    throw err;
  });
}
