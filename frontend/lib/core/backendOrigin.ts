import os from "os";

const DEFAULT_BACKEND_PORT = 4000;

/**
 * Origin for Next → Nest proxy / SSR fetches (no `/api` suffix).
 * Prefers API_PROXY_TARGET; otherwise first non-internal IPv4 (avoids IDE owning 127.0.0.1:4000).
 */
export function backendOrigin(port = DEFAULT_BACKEND_PORT): string {
  const explicit = process.env.API_PROXY_TARGET?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  try {
    const nets = os.networkInterfaces();
    for (const addrs of Object.values(nets)) {
      if (!addrs) continue;
      for (const addr of addrs) {
        if (addr.family !== "IPv4" || addr.internal) continue;
        return `http://${addr.address}:${port}`;
      }
    }
  } catch {
    // Sandboxed build / restricted env — fall back to loopback.
  }
  return `http://127.0.0.1:${port}`;
}

/** Nest global prefix included — for server-side fetch only. */
export function internalApiUrl(port = DEFAULT_BACKEND_PORT): string {
  const explicit = process.env.INTERNAL_API_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  return `${backendOrigin(port)}/api`;
}
