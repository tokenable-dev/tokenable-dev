import { NextRequest, NextResponse } from "next/server";
import { internalApiUrl } from "@/lib/core/backendOrigin";
import { CHAIN_ID_HEADER } from "@/lib/chains/apiHeader";

/** Default for on-chain mint + Gmail poll admin flows (see `app/api/rwa/mint`). */
export const LONG_RUNNING_PROXY_TIMEOUT_MS = 180_000;

export const VAULTED_REVIEW_MINT_PROXY_TIMEOUT_MS = 300_000;

function forwardRequestHeaders(req: NextRequest): Headers {
  const out = new Headers();
  const contentType = req.headers.get("content-type");
  if (contentType) out.set("content-type", contentType);
  const cookie = req.headers.get("cookie");
  if (cookie) out.set("cookie", cookie);
  const chain = req.headers.get(CHAIN_ID_HEADER);
  if (chain) out.set(CHAIN_ID_HEADER, chain);
  const auth = req.headers.get("authorization");
  if (auth) out.set("authorization", auth);
  return out;
}

function forwardResponseHeaders(res: Response): Headers {
  const out = new Headers();
  const contentType = res.headers.get("content-type");
  if (contentType) out.set("content-type", contentType);
  const getSetCookie = res.headers.getSetCookie?.bind(res.headers);
  if (getSetCookie) {
    for (const c of getSetCookie()) {
      out.append("set-cookie", c);
    }
  }
  return out;
}

/**
 * Next `rewrites()` drops upstream connections around ~30s. Long Nest handlers
 * (mint, PSA vaulted test inject) need an explicit `app/api/*` route instead.
 *
 * @param nestApiPath Path after `/api`, e.g. `/rwa/mint` or `/marketplace/admin/...`
 */
export async function proxyPostToNest(
  req: NextRequest,
  nestApiPath: string,
  timeoutMs: number,
  label = "API",
): Promise<NextResponse> {
  const path = nestApiPath.startsWith("/") ? nestApiPath : `/${nestApiPath}`;
  const url = `${internalApiUrl()}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const body = await req.arrayBuffer();
    const res = await fetch(url, {
      method: "POST",
      headers: forwardRequestHeaders(req),
      body: body.byteLength > 0 ? body : undefined,
      signal: controller.signal,
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: forwardResponseHeaders(res),
    });
  } catch (err) {
    const message =
      err instanceof Error && err.name === "AbortError"
        ? `${label} proxy timed out after ${timeoutMs / 1000}s`
        : err instanceof Error
          ? err.message
          : `${label} proxy failed`;
    return NextResponse.json({ message, statusCode: 504 }, { status: 504 });
  } finally {
    clearTimeout(timer);
  }
}
