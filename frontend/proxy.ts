import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Dev-only CSP — Next.js 16+ uses `proxy.ts` (replaces deprecated `middleware.ts`).
 * Wallet SDKs + Turbopack/HMR need `'unsafe-eval'` in script-src.
 *
 * Production: no CSP from this file (hosting / reverse-proxy can set strict headers).
 */
const DEV_CONTENT_SECURITY_POLICY = [
  "default-src * 'self' data: blob: 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
  "script-src * 'self' blob: data: https: http: 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
  "style-src * 'self' 'unsafe-inline'",
  "img-src * 'self' data: blob: https: http:",
  "font-src * 'self' data: https:",
  "connect-src * 'self' ws: wss: http: https: data: blob:",
  "worker-src * 'self' blob:",
  "frame-src * 'self' https: http:",
  "base-uri 'self'",
  "form-action * 'self' https: http:",
].join("; ");

export function proxy(_request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.next();
  }

  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", DEV_CONTENT_SECURITY_POLICY);
  return response;
}

export const config = {
  matcher: ["/((?!_next/image).*)"],
};
