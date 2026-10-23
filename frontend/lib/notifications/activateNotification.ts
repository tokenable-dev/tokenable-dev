import type { TkNoteTone } from "@/components/ds/Note";
import type { NotificationItem } from "@/lib/notifications/notifications";

export function isAddFundsNotification(item: {
  ctaLabel?: string | null;
  href?: string | null;
}): boolean {
  if (item.ctaLabel === "Add funds") return true;
  const href = item.href ?? "";
  return href.includes("addfunds=1");
}

/** Map inbox type / eventKey → Feedback-States Notification scheme (spec v2). */
export function notificationToastTone(item: NotificationItem): TkNoteTone {
  const key = (item.eventKey ?? "").toUpperCase();
  if (
    key.includes("FAILED") ||
    key.includes("UNFILLED") ||
    key.includes("REJECT") ||
    key.includes("CANCELLED") ||
    key.includes("BREACH") ||
    key.includes("STRIKE") ||
    key.includes("SUSPENDED") ||
    key === "BUYER_BID_EXPIRED" ||
    key === "RD_AUTO_CANCELLED_REFUND" ||
    key === "REDEEM_REFUNDED" ||
    key === "FUNDS_WITHDRAW_FAILED"
  ) {
    return "danger";
  }
  if (
    item.type === "price" ||
    key.includes("EXPIRING") ||
    key.includes("WARNING") ||
    key.includes("SLA_WARN") ||
    key.includes("REMINDER") ||
    key === "RD_RECEIVED_REMINDER"
  ) {
    return "warning";
  }
  if (
    item.type === "trade" ||
    key.includes("SOLD") ||
    key.includes("PAYOUT") ||
    key.includes("SHIPPED") ||
    key.includes("FILLED") ||
    key === "BUYER_VAULT_PURCHASED" ||
    key === "FUNDS_WITHDRAW_SENT" ||
    key === "RD_PAID_PREPARING" ||
    key === "WD_REQUEST_RECEIVED" ||
    key === "REDEEM_PREPARING"
  ) {
    return "positive";
  }
  return "brand";
}
