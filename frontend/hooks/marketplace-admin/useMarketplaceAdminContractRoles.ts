"use client";

import { useCallback, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAdminRwaRolesOverview,
  getAdminRwaWalletRoleStatus,
  postAdminGrantRwaRole,
  postAdminRevokeRwaRole,
  rq,
  type AdminRwaRoleKey,
} from "@/lib/core";
import { useAppChain } from "@/providers/AppChainProvider";
import { isAddress } from "viem";

export function useMarketplaceAdminContractRoles() {
  const queryClient = useQueryClient();
  const { chainId } = useAppChain();
  const [walletInput, setWalletInput] = useState("");
  const [lookupWallet, setLookupWallet] = useState<string | undefined>();

  const overviewQuery = useQuery({
    queryKey: rq.adminRwaRolesOverview(chainId),
    queryFn: getAdminRwaRolesOverview,
  });

  const statusQuery = useQuery({
    queryKey: rq.adminRwaRolesStatus(lookupWallet ?? "", chainId),
    queryFn: () => getAdminRwaWalletRoleStatus(lookupWallet!),
    enabled: Boolean(lookupWallet),
  });

  const invalidateRoleQueries = useCallback(
    async (wallet: string) => {
      await queryClient.invalidateQueries({
        queryKey: rq.adminRwaRolesOverview(chainId),
      });
      await queryClient.invalidateQueries({
        queryKey: rq.adminRwaRolesStatus(wallet, chainId),
      });
    },
    [queryClient, chainId],
  );

  const grantMutation = useMutation({
    mutationFn: postAdminGrantRwaRole,
    onSuccess: async (result) => {
      await invalidateRoleQueries(result.walletAddress);
    },
  });

  const revokeMutation = useMutation({
    mutationFn: postAdminRevokeRwaRole,
    onSuccess: async (result) => {
      await invalidateRoleQueries(result.walletAddress);
    },
  });

  const lookup = useCallback(() => {
    const trimmed = walletInput.trim();
    if (!trimmed) {
      window.alert("Enter a wallet address.");
      return;
    }
    if (!isAddress(trimmed)) {
      window.alert("Invalid Ethereum wallet address.");
      return;
    }
    setLookupWallet(trimmed);
  }, [walletInput]);

  const grantRole = useCallback(
    async (role: AdminRwaRoleKey) => {
      if (!lookupWallet) return;
      const roleLabel = overviewQuery.data?.roles.find((r) => r.key === role)?.label ?? role;
      const warn =
        role === "default_admin"
          ? " WARNING: Default admin can upgrade the contract and manage all roles."
          : "";
      if (
        !window.confirm(
          `Grant "${roleLabel}" to ${lookupWallet}?${warn}\n\nThis submits an on-chain grantRole transaction.`,
        )
      ) {
        return;
      }
      try {
        const result = await grantMutation.mutateAsync({
          walletAddress: lookupWallet,
          role,
        });
        window.alert(`Role granted.\nTx: ${result.txHash}`);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Grant failed");
      }
    },
    [grantMutation, lookupWallet, overviewQuery.data?.roles],
  );

  const revokeRole = useCallback(
    async (role: AdminRwaRoleKey) => {
      if (!lookupWallet) return;
      const roleLabel = overviewQuery.data?.roles.find((r) => r.key === role)?.label ?? role;
      const warn =
        role === "default_admin"
          ? " WARNING: Revoking default admin may lock out contract upgrades and role management."
          : "";
      if (
        !window.confirm(
          `Revoke "${roleLabel}" from ${lookupWallet}?${warn}\n\nThis submits an on-chain revokeRole transaction.`,
        )
      ) {
        return;
      }
      try {
        const result = await revokeMutation.mutateAsync({
          walletAddress: lookupWallet,
          role,
        });
        window.alert(`Role revoked.\nTx: ${result.txHash}`);
      } catch (err) {
        window.alert(err instanceof Error ? err.message : "Revoke failed");
      }
    },
    [lookupWallet, overviewQuery.data?.roles, revokeMutation],
  );

  const busy = grantMutation.isPending || revokeMutation.isPending;

  return {
    walletInput,
    setWalletInput,
    lookupWallet,
    lookup,
    overviewQuery,
    statusQuery,
    grantRole,
    revokeRole,
    busy,
  };
}
