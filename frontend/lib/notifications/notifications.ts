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
};

export const NOTIFICATION_FILTERS: { key: NotificationFilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "trade", label: "Trade" },
  { key: "bid", label: "Bid" },
  { key: "vault", label: "Vault" },
  { key: "price", label: "Price Alert" },
];
