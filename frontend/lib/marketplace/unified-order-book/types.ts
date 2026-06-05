export type BookCenterTone = "ask" | "bid" | "none" | "last";

export type BookCenterModel = {
  primary: string;
  tone: BookCenterTone;
  lastSide: "buy" | "sell" | null;
  secondary: string | null;
  caption: string;
  title: string;
};

export type OrderBookTab = "book" | "trades" | "orders";

export type { OrderBookDepthLevel } from "./orderBookMath";
