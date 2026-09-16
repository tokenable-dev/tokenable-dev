"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchBuyerListingAlertStatus,
  marketplaceApiRetryDelay,
  marketplaceRqPolicy,
  rq,
  subscribeBuyerListingAlert,
  unsubscribeBuyerListingAlert,
} from "@/lib/core";
import { useAppChain } from "@/providers/AppChainProvider";
import { useAuthStore } from "@/store/authStore";
import { userHasLinkedWallet } from "@/lib/auth/wallets";

export function useBuyerListingAlert(collectionKey: string) {
  const queryClient = useQueryClient();
  const { chainId } = useAppChain();
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? "";
  const normalized = collectionKey.trim().toLowerCase();

  const query = useQuery({
    queryKey: rq.buyerListingAlert(userId, normalized, chainId),
    queryFn: () => fetchBuyerListingAlertStatus(normalized),
    enabled: Boolean(userId && normalized),
    staleTime: marketplaceRqPolicy.collectionsStaleMs,
    retry: marketplaceRqPolicy.apiQueryRetry,
    retryDelay: marketplaceApiRetryDelay,
  });

  const mutation = useMutation({
    mutationFn: async (next: boolean) => {
      if (next) await subscribeBuyerListingAlert(normalized);
      else await unsubscribeBuyerListingAlert(normalized);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: rq.buyerListingAlert(userId, normalized, chainId),
      });
    },
  });

  return {
    active: query.data?.active ?? false,
    loading: query.isLoading,
    pending: mutation.isPending,
    canToggle: Boolean(userId) && userHasLinkedWallet(user),
    toggle: () => {
      if (!userId) return;
      mutation.mutate(!query.data?.active);
    },
  };
}
