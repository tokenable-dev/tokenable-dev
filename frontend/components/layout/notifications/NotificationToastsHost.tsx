"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { TkNote } from "@/components/ds/Note";
import { shouldHideAppChrome } from "@/constants/layout";
import { useHeaderWalletMenuData } from "@/hooks/auth/useHeaderWalletMenuData";
import { useMarketplaceNotifications } from "@/hooks/notifications/useMarketplaceNotifications";
import { useClientMounted } from "@/hooks/ui/useClientMounted";
import { usePrivyFiatOnramp } from "@/hooks/wallet/usePrivyFiatOnramp";
import {
  isAddFundsNotification,
  notificationToastTone,
} from "@/lib/notifications/activateNotification";
import type { NotificationIcon } from "@/lib/notifications/notifications";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/store/toastStore";

function ToastIcon({ icon }: { icon: NotificationIcon }) {
  if (icon === "check") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (icon === "layer") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    );
  }
  if (icon === "shield") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

/**
 * Ephemeral toasts for inbox events that happen while this tab is in front.
 * Catch-up (login, tab focus, hidden tab) only updates the drawer — no toast.
 */
const TOAST_FRESH_MS = 90_000;

function absorbSeenIds(items: { id: string }[], seen: Set<string>) {
  for (const item of items) seen.add(item.id);
}

function isLiveToastCandidate(createdAt: string, now = Date.now()): boolean {
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return false;
  return now - t <= TOAST_FRESH_MS;
}

export function NotificationToastsHost() {
  const mounted = useClientMounted();
  const router = useRouter();
  const pathname = usePathname();
  const userId = useAuthStore((s) => s.user?.id ?? "");
  const inboxEnabled = Boolean(userId) && !shouldHideAppChrome(pathname);
  const { items, markRead, isLoading, isFetching } = useMarketplaceNotifications({
    enabled: inboxEnabled,
  });
  const toasts = useToastStore((s) => s.toasts);
  const push = useToastStore((s) => s.push);
  const dismiss = useToastStore((s) => s.dismiss);
  const clear = useToastStore((s) => s.clear);
  const { walletAddress, refetchBalance } = useHeaderWalletMenuData();
  const { startFunding } = usePrivyFiatOnramp({
    onComplete: () => void refetchBalance(),
  });

  const seededRef = useRef(false);
  const catchupRef = useRef(true);
  const seenIdsRef = useRef(new Set<string>());
  const userIdRef = useRef(userId);
  const [visEpoch, setVisEpoch] = useState(0);

  useEffect(() => {
    if (userIdRef.current === userId) return;
    userIdRef.current = userId;
    seededRef.current = false;
    catchupRef.current = true;
    seenIdsRef.current = new Set();
    clear();
  }, [userId, clear]);

  useEffect(() => {
    const onVis = () => {
      catchupRef.current = true;
      absorbSeenIds(items, seenIdsRef.current);
      setVisEpoch((n) => n + 1);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [items]);

  useEffect(() => {
    if (!inboxEnabled || !userId || isLoading) return;

    const tabHidden =
      typeof document !== "undefined" && document.visibilityState !== "visible";
    if (tabHidden) {
      catchupRef.current = true;
      absorbSeenIds(items, seenIdsRef.current);
      seededRef.current = true;
      return;
    }

    if (!seededRef.current || catchupRef.current) {
      absorbSeenIds(items, seenIdsRef.current);
      seededRef.current = true;
      if (!isFetching) catchupRef.current = false;
      return;
    }

    for (const item of items) {
      if (seenIdsRef.current.has(item.id)) continue;
      seenIdsRef.current.add(item.id);
      if (!item.unread) continue;
      if (!isLiveToastCandidate(item.createdAt)) continue;
      push({
        id: `notif-${item.id}`,
        tone: notificationToastTone(item),
        title: item.title,
        message: item.desc,
        href: item.href,
        ctaLabel: item.ctaLabel,
        notificationId: item.id,
        addFunds: isAddFundsNotification(item),
      });
    }
  }, [inboxEnabled, items, isLoading, isFetching, userId, push, visEpoch]);

  if (!inboxEnabled || !mounted || toasts.length === 0) return null;

  return createPortal(
    <div className="tk-toast-host" aria-live="polite">
      {toasts.map((toast) => {
        const itemIcon =
          items.find((i) => i.id === toast.notificationId)?.icon ?? "check";
        return (
          <TkNote
            key={toast.id}
            tone={toast.tone}
            title={toast.title}
            message={toast.message}
            icon={<ToastIcon icon={itemIcon} />}
            onClose={() => dismiss(toast.id)}
            onActivate={() => {
              if (toast.notificationId) markRead(toast.notificationId);
              dismiss(toast.id);
              if (toast.addFunds) {
                void startFunding(walletAddress);
                return;
              }
              if (toast.href) router.push(toast.href);
            }}
            actions={
              toast.ctaLabel
                ? [
                    {
                      label: toast.ctaLabel,
                      variant: toast.tone,
                      onClick: () => {
                        if (toast.notificationId) markRead(toast.notificationId);
                        dismiss(toast.id);
                        if (toast.addFunds) {
                          void startFunding(walletAddress);
                          return;
                        }
                        if (toast.href) router.push(toast.href);
                      },
                    },
                  ]
                : undefined
            }
          />
        );
      })}
    </div>,
    document.body,
  );
}
