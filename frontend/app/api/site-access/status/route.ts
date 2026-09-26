import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  SITE_ACCESS_COOKIE,
  readSiteAccessConfig,
  verifySiteAccessCookie,
} from "@/lib/site-access/siteAccess";

/** Client-readable site gate state (httpOnly cookie cannot be read in the browser). */
export async function GET() {
  const cfg = readSiteAccessConfig();
  if (!cfg.enabled) {
    return NextResponse.json({ enabled: false, granted: true });
  }

  const token = (await cookies()).get(SITE_ACCESS_COOKIE)?.value;
  const granted = cfg.secret
    ? await verifySiteAccessCookie(token, cfg.secret)
    : false;

  return NextResponse.json({ enabled: true, granted });
}
