"use client";

import { formatUnreadBadgeCount } from "@/lib/notifications/notifications";
import { cn } from "@/lib/ds/cn";

/** Small unread count pill for header / menu notification icons. */
export function NotificationUnreadBadge({
  count,
  className,
  floating = false,
}: {
  count: number;
  className?: string;
  /** Absolute corner badge (wallet chip / burger). */
  floating?: boolean;
}) {
  const label = formatUnreadBadgeCount(count);
  if (!label) return null;
  return (
    <span
      className={cn(
        "tk-notif-badge",
        floating && "tk-notif-badge--float",
        className,
      )}
      aria-label={`${count} unread notification${count === 1 ? "" : "s"}`}
    >
      {label}
    </span>
  );
}
