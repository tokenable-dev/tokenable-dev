import { NextRequest } from "next/server";
import {
  LONG_RUNNING_PROXY_TIMEOUT_MS,
  proxyPostToNest,
} from "@/lib/core/longRunningApiProxy";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ idOrPublicId: string; itemId: string }> },
) {
  const { idOrPublicId, itemId } = await ctx.params;
  return proxyPostToNest(
    req,
    `/marketplace/admin/vault-submissions/${encodeURIComponent(idOrPublicId)}/items/${encodeURIComponent(itemId)}/mint-and-deliver`,
    LONG_RUNNING_PROXY_TIMEOUT_MS,
    "Vault mint-and-deliver",
  );
}
