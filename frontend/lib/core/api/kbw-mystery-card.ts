import { backendFetch, getApiUrl } from "./client";

export async function fetchKbwMysteryCardStatus(
  walletAddress: string,
): Promise<{ burned: boolean }> {
  const wallet = walletAddress.trim().toLowerCase();
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/portfolio/kbw-mystery-card/${encodeURIComponent(wallet)}`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ??
        "Failed to load KBW mystery card status",
    );
  }
  return (await res.json()) as { burned: boolean };
}

export async function burnKbwMysteryCard(
  walletAddress: string,
): Promise<{ burned: true; alreadyBurned: boolean }> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/portfolio/kbw-mystery-card/burn`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ?? "Failed to burn KBW mystery card",
    );
  }
  return (await res.json()) as { burned: true; alreadyBurned: boolean };
}
