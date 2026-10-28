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
  createdAt: string;
  imageUrl?: string;
  href?: string | null;
  unread?: boolean;
  ctaLabel?: string | null;
  eventKey?: string | null;
};

export const NOTIFICATION_FILTERS: {
  key: NotificationFilterKey;
  label: string;
}[] = [
  { key: "all", label: "All" },
  { key: "trade", label: "Trade" },
  { key: "bid", label: "Bid" },
  { key: "vault", label: "Vault" },
  { key: "price", label: "Price alert" },
];

export type NotificationGroupKey = "today" | "week" | "earlier";

export const NOTIFICATION_GROUPS: {
  key: NotificationGroupKey;
  label: string;
}[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "earlier", label: "Earlier" },
];

/** Group inbox rows — parity with Notifications-standalone.html. */
export function notificationTimeGroup(
  createdAt: string,
  nowMs = Date.now(),
): NotificationGroupKey {
  const t = Date.parse(createdAt);
  if (!Number.isFinite(t)) return "earlier";
  const now = new Date(nowMs);
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).getTime();
  if (t >= startOfToday) return "today";
  const sevenDaysAgo = nowMs - 7 * 24 * 60 * 60 * 1000;
  if (t >= sevenDaysAgo) return "week";
  return "earlier";
}

/** Colors match `Tokenable-with design system-3/tk-notifications.js`. */
const TYPE_STYLE: Record<
  Exclude<NotificationFilterKey, "all">,
  { icon: NotificationIcon; color: string }
> = {
  trade: { icon: "check", color: "#00C350" },
  bid: { icon: "layer", color: "#1A6FFF" },
  vault: { icon: "shield", color: "#1A6FFF" },
  price: { icon: "trend", color: "#F3701E" },
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
export type NotificationTimeCopy = {
  justNow: string;
  minAgoOne: string;
  minAgo: (count: number) => string;
  hourAgoOne: string;
  hourAgo: (count: number) => string;
  yesterday: string;
  daysAgo: (count: number) => string;
  weekAgoOne: string;
  weeksAgo: (count: number) => string;
};

const EN_NOTIFICATION_TIME: NotificationTimeCopy = {
  justNow: "Just now",
  minAgoOne: "1 min ago",
  minAgo: (count) => `${count} min ago`,
  hourAgoOne: "1 hour ago",
  hourAgo: (count) => `${count} hours ago`,
  yesterday: "Yesterday",
  daysAgo: (count) => `${count} days ago`,
  weekAgoOne: "1 week ago",
  weeksAgo: (count) => `${count} weeks ago`,
};

export function formatNotificationTime(
  iso: string,
  nowMs = Date.now(),
  copy: NotificationTimeCopy = EN_NOTIFICATION_TIME,
): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const sec = Math.max(0, Math.floor((nowMs - t) / 1000));
  if (sec < 60) return copy.justNow;
  const min = Math.floor(sec / 60);
  if (min < 60) return min === 1 ? copy.minAgoOne : copy.minAgo(min);
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? copy.hourAgoOne : copy.hourAgo(hr);
  const day = Math.floor(hr / 24);
  if (day === 1) return copy.yesterday;
  if (day < 7) return copy.daysAgo(day);
  if (day < 14) return copy.weekAgoOne;
  if (day < 30) return copy.weeksAgo(Math.floor(day / 7));
  return new Date(t).toLocaleDateString();
}
