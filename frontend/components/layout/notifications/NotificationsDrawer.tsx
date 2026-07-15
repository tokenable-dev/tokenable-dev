"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { useClientMounted } from "@/hooks/ui/useClientMounted";
import { cn } from "@/lib/ds/cn";
import {
  MOCK_NOTIFICATIONS,
  NOTIFICATION_FILTERS,
  type MockNotification,
  type NotificationFilterKey,
  type NotificationIcon,
} from "@/lib/notifications/mockNotifications";

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

function NotificationItem({ item }: { item: MockNotification }) {
  return (
    <div className="tk-notif-item" data-type={item.type}>
      <div
        className="tk-notif-item__icon"
        style={{
          background: `rgba(${hexToRgb(item.color)},0.12)`,
          color: item.color,
        }}
      >
        <NotifIcon icon={item.icon} />
      </div>
      <div className="tk-notif-item__body">
        <div className="tk-notif-item__top">
          <span className="tk-notif-item__title">{item.title}</span>
          {item.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt="" className="tk-notif-item__thumb" />
          ) : null}
        </div>
        <p className="tk-notif-item__desc">{item.desc}</p>
        <span className="tk-notif-item__time mono">{item.time}</span>
      </div>
    </div>
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
  const titleId = useId();
  const [filter, setFilter] = useState<NotificationFilterKey>("all");
  const [visible, setVisible] = useState(false);
  const [animOpen, setAnimOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setFilter("all");
      const id = requestAnimationFrame(() => setAnimOpen(true));
      return () => cancelAnimationFrame(id);
    }
    setAnimOpen(false);
    const t = window.setTimeout(() => setVisible(false), 300);
    return () => window.clearTimeout(t);
  }, [open]);

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

  if (!mounted || !visible) return null;

  const items =
    filter === "all"
      ? MOCK_NOTIFICATIONS
      : MOCK_NOTIFICATIONS.filter((n) => n.type === filter);

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
          <button type="button" className="tk-notif-panel__close" aria-label="Close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
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

        <div className="tk-notif-panel__divider" />

        <div className="tk-notif-panel__section">Recent</div>

        <div className="tk-notif-list">
          {items.map((item) => (
            <NotificationItem key={item.id} item={item} />
          ))}
          {items.length === 0 ? (
            <div className="tk-notif-empty">No notifications in this category.</div>
          ) : null}
        </div>
      </div>
    </div>,
    document.body,
  );
}
