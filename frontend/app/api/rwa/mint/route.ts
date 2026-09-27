import { NextRequest, NextResponse } from "next/server";
import { internalApiUrl } from "@/lib/core/backendOrigin";
import { CHAIN_ID_HEADER } from "@/lib/chains/apiHeader";

/**
 * Next `rewrites()` proxy drops long-running upstream connections (~30s) while
 * on-chain mint + receipt wait can take minutes. This route wins over rewrites
 * and uses an explicit fetch timeout (see `RWA_MINT_TIMEOUT_MS` in rwa-mint.ts).
 */
const MINT_PROXY_TIMEOUT_MS = 180_000;

export const runtime = "nodejs";
export const maxDuration = 300;

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

export async function POST(req: NextRequest) {
  const url = `${internalApiUrl()}/rwa/mint`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MINT_PROXY_TIMEOUT_MS);

  try {
    const body = await req.arrayBuffer();
    const res = await fetch(url, {
      method: "POST",
      headers: forwardRequestHeaders(req),
      body,
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
        ? `Mint proxy timed out after ${MINT_PROXY_TIMEOUT_MS / 1000}s`
        : err instanceof Error
          ? err.message
          : "Mint proxy failed";
    return NextResponse.json({ message, statusCode: 504 }, { status: 504 });
  } finally {
    clearTimeout(timer);
  }
}
