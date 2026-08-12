"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { TkNote } from "@/components/ds/Note";
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
 * Ephemeral toasts for new inbox notifications — same title/body/href as the
 * notifications drawer (Feedback-States Notification / .tk-note).
 */
export function NotificationToastsHost() {
  const mounted = useClientMounted();
  const router = useRouter();
  const userId = useAuthStore((s) => s.user?.id ?? "");
  const { items, markRead, isLoading } = useMarketplaceNotifications({
    enabled: Boolean(userId),
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
  const seenIdsRef = useRef(new Set<string>());
  const userIdRef = useRef(userId);

  useEffect(() => {
    if (userIdRef.current === userId) return;
    userIdRef.current = userId;
    seededRef.current = false;
    seenIdsRef.current = new Set();
    clear();
  }, [userId, clear]);

  useEffect(() => {
    if (!userId || isLoading) return;

    if (!seededRef.current) {
      for (const item of items) seenIdsRef.current.add(item.id);
      seededRef.current = true;
      return;
    }

    for (const item of items) {
      if (seenIdsRef.current.has(item.id)) continue;
      seenIdsRef.current.add(item.id);
      if (!item.unread) continue;
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
  }, [items, isLoading, userId, push]);

  if (!mounted || toasts.length === 0) return null;

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
