import { NextRequest } from "next/server";
import {
  LONG_RUNNING_PROXY_TIMEOUT_MS,
  proxyPostToNest,
} from "@/lib/core/longRunningApiProxy";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  return proxyPostToNest(req, "/rwa/mint", LONG_RUNNING_PROXY_TIMEOUT_MS, "Mint");
}
