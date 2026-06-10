import os from "os";
import { backendOrigin, LOCAL_DEV_BACKEND_PORT } from "./backendOrigin";

/** Loopback ports to try — 4100 avoids Cursor forwarding on 4000. */
const LOOPBACK_PORTS = [LOCAL_DEV_BACKEND_PORT, 4000] as const;

let cachedOrigin: string | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 30_000;

function originFromHostPort(host: string, port: number): string {
  return `http://${host}:${port}`;
}

function firstLanIpv4(): string | null {
  const ifaces = os.networkInterfaces();
  for (const entries of Object.values(ifaces)) {
    if (!entries) continue;
    for (const entry of entries) {
      const family = entry.family as string | number;
      const isIpv4 = family === "IPv4" || family === 4;
      if (isIpv4 && !entry.internal) return entry.address;
    }
  }
  return null;
}

/** Dev probe order: loopback 4100 → LAN:4000 (Nest on *:4000) → loopback 4000 (short). */
function devOriginCandidates(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (origin: string) => {
    if (!seen.has(origin)) {
      seen.add(origin);
      out.push(origin);
    }
  };

  push(originFromHostPort("127.0.0.1", LOCAL_DEV_BACKEND_PORT));

  const lan = firstLanIpv4();
  if (lan) {
    push(originFromHostPort(lan, 4000));
    push(originFromHostPort(lan, LOCAL_DEV_BACKEND_PORT));
  }

  push(originFromHostPort("127.0.0.1", 4000));

  return out;
}

function probeTimeoutMs(origin: string): number {
  if (origin.includes(":4000") && origin.includes("127.0.0.1")) return 500;
  return 2_000;
}

async function probeOrigin(origin: string): Promise<boolean> {
  const timeoutMs = probeTimeoutMs(origin);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${origin}/api/health`, {
      signal: controller.signal,
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Picks a reachable Nest origin in local dev.
 * Production / Docker: `API_PROXY_TARGET` or `backendOrigin()`.
 */
export async function resolveBackendOrigin(): Promise<string> {
  const explicit = process.env.API_PROXY_TARGET?.trim();
  if (explicit) return explicit.replace(/\/$/, "");

  if (process.env.NODE_ENV === "production") {
    return backendOrigin();
  }

  const now = Date.now();
  if (cachedOrigin && now - cachedAt < CACHE_TTL_MS) {
    return cachedOrigin;
  }

  for (const candidate of devOriginCandidates()) {
    if (await probeOrigin(candidate)) {
      cachedOrigin = candidate;
      cachedAt = now;
      return candidate;
    }
  }

  return originFromHostPort("127.0.0.1", LOCAL_DEV_BACKEND_PORT);
}

/** Clears probe cache (e.g. after backend restart). */
export function resetBackendOriginCache(): void {
  cachedOrigin = null;
  cachedAt = 0;
}
