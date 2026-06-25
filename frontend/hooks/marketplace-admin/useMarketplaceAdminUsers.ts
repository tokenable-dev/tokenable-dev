"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  deleteAdminUser,
  deleteAdminUserWallet,
  deleteAdminUserWatchlistItem,
  getAdminUserDetail,
  getAdminUserStats,
  getAdminUsers,
  patchAdminUser,
  postAdminClearPendingTokens,
  postAdminForceVerifyEmail,
  postAdminLinkUserWallet,
  postAdminResendVerification,
  postAdminSendPasswordReset,
  postAdminSetUserPassword,
  rq,
  type AdminUserDetail,
  type AdminUserFilter,
} from "@/lib/core";

export const ADMIN_USERS_PAGE_SIZE = 30;

export function useMarketplaceAdminUserStats() {
  return useQuery({
    queryKey: rq.adminUserStats(),
    queryFn: () => getAdminUserStats(),
    staleTime: 60_000,
  });
}

export function useMarketplaceAdminUserDetail(
  userId: string | null,
  enabled: boolean,
) {
  return useQuery({
    queryKey: rq.adminUserDetail(userId ?? ""),
    queryFn: () => getAdminUserDetail(userId!),
    enabled: enabled && Boolean(userId),
    staleTime: 15_000,
  });
}

export function useMarketplaceAdminUsers(params: {
  q: string;
  filter: AdminUserFilter;
  page: number;
}) {
  const qc = useQueryClient();
  const { q, filter, page } = params;

  const listQuery = useQuery({
    queryKey: rq.adminUsersList(q, filter, page, ADMIN_USERS_PAGE_SIZE),
    queryFn: () =>
      getAdminUsers({
        q: q || undefined,
        filter,
        page,
        limit: ADMIN_USERS_PAGE_SIZE,
      }),
    staleTime: 30_000,
  });

  const invalidateUsers = async () => {
    await qc.invalidateQueries({ queryKey: rq.adminUserStats() });
    await qc.invalidateQueries({ queryKey: ["admin-users-list"] });
    await qc.invalidateQueries({ queryKey: ["admin-user-detail"] });
  };

  const patchMutation = useMutation({
    mutationFn: (input: {
      userId: string;
      body: { name?: string | null; emailVerified?: boolean };
    }) => patchAdminUser(input.userId, input.body),
    onSuccess: async (data) => {
      qc.setQueryData(rq.adminUserDetail(data.id), data);
      await invalidateUsers();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) => deleteAdminUser(userId),
    onSuccess: async () => {
      await invalidateUsers();
    },
  });

  const actionMutation = useMutation({
    mutationFn: async (input: {
      userId: string;
      action:
        | "resend-verification"
        | "send-password-reset"
        | "force-verify"
        | "clear-tokens"
        | "set-password"
        | "link-wallet"
        | "unlink-wallet"
        | "remove-watchlist";
      password?: string;
      address?: string;
      collectionKey?: string;
    }): Promise<AdminUserDetail> => {
      const { userId, action } = input;
      switch (action) {
        case "resend-verification":
          await postAdminResendVerification(userId);
          return getAdminUserDetail(userId);
        case "send-password-reset":
          await postAdminSendPasswordReset(userId);
          return getAdminUserDetail(userId);
        case "force-verify":
          return postAdminForceVerifyEmail(userId) as Promise<AdminUserDetail>;
        case "clear-tokens":
          await postAdminClearPendingTokens(userId);
          return getAdminUserDetail(userId);
        case "set-password":
          if (!input.password?.trim()) throw new Error("Password required");
          await postAdminSetUserPassword(userId, input.password);
          return getAdminUserDetail(userId);
        case "link-wallet":
          if (!input.address?.trim()) throw new Error("Wallet address required");
          return postAdminLinkUserWallet(userId, input.address.trim());
        case "unlink-wallet":
          if (!input.address?.trim()) throw new Error("Wallet address required");
          return deleteAdminUserWallet(userId, input.address.trim());
        case "remove-watchlist":
          if (!input.collectionKey?.trim()) {
            throw new Error("Collection key required");
          }
          return deleteAdminUserWatchlistItem(userId, input.collectionKey.trim());
        default:
          throw new Error("Unknown action");
      }
    },
    onSuccess: async (data) => {
      qc.setQueryData(rq.adminUserDetail(data.id), data);
      await invalidateUsers();
    },
  });

  return {
    listQuery,
    patchMutation,
    deleteMutation,
    actionMutation,
    invalidateUsers,
  };
}
