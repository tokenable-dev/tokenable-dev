"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useHeaderWalletMenuData } from "@/hooks/auth/useHeaderWalletMenuData";
import { useMarketplaceNotifications } from "@/hooks/notifications/useMarketplaceNotifications";
import { useClientMounted } from "@/hooks/ui/useClientMounted";
import { usePrivyFiatOnramp } from "@/hooks/wallet/usePrivyFiatOnramp";
import { cn } from "@/lib/ds/cn";
import {
  NOTIFICATION_FILTERS,
  NOTIFICATION_GROUPS,
  type NotificationFilterKey,
  type NotificationIcon,
  type NotificationItem,
  notificationTimeGroup,
} from "@/lib/notifications/notifications";
import { isAddFundsNotification } from "@/lib/notifications/activateNotification";

function hexToRgb(hex: string): string {
  const r = Number.parseInt(hex.slice(1, 3), 16);
  const g = Number.parseInt(hex.slice(3, 5), 16);
  const b = Number.parseInt(hex.slice(5, 7), 16);
  return `${r},${g},${b}`;
}

function NotifIcon({ icon }: { icon: NotificationIcon }) {
  if (icon === "check") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (icon === "layer") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    );
  }
  if (icon === "shield") {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function NotificationItemView({
  item,
  onActivate,
}: {
  item: NotificationItem;
  onActivate: (item: NotificationItem) => void;
}) {
  return (
    <button
      type="button"
      className="tk-notif-item"
      data-type={item.type}
      onClick={() => onActivate(item)}
    >
      <div
        className="tk-notif-item__icon"
        style={{
          background: `rgba(${hexToRgb(item.color)},0.12)`,
          color: item.color,
        }}
      >
        <NotifIcon icon={item.icon} />
      </div>
      <div className="tk-notif-item__main">
        <div className="tk-notif-item__head">
          <span className="tk-notif-item__title">
            {item.unread ? <span className="tk-notif-item__dot" aria-hidden /> : null}
            {item.title}
          </span>
          <span className="tk-notif-item__time">{item.time}</span>
        </div>
        {item.desc ? <p className="tk-notif-item__desc">{item.desc}</p> : null}
        {item.ctaLabel ? (
          <span className="tk-notif-item__cta">{item.ctaLabel}</span>
        ) : null}
      </div>
      <div className="tk-notif-item__thumb-slot">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.imageUrl} alt="" className="tk-notif-item__thumb" />
        ) : null}
      </div>
    </button>
  );
}

export function NotificationsDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const mounted = useClientMounted();
  const router = useRouter();
  const titleId = useId();
  const [filter, setFilter] = useState<NotificationFilterKey>("all");
  const [visible, setVisible] = useState(false);
  const [animOpen, setAnimOpen] = useState(false);
  const { items: allItems, isLoading, markRead, markAllRead, refetch } =
    useMarketplaceNotifications();
  const { walletAddress, refetchBalance } = useHeaderWalletMenuData();
  const { startFunding } = usePrivyFiatOnramp({
    onComplete: () => void refetchBalance(),
  });

  useEffect(() => {
    if (open) {
      setVisible(true);
      setFilter("all");
      void refetch();
      const id = requestAnimationFrame(() => setAnimOpen(true));
      return () => cancelAnimationFrame(id);
    }
    setAnimOpen(false);
    const t = window.setTimeout(() => setVisible(false), 300);
    return () => window.clearTimeout(t);
  }, [open, refetch]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  const filteredItems = useMemo(
    () =>
      filter === "all"
        ? allItems
        : allItems.filter((n) => n.type === filter),
    [allItems, filter],
  );

  const groupedItems = useMemo(() => {
    return NOTIFICATION_GROUPS.map((group) => ({
      ...group,
      items: filteredItems.filter(
        (item) => notificationTimeGroup(item.createdAt) === group.key,
      ),
    })).filter((group) => group.items.length > 0);
  }, [filteredItems]);

  if (!mounted || !visible) return null;

  const hasUnread = allItems.some((n) => n.unread);

  function activateItem(item: NotificationItem) {
    if (item.unread) markRead(item.id);
    if (isAddFundsNotification(item)) {
      onClose();
      void startFunding(walletAddress);
      return;
    }
    if (item.href) {
      onClose();
      router.push(item.href);
    }
  }

  return createPortal(
    <div
      className={cn("tk-notif-overlay", animOpen && "tk-notif-overlay--open")}
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="tk-notif-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="tk-notif-panel__header">
          <span id={titleId} className="tk-notif-panel__title">
            Notifications
          </span>
          <div className="tk-notif-panel__header-actions">
            {hasUnread ? (
              <button
                type="button"
                className="tk-notif-panel__mark-all"
                onClick={() => markAllRead()}
              >
                Mark all read
              </button>
            ) : null}
            <button type="button" className="tk-notif-panel__close" aria-label="Close" onClick={onClose}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        <div className="tk-notif-filters">
          {NOTIFICATION_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              className={cn("tk-notif-filter", filter === f.key && "tk-notif-filter--active")}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="tk-notif-list">
          {groupedItems.map((group) => (
            <div key={group.key} className="tk-notif-group">
              <div className="tk-notif-group__label">{group.label}</div>
              {group.items.map((item) => (
                <NotificationItemView
                  key={item.id}
                  item={item}
                  onActivate={activateItem}
                />
              ))}
            </div>
          ))}
          {isLoading && filteredItems.length === 0 ? (
            <div className="tk-notif-empty">Loading…</div>
          ) : null}
          {!isLoading && filteredItems.length === 0 ? (
            <div className="tk-notif-empty">No notifications.</div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
