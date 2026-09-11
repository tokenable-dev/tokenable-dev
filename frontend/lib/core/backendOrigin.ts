/** Nest listen port in production / Docker (see backend `app.config`). */
export const PRODUCTION_BACKEND_PORT = 4000;

/**
 * Local dev port — Cursor/VS Code often forwards `127.0.0.1:4000`, blocking Next rewrites.
 * Backend defaults to the same port in development (`app.config.ts`).
 */
export const LOCAL_DEV_BACKEND_PORT = 4100;

const defaultPort =
  process.env.NODE_ENV === "production"
    ? PRODUCTION_BACKEND_PORT
    : LOCAL_DEV_BACKEND_PORT;

const DEFAULT_BACKEND_ORIGIN = `http://127.0.0.1:${defaultPort}`;

/**
 * Origin for Next → Nest rewrites and server-side fetch (no `/api` suffix).
 * Set `API_PROXY_TARGET` for Docker/CI (e.g. `http://backend:4000`).
 */
export function backendOrigin(port = defaultPort): string {
  const explicit = process.env.API_PROXY_TARGET?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return `http://127.0.0.1:${port}`;
}

/** Nest global prefix included — for server-side fetch only. */
export function internalApiUrl(port = defaultPort): string {
  const explicit = process.env.INTERNAL_API_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return `${backendOrigin(port)}/api`;
}
