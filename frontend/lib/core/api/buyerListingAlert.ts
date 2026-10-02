import { backendFetch, getApiUrl } from "./client";

export async function fetchBuyerListingAlertStatus(
  collectionKey: string,
): Promise<{ active: boolean }> {
  const q = new URLSearchParams({ collectionKey });
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/buyer-listing-alerts/status?${q}`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to load alert status" }));
    throw new Error((err as { message?: string }).message ?? "Failed to load alert status");
  }
  return res.json() as Promise<{ active: boolean }>;
}

export async function subscribeBuyerListingAlert(collectionKey: string): Promise<void> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/buyer-listing-alerts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ collectionKey }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to subscribe" }));
    throw new Error((err as { message?: string }).message ?? "Failed to subscribe");
  }
}

export async function unsubscribeBuyerListingAlert(collectionKey: string): Promise<void> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/buyer-listing-alerts`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ collectionKey }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to unsubscribe" }));
    throw new Error((err as { message?: string }).message ?? "Failed to unsubscribe");
  }
}
