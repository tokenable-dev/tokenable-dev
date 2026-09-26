import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  SITE_ACCESS_COOKIE,
  isPrivyOAuthCallbackSearch,
  isSiteAccessEnabled,
  isSiteAccessPublicPath,
  verifySiteAccessCookie,
} from "@/lib/site-access/siteAccess";

/**
 * Next.js 16+ `proxy.ts` (replaces deprecated `middleware.ts`).
 * Staging password gate when SITE_ACCESS_ENABLED=true.
 * Dev CSP is set via `next.config` headers — not here — so this layer stays cheap.
 */
export async function proxy(request: NextRequest) {
  if (!isSiteAccessEnabled()) {
    return NextResponse.next();
  }

  const pathname = request.nextUrl.pathname;
  if (isPrivyOAuthCallbackSearch(request.nextUrl.searchParams)) {
    return NextResponse.next();
  }
  if (isSiteAccessPublicPath(pathname, request.method)) {
    return NextResponse.next();
  }

  const secret = process.env.SITE_ACCESS_SECRET?.trim() ?? "";
  const token = request.cookies.get(SITE_ACCESS_COOKIE)?.value;
  const allowed = secret ? await verifySiteAccessCookie(token, secret) : false;

  if (allowed) {
    return NextResponse.next();
  }

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

export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|assets/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
