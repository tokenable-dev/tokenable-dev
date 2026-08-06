"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  adminBackfillSelfVaultSettlements,
  adminConfirmSelfVaultSettlement,
  adminExecuteSelfVaultPayout,
  adminRejectSelfVaultSettlement,
  listAdminSelfVaultSettlements,
  rq,
  type SelfVaultSettlementStatus,
} from "@/lib/core";
import { useAppChain } from "@/providers/AppChainProvider";

export function useMarketplaceAdminSelfVaultSettlements(
  status?: SelfVaultSettlementStatus,
) {
  const { chainId } = useAppChain();
  return useQuery({
    queryKey: rq.adminSelfVaultSettlements(chainId, status),
    queryFn: () => listAdminSelfVaultSettlements(status),
    staleTime: 10_000,
  });
}

export function useAdminSelfVaultSettlementActions() {
  const queryClient = useQueryClient();
  const { chainId } = useAppChain();

  const invalidate = () =>
    void queryClient.invalidateQueries({
      queryKey: ["admin-self-vault-settlements", chainId],
    });

  const confirm = useMutation({
    mutationFn: (id: string) => adminConfirmSelfVaultSettlement(id),
    onSuccess: invalidate,
  });

  const reject = useMutation({
    mutationFn: (id: string) => adminRejectSelfVaultSettlement(id),
    onSuccess: invalidate,
  });

  const executePayout = useMutation({
    mutationFn: (id: string) => adminExecuteSelfVaultPayout(id),
    onSuccess: invalidate,
  });

  const backfill = useMutation({
    mutationFn: () => adminBackfillSelfVaultSettlements(),
    onSuccess: invalidate,
  });

  return { confirm, reject, executePayout, backfill };
}
