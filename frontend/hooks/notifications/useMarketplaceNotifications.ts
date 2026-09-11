"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { shouldHideAppChrome } from "@/constants/layout";
import {
  fetchMarketplaceNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  marketplaceApiRetryDelay,
  marketplaceRqPolicy,
  rq,
  type MarketplaceNotificationItem,
} from "@/lib/core";
import { activeRqChainId } from "@/lib/chains";
import { invalidateMarketplaceNotifications } from "@/lib/core/invalidation";
import {
  formatNotificationTime,
  notificationTypeStyle,
  type NotificationItem,
} from "@/lib/notifications/notifications";
import { useAuthStore } from "@/store/authStore";

function toDrawerItem(row: MarketplaceNotificationItem): NotificationItem {
  const type =
    row.type === "trade" ||
    row.type === "bid" ||
    row.type === "vault" ||
    row.type === "price"
      ? row.type
      : "bid";
  const style = notificationTypeStyle(type);
  return {
    id: String(row.id),
    type,
    icon: style.icon,
    color: style.color,
    title: row.title,
    desc: row.body,
    time: formatNotificationTime(row.createdAt),
    createdAt: row.createdAt,
    imageUrl: row.imageUrl ?? row.payload.imageUrl ?? undefined,
    href: row.href,
    unread: row.readAt == null,
    ctaLabel: row.ctaLabel,
    eventKey: row.payload.eventKey ?? null,
  };
}

function useForegroundTab(): boolean {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const sync = () => setVisible(document.visibilityState === "visible");
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => document.removeEventListener("visibilitychange", sync);
  }, []);
  return visible;
}

/** Inbox for the signed-in user on the active app chain. */
export function useMarketplaceNotifications(options?: { enabled?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? "";
  const chainId = activeRqChainId();
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const tabVisible = useForegroundTab();
  const enabled =
    (options?.enabled ?? true) &&
    Boolean(userId) &&
    !shouldHideAppChrome(pathname) &&
    tabVisible;

  const query = useQuery({
    queryKey: rq.marketplaceNotifications(userId, chainId),
    queryFn: fetchMarketplaceNotifications,
    enabled,
    staleTime: 15_000,
    refetchInterval: enabled ? 15_000 : false,
    refetchIntervalInBackground: false,
    retry: marketplaceRqPolicy.apiQueryRetry,
    retryDelay: marketplaceApiRetryDelay,
  });

  const items = (query.data?.items ?? []).map(toDrawerItem);
  const unreadCount = items.reduce((n, item) => n + (item.unread ? 1 : 0), 0);

  const markRead = useMutation({
    mutationFn: (id: number) => markNotificationRead(id),
    onSuccess: async () => {
      await invalidateMarketplaceNotifications(queryClient, userId, chainId);
    },
  });

  const markAllRead = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: async () => {
      await invalidateMarketplaceNotifications(queryClient, userId, chainId);
    },
  });

  return {
    items,
    unreadCount,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
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
