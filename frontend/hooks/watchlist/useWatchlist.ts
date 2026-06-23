"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addToWatchlist,
  fetchWatchlist,
  removeFromWatchlist,
  rq,
  marketplaceApiRetryDelay,
  marketplaceRqPolicy,
} from "@/lib/core";
import { useAuthStore } from "@/store/authStore";
import { userHasLinkedWallet } from "@/lib/auth/wallets";

export function useWatchlist() {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? "";

  const query = useQuery({
    queryKey: rq.userWatchlist(userId),
    queryFn: fetchWatchlist,
    enabled: Boolean(userId),
    staleTime: marketplaceRqPolicy.collectionsStaleMs,
    retry: marketplaceRqPolicy.apiQueryRetry,
    retryDelay: marketplaceApiRetryDelay,
  });

  const keySet = new Set(
    (query.data?.collectionKeys ?? []).map((k) => k.toLowerCase()),
  );

  return {
    user,
    ...query,
    keySet,
    isWatched: (collectionKey: string) =>
      keySet.has(collectionKey.trim().toLowerCase()),
  };
}

export function useWatchlistToggle(collectionKey: string) {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? "";
  const normalized = collectionKey.trim().toLowerCase();
  const { isWatched } = useWatchlist();

  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      if (next) await addToWatchlist(normalized);
      else await removeFromWatchlist(normalized);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rq.userWatchlist(userId) });
    },
  });

  return {
    isWatched: isWatched(normalized),
    canToggle: Boolean(userId) && userHasLinkedWallet(user),
    pending: mutation.isPending,
    toggle: () => {
      if (!userId) return;
      mutation.mutate(!isWatched(normalized));
    },
  };
}
