import { resolveBackendOrigin, resetBackendOriginCache } from "./resolveBackendOrigin";

/**
 * Dev-only `/api/*` handler — probes 4100/4000 at runtime instead of a fixed rewrite target.
 */
export async function proxyToBackend(
  request: Request,
  pathSegments: string[],
): Promise<Response> {
  const incoming = new URL(request.url);
  const path = pathSegments.map(encodeURIComponent).join("/");

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const hasBody =
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    request.body != null;

  const bodyBuffer = hasBody ? await request.arrayBuffer() : null;

  const initBase: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) {
      resetBackendOriginCache();
    }
    const origin = await resolveBackendOrigin();
    const targetUrl = `${origin}/api/${path}${incoming.search}`;

    const init: RequestInit =
      bodyBuffer != null
        ? { ...initBase, body: bodyBuffer.slice(0) }
        : initBase;

    try {
      const upstream = await fetch(targetUrl, init);
      const responseHeaders = new Headers(upstream.headers);
      responseHeaders.delete("transfer-encoding");
      // Node.js fetch (undici) auto-decompresses gzip/br responses; strip
      // Content-Encoding so the browser does not try to decompress again.
      responseHeaders.delete("content-encoding");
      // Content-Length no longer matches the decoded body size.
      responseHeaders.delete("content-length");

      return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
      });
    } catch (err) {
      lastError = err;
    }
  }

  const origin = await resolveBackendOrigin();
  const message =
    lastError instanceof Error ? lastError.message : "Upstream fetch failed";
  return Response.json(
    {
      statusCode: 502,
      message: `API proxy failed (${origin}): ${message}. Is Nest running? (cd backend && pnpm start:dev)`,
    },
    { status: 502 },
  );
}
