import { NextRequest } from "next/server";
import {
  VAULTED_REVIEW_MINT_PROXY_TIMEOUT_MS,
  proxyPostToNest,
} from "@/lib/core/longRunningApiProxy";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ reviewId: string }> },
) {
  const { reviewId } = await ctx.params;
  return proxyPostToNest(
    req,
    `/marketplace/admin/vault-submissions/vaulted-reviews/${encodeURIComponent(reviewId)}/mint`,
    VAULTED_REVIEW_MINT_PROXY_TIMEOUT_MS,
    "Vaulted review mint",
  );
}
