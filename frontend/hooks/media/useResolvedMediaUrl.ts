"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { postResolveMediaUrls, rq, marketplaceRqPolicy } from "@/lib/core";
import { uriNeedsBackendResolve } from "@/lib/marketplace";

/**
 * Single cover / image: resolves `ipfs://` or `https://…/ipfs/…` through the API; otherwise returns the trimmed URI.
 */
export function useResolvedMediaUrl(uri: string | null | undefined): {
  url: string;
  isLoading: boolean;
} {
  const trimmed = uri?.trim() ?? "";
  const needs = Boolean(trimmed && uriNeedsBackendResolve(trimmed));

  const q = useQuery({
    queryKey: rq.mediaHttps(trimmed),
    queryFn: async () => {
      const { items } = await postResolveMediaUrls([trimmed]);
      return items[0]?.httpsUrl ?? null;
    },
    enabled: needs,
    staleTime: marketplaceRqPolicy.mediaStaleMs,
  });

  if (!trimmed) return { url: "", isLoading: false };
  if (!needs) return { url: trimmed, isLoading: false };
  return { url: q.data ?? "", isLoading: q.isLoading };
}

export function useResolvedMediaUrlMap(
  rawUris: (string | null | undefined)[],
  opts?: { enabled?: boolean },
): { map: Map<string, string>; isLoading: boolean } {
  const enabled = opts?.enabled ?? true;

  const { key, toResolve, passThrough } = useMemo(() => {
    const pass = new Map<string, string>();
    const need: string[] = [];
    const seen = new Set<string>();
    for (const u of rawUris) {
      const t = u?.trim() ?? "";
      if (!t || seen.has(t)) continue;
      seen.add(t);
      if (!uriNeedsBackendResolve(t)) pass.set(t, t);
      else need.push(t);
    }
    const key = [...need].sort().join("\u0001");
    return { key, toResolve: need, passThrough: pass };
  }, [rawUris]);

  const q = useQuery({
    queryKey: rq.mediaHttpsBatch(key),
    queryFn: async () => {
      if (toResolve.length === 0) return new Map<string, string>();
      const { items } = await postResolveMediaUrls(toResolve);
      const m = new Map<string, string>();
      for (const it of items) {
        const k = it.uri?.trim() ?? "";
        if (k && it.httpsUrl) m.set(k, it.httpsUrl);
      }
      return m;
    },
    enabled: enabled && toResolve.length > 0,
    staleTime: 60 * 60 * 1000,
  });

  const map = useMemo(() => {
    const out = new Map(passThrough);
    const resolved = q.data;
    if (resolved) {
      for (const [k, v] of resolved) out.set(k, v);
    }
    return out;
  }, [passThrough, q.data]);

  return { map, isLoading: q.isLoading };
}
