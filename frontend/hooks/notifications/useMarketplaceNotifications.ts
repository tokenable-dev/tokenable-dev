"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchMarketplaceNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  marketplaceApiRetryDelay,
  marketplaceRqPolicy,
  rq,
  type MarketplaceNotificationItem,
} from "@/lib/core";
import { invalidateMarketplaceNotifications } from "@/lib/core/invalidation";
import {
  formatNotificationTime,
  notificationTypeStyle,
  type NotificationItem,
} from "@/lib/notifications/notifications";
import { useAuthStore } from "@/store/authStore";

function toDrawerItem(row: MarketplaceNotificationItem): NotificationItem {
  const type = row.type === "bid" ? "bid" : "bid";
  const style = notificationTypeStyle(type);
  return {
    id: String(row.id),
    type,
    icon: style.icon,
    color: style.color,
    title: row.title,
    desc: row.body,
    time: formatNotificationTime(row.createdAt),
    href: row.href,
    unread: row.readAt == null,
    ctaLabel: row.ctaLabel,
  };
}

export function useMarketplaceNotifications(enabled: boolean) {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? "";
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: rq.marketplaceNotifications(userId),
    queryFn: fetchMarketplaceNotifications,
    enabled: enabled && Boolean(userId),
    staleTime: 30_000,
    refetchInterval: enabled ? 60_000 : false,
    retry: marketplaceRqPolicy.apiQueryRetry,
    retryDelay: marketplaceApiRetryDelay,
  });

  const items = (query.data?.items ?? []).map(toDrawerItem);

  const markRead = useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: async () => {
      await invalidateMarketplaceNotifications(queryClient, userId);
    },
  });

  const markAllRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: async () => {
      await invalidateMarketplaceNotifications(queryClient, userId);
    },
  });

  return {
    items,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
    markRead: (id: string) => {
      const n = Number(id);
      if (!Number.isFinite(n)) return;
      void markRead.mutateAsync(n);
    },
    markAllRead: () => void markAllRead.mutateAsync(),
  };
}
