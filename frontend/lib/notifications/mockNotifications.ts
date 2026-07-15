import { ASSETS } from "@/constants/assets";

export type NotificationFilterKey = "all" | "trade" | "bid" | "vault" | "price";

export type NotificationIcon = "check" | "layer" | "shield" | "trend";

export type MockNotification = {
  id: string;
  type: Exclude<NotificationFilterKey, "all">;
  icon: NotificationIcon;
  color: string;
  title: string;
  desc: string;
  time: string;
  imageUrl?: string;
};

/** Mock feed — parity with `Tokenable-with design system/tk-notifications.js`. */
export const MOCK_NOTIFICATIONS: MockNotification[] = [
  {
    id: "n1",
    type: "trade",
    icon: "check",
    color: "#00C350",
    title: "Trade Confirmed",
    desc: "Your purchase of Charizard 1st Ed Base Set PSA 10 has been confirmed.",
    time: "2 min ago",
    imageUrl: ASSETS.ds.cards.charizard,
  },
  {
    id: "n2",
    type: "bid",
    icon: "layer",
    color: "#1A6FFF",
    title: "Bid Accepted",
    desc: "Your bid of $58,000 on LeBron James Rookie Chrome BGS 9.5 was accepted.",
    time: "1 hour ago",
    imageUrl: ASSETS.ds.cards.lebron,
  },
  {
    id: "n3",
    type: "price",
    icon: "trend",
    color: "#EA8200",
    title: "Price Alert",
    desc: "Pikachu ex Surging Sparks PSA 10 is up +12% in the last 24 hours.",
    time: "3 hours ago",
    imageUrl: ASSETS.ds.cards.pikachu,
  },
  {
    id: "n4",
    type: "vault",
    icon: "shield",
    color: "#1A6FFF",
    title: "Card Vaulted",
    desc: "Your Luka Dončić Blue Ice Prizm BGS 9.5 has been received and vaulted.",
    time: "Yesterday",
  },
  {
    id: "n5",
    type: "trade",
    icon: "check",
    color: "#00C350",
    title: "Sale Complete",
    desc: "Nidoking ex PSA 10 sold for $58,000. Funds deposited to your wallet.",
    time: "2 days ago",
    imageUrl: ASSETS.ds.cards.nidoking,
  },
  {
    id: "n6",
    type: "bid",
    icon: "layer",
    color: "#1A6FFF",
    title: "New Bid Received",
    desc: "You received a bid of $400,000 on Charizard 1st Ed Base Set PSA 10.",
    time: "3 days ago",
  },
  {
    id: "n7",
    type: "vault",
    icon: "shield",
    color: "#1A6FFF",
    title: "Insurance Renewed",
    desc: "Vault insurance for all 23 assets has been renewed for another year.",
    time: "1 week ago",
  },
  {
    id: "n8",
    type: "price",
    icon: "trend",
    color: "#EA8200",
    title: "Market Update",
    desc: "The PSA 10 Charizard index is up +5.2% this week. View market trends.",
    time: "1 week ago",
  },
  {
    id: "n9",
    type: "trade",
    icon: "check",
    color: "#00C350",
    title: "Trade Settled",
    desc: "Your purchase of Pikachu VMAX Rainbow PSA 10 has settled on-chain.",
    time: "2 weeks ago",
    imageUrl: ASSETS.ds.cards.pikachuEx,
  },
];

export const NOTIFICATION_FILTERS: { key: NotificationFilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "trade", label: "Trade" },
  { key: "bid", label: "Bid" },
  { key: "vault", label: "Vault" },
  { key: "price", label: "Price Alert" },
];
