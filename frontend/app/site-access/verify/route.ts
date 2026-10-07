import { NextResponse } from "next/server";
import {
  SITE_ACCESS_COOKIE,
  issueSiteAccessToken,
  readSiteAccessConfig,
} from "@/lib/site-access/siteAccess";

export async function POST(request: Request) {
  const cfg = readSiteAccessConfig();
  if (!cfg.enabled) {
    return NextResponse.json({ ok: true, expiresIn: cfg.sessionSeconds });
  }

  let password = "";
  try {
    const body = (await request.json()) as { password?: unknown };
    password = typeof body?.password === "string" ? body.password.trim() : "";
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  if (!password || password !== cfg.password) {
    return NextResponse.json({ message: "Invalid site access password" }, { status: 401 });
  }

  if (!cfg.secret || cfg.secret.length < 16) {
    return NextResponse.json(
      { message: "Site access is misconfigured (missing secret)" },
      { status: 500 },
    );
  }

  const token = await issueSiteAccessToken(cfg.secret, cfg.sessionSeconds);
  const secure =
    process.env.COOKIE_SECURE === "true" ||
    (process.env.COOKIE_SECURE !== "false" &&
      (process.env.FRONTEND_URL?.trim() ?? "").startsWith("https:"));
  const response = NextResponse.json({ ok: true, expiresIn: cfg.sessionSeconds });

  response.cookies.set(SITE_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: cfg.sessionSeconds,
  });

  return response;
}
