import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SITE_ACCESS_COOKIE,
  isSiteAccessRequired,
  readSiteAccessConfig,
  siteAccessHostHeader,
  verifySiteAccessCookie,
} from "@/lib/site-access/siteAccess";

/** Client-readable site gate state (httpOnly cookie cannot be read in the browser). */
export async function GET(request: Request) {
  const cfg = readSiteAccessConfig();
  if (!isSiteAccessRequired(cfg, siteAccessHostHeader(request))) {
    return NextResponse.json({ enabled: false, granted: true });
  }

  const token = (await cookies()).get(SITE_ACCESS_COOKIE)?.value;
  const granted = cfg.secret
    ? await verifySiteAccessCookie(token, cfg.secret)
    : false;

  return NextResponse.json({ enabled: true, granted });
}
