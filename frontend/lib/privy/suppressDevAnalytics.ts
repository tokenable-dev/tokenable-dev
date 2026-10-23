const PRIVY_ANALYTICS_PATH = "auth.privy.io/api/v1/analytics_events";

/**
 * Privy SDK sends background POSTs to `/api/v1/analytics_events`.
 * If `http://localhost:3000` is missing from Dashboard → Allowed domains,
 * Privy returns 422 and the browser logs CORS / net::ERR_FAILED noise.
 * Auth still works; the errors are telemetry-only (see Privy docs).
 *
 * In local dev we short-circuit those requests before they hit the network.
 * Set `NEXT_PUBLIC_PRIVY_ANALYTICS=true` to disable this shim and test telemetry.
 *
 * Permanent fix: Privy Dashboard → Configuration → Allowed domains → `http://localhost:3000`
 */
export function installPrivyDevAnalyticsSuppressor(): void {
  if (typeof window === "undefined") return;
  if (process.env.NODE_ENV !== "development") return;
  if (process.env.NEXT_PUBLIC_PRIVY_ANALYTICS === "true") return;

  const host = window.location.hostname;
  if (host !== "localhost" && host !== "127.0.0.1") return;

  const w = window as Window & { __privyAnalyticsFetchPatched?: boolean };
  if (w.__privyAnalyticsFetchPatched) return;
  w.__privyAnalyticsFetchPatched = true;

  const nativeFetch = window.fetch.bind(window);

  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;

    if (url.includes(PRIVY_ANALYTICS_PATH)) {
      return Promise.resolve(new Response(null, { status: 204 }));
    }

    return nativeFetch(input, init);
  };
}
