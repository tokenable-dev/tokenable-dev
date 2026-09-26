import { proxyToBackend } from "@/lib/core/apiDevProxy";

type RouteContext = { params: Promise<{ path: string[] }> };

/**
 * Fallback when `/api` is not handled by `next.config` rewrites (legacy / tests).
 * Local `pnpm dev` proxies `/api/*` to Nest via rewrites — this handler should not run.
 */
async function handle(request: Request, context: RouteContext) {
  if (process.env.NODE_ENV === "production") {
    return Response.json(
      { statusCode: 404, message: "Not Found" },
      { status: 404 },
    );
  }

  const { path } = await context.params;
  return proxyToBackend(request, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
