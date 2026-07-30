import { backendFetch, getApiUrl } from "./client";

export type MarketplaceNotificationType = "bid" | "trade" | "vault" | "price";

export type MarketplaceNotificationItem = {
  id: number;
  type: MarketplaceNotificationType;
  title: string;
  body: string;
  chainId: number;
  payload: {
    eventKey?: string;
    event?: "cancelled" | "unfilled" | "dead_bidder";
    bidOrderHash?: string;
    tokenId?: string;
    askOrderHash?: string;
    bidUsdc?: number;
    collectionKey?: string | null;
    ctaLabel?: string;
    cardLabel?: string;
    imageUrl?: string | null;
    href?: string;
    submissionPublicId?: string;
  };
  readAt: string | null;
  createdAt: string;
  href: string | null;
  ctaLabel: string | null;
  imageUrl: string | null;
};

export async function fetchMarketplaceNotifications(): Promise<{
  items: MarketplaceNotificationItem[];
}> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/notifications`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({
      message: "Failed to load notifications",
    }));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to load notifications",
    );
  }
  return res.json() as Promise<{ items: MarketplaceNotificationItem[] }>;
}

export async function markNotificationRead(
  id: number,
): Promise<MarketplaceNotificationItem> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/notifications/${id}/read`,
    { method: "PATCH" },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({
      message: "Failed to mark notification read",
    }));
    throw new Error(
      (err as { message?: string }).message ??
        "Failed to mark notification read",
    );
  }
  return res.json() as Promise<MarketplaceNotificationItem>;
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/notifications/read-all`,
    { method: "PATCH" },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({
      message: "Failed to mark notifications read",
    }));
    throw new Error(
      (err as { message?: string }).message ??
        "Failed to mark notifications read",
    );
  }
  return res.json() as Promise<{ updated: number }>;
}
