export const SITE_ACCESS_COOKIE = "site_access";

export type SiteAccessConfig = {
  enabled: boolean;
  password: string;
  secret: string;
  sessionSeconds: number;
};

export function readSiteAccessConfig(): SiteAccessConfig {
  return {
    enabled: parseTruthy(process.env.SITE_ACCESS_ENABLED),
    password: process.env.SITE_ACCESS_PASSWORD?.trim() ?? "",
    secret: process.env.SITE_ACCESS_SECRET?.trim() ?? "",
    sessionSeconds: clampInt(process.env.SITE_ACCESS_SESSION_SECONDS, 3600, 60, 86_400),
  };
}

export function isSiteAccessEnabled(): boolean {
  return readSiteAccessConfig().enabled;
}

export function isSiteAccessPublicPath(pathname: string, method: string): boolean {
  if (pathname === "/site-access") return true;
  if (pathname === "/site-access/verify" && method.toUpperCase() === "POST") {
    return true;
  }
  if (pathname === "/api/site-access/verify" && method.toUpperCase() === "POST") {
    return true;
  }
  if (pathname === "/api/health" && method.toUpperCase() === "GET") {
    return true;
  }
  if (pathname.startsWith("/auth/")) return true;
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/assets/")) return true;
  if (
    pathname === "/favicon.ico" ||
    pathname === "/icon.png" ||
    pathname === "/apple-icon.png" ||
    pathname === "/robots.txt"
  ) {
    return true;
  }
  return false;
}

export async function issueSiteAccessToken(
  secret: string,
  sessionSeconds: number,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + sessionSeconds;
  const sig = await signSiteAccessExp(secret, exp);
  return `${exp}.${sig}`;
}

export async function verifySiteAccessCookie(
  token: string | undefined,
  secret: string,
): Promise<boolean> {
  if (!token?.trim() || !secret) return false;
  const [expRaw, sig] = token.split(".");
  if (!expRaw || !sig) return false;

  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp <= Math.floor(Date.now() / 1000)) return false;

  const expected = await signSiteAccessExp(secret, exp);
  return timingSafeEqualHex(sig, expected);
}

async function signSiteAccessExp(secret: string, exp: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(String(exp)),
  );
  return bufferToHex(sig);
}

function bufferToHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function parseTruthy(raw: string | undefined): boolean {
  const v = raw?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

function clampInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(n)));
}
