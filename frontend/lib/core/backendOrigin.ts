const DEFAULT_BACKEND_PORT = 4000;
const DEFAULT_BACKEND_ORIGIN = `http://127.0.0.1:${DEFAULT_BACKEND_PORT}`;

/**
 * Origin for Next → Nest rewrites and server-side fetch (no `/api` suffix).
 * Set `API_PROXY_TARGET` for Docker/CI (e.g. `http://backend:4000`).
 */
export function backendOrigin(port = DEFAULT_BACKEND_PORT): string {
  const explicit = process.env.API_PROXY_TARGET?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  if (port !== DEFAULT_BACKEND_PORT) {
    return `http://127.0.0.1:${port}`;
  }
  return DEFAULT_BACKEND_ORIGIN;
}

/** Nest global prefix included — for server-side fetch only. */
export function internalApiUrl(port = DEFAULT_BACKEND_PORT): string {
  const explicit = process.env.INTERNAL_API_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return `${backendOrigin(port)}/api`;
}
