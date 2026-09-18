import { proxyToBackend } from "@/lib/core/apiDevProxy";

type RouteContext = { params: Promise<{ path: string[] }> };

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
