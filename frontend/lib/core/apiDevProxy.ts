import { resolveBackendOrigin } from "./resolveBackendOrigin";

/**
 * Dev-only `/api/*` handler — probes 4100/4000 at runtime instead of a fixed rewrite target.
 */
export async function proxyToBackend(
  request: Request,
  pathSegments: string[],
): Promise<Response> {
  const origin = await resolveBackendOrigin();
  const incoming = new URL(request.url);
  const path = pathSegments.map(encodeURIComponent).join("/");
  const targetUrl = `${origin}/api/${path}${incoming.search}`;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");
  headers.delete("content-length");

  const hasBody =
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    request.body != null;

  const init: RequestInit & { duplex?: "half" } = {
    method: request.method,
    headers,
    redirect: "manual",
  };

  if (hasBody) {
    init.body = request.body;
    init.duplex = "half";
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, init);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Upstream fetch failed";
    return Response.json(
      {
        statusCode: 502,
        message: `API proxy failed (${origin}): ${message}. Is Nest running? (cd backend && pnpm start:dev)`,
      },
      { status: 502 },
    );
  }

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("transfer-encoding");

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders,
  });
}
