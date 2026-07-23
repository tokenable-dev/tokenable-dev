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

const TYPE_STYLE: Record<
  Exclude<NotificationFilterKey, "all">,
  { icon: NotificationIcon; color: string }
> = {
  trade: { icon: "check", color: "#34d399" },
  bid: { icon: "layer", color: "#60a5fa" },
  vault: { icon: "shield", color: "#a78bfa" },
  price: { icon: "trend", color: "#fbbf24" },
};

export function notificationTypeStyle(
  type: Exclude<NotificationFilterKey, "all">,
): { icon: NotificationIcon; color: string } {
  return TYPE_STYLE[type] ?? TYPE_STYLE.bid;
}

/** Compact relative time for the notifications drawer. */
export function formatNotificationTime(iso: string, nowMs = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const sec = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 86400 * 7) return `${Math.floor(sec / 86400)}d ago`;
  return new Date(t).toLocaleDateString();
}
