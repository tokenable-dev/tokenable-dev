"use client";

import { useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { postTokenCollectionKeysByTokenIds } from "@/lib/core";

/** Legacy `/marketplace/[tokenId]` — redirect into collection detail + listing modal. */
export default function RwaDetailRedirectPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const raw = params.tokenId;
  const tokenId = Number(Array.isArray(raw) ? raw[0] : raw);
  const tokenIdOk = Number.isFinite(tokenId) && tokenId >= 0;

  const fromCollection = searchParams.get("fromCollection")?.trim() ?? "";
  const wantsBid = searchParams.has("bid");
  const wantsList = searchParams.has("list");

  const { data: serverCollectionKey, isLoading } = useQuery({
    queryKey: ["token-collection-key-redirect", tokenId],
    queryFn: async () => {
      const map = await postTokenCollectionKeysByTokenIds([tokenId]);
      return map[tokenId]?.trim().toLowerCase() || null;
    },
    enabled: tokenIdOk && !fromCollection,
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!tokenIdOk) {
      router.replace("/markets");
      return;
    }

    const collectionKey = fromCollection || serverCollectionKey;
    if (!collectionKey) {
      if (!fromCollection && isLoading) return;
      router.replace("/markets");
      return;
    }

    const qs = new URLSearchParams();
    qs.set("listing", String(tokenId));
    if (wantsBid) qs.set("checkout", "bid");
    else if (wantsList) qs.set("checkout", "list");
    else if (searchParams.get("checkout")) {
      qs.set("checkout", searchParams.get("checkout")!);
    }

    router.replace(
      `/marketplace/collections/${encodeURIComponent(collectionKey)}?${qs.toString()}`,
    );
  }, [
    tokenIdOk,
    tokenId,
    fromCollection,
    serverCollectionKey,
    isLoading,
    wantsBid,
    wantsList,
    router,
    searchParams,
  ]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
      Opening listing…
    </div>
  );
}
