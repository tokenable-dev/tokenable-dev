export type NotificationFilterKey = "all" | "trade" | "bid" | "vault" | "price";

export type NotificationIcon = "check" | "layer" | "shield" | "trend";

export type NotificationItem = {
  id: string;
  type: Exclude<NotificationFilterKey, "all">;
  icon: NotificationIcon;
  color: string;
  title: string;
  desc: string;
  time: string;
  imageUrl?: string;
  href?: string | null;
  unread?: boolean;
  ctaLabel?: string | null;
};

export const NOTIFICATION_FILTERS: {
  key: NotificationFilterKey;
  label: string;
}[] = [
  { key: "all", label: "All" },
  { key: "trade", label: "Trade" },
  { key: "bid", label: "Bid" },
  { key: "vault", label: "Vault" },
  { key: "price", label: "Price Alert" },
];

/** Colors match `Tokenable-with design system-3/tk-notifications.js`. */
const TYPE_STYLE: Record<
  Exclude<NotificationFilterKey, "all">,
  { icon: NotificationIcon; color: string }
> = {
  trade: { icon: "check", color: "#00C350" },
  bid: { icon: "layer", color: "#1A6FFF" },
  vault: { icon: "shield", color: "#1A6FFF" },
  price: { icon: "trend", color: "#EA8200" },
};

export function notificationTypeStyle(
  type: Exclude<NotificationFilterKey, "all">,
): { icon: NotificationIcon; color: string } {
  return TYPE_STYLE[type] ?? TYPE_STYLE.bid;
}

/** Compact unread count for badges (`9+` when over 9). */
export function formatUnreadBadgeCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "";
  if (count > 9) return "9+";
  return String(Math.floor(count));
}

/**
 * Relative time for the notifications drawer — parity with tk-notifications.js
 * (`Just now`, `2 min ago`, `1 hour ago`, `Yesterday`, …).
 */
export function formatNotificationTime(iso: string, nowMs = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const sec = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (sec < 60) return "Just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return min === 1 ? "1 min ago" : `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? "1 hour ago" : `${hr} hours ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 7) return `${day} days ago`;
  if (day < 14) return "1 week ago";
  if (day < 30) return `${Math.floor(day / 7)} weeks ago`;
  return new Date(t).toLocaleDateString();
}
