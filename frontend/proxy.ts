import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SITE_ACCESS_COOKIE,
  isSiteAccessEnabled,
  isSiteAccessPublicPath,
  verifySiteAccessCookie,
} from "@/lib/site-access/siteAccess";

/**
 * Dev-only CSP — Next.js 16+ uses `proxy.ts` (replaces deprecated `middleware.ts`).
 * Wallet SDKs + Turbopack/HMR need `'unsafe-eval'` in script-src.
 *
 * Production: optional site-wide access gate when SITE_ACCESS_ENABLED=true.
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

export async function proxy(request: NextRequest) {
  if (isSiteAccessEnabled()) {
    const pathname = request.nextUrl.pathname;
    if (!isSiteAccessPublicPath(pathname, request.method)) {
      const secret = process.env.SITE_ACCESS_SECRET?.trim() ?? "";
      const token = request.cookies.get(SITE_ACCESS_COOKIE)?.value;
      const allowed = secret ? await verifySiteAccessCookie(token, secret) : false;

      if (!allowed) {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json(
            {
              statusCode: 401,
              message: "Site access password required",
              code: "SITE_ACCESS_REQUIRED",
            },
            { status: 401 },
          );
        }

        const loginUrl = request.nextUrl.clone();
        loginUrl.pathname = "/site-access";
        loginUrl.search = "";
        const next = `${pathname}${request.nextUrl.search}`;
        if (next && next !== "/") {
          loginUrl.searchParams.set("next", next);
        }
        return NextResponse.redirect(loginUrl);
      }
    }
  }

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
