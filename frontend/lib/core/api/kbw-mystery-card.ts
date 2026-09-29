import { isWalletOnlyPlaceholderEmail } from "@/lib/auth/walletOnlyEmail";
import { backendFetch, getApiUrl } from "./client";

async function readBurned(res: Response): Promise<{ burned: boolean }> {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message ??
        "Failed to load KBW mystery card status",
    );
  }
  return (await res.json()) as { burned: boolean };
}

/** Query-key segment so status refetches after contact email is saved. */
export function kbwMysteryCardContactScope(
  email: string | null | undefined,
): string {
  const em = email?.trim().toLowerCase() ?? "";
  if (!em || isWalletOnlyPlaceholderEmail(em)) return "";
  return em;
}

/**
 * Prefer session user email (avoids false "used" from wallet-wide email union).
 * Wallet lookup is only used when unauthenticated (401 on /status/me).
 */
export async function fetchKbwMysteryCardStatus(
  walletAddress: string,
): Promise<{ burned: boolean }> {
  const meRes = await backendFetch(
    `${getApiUrl()}/marketplace/portfolio/kbw-mystery-card/status/me`,
  );
  if (meRes.ok) {
    return readBurned(meRes);
  }
  if (meRes.status !== 401) {
    return readBurned(meRes);
  }

  const wallet = walletAddress.trim().toLowerCase();
  if (!wallet) {
    return { burned: false };
  }
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/portfolio/kbw-mystery-card/${encodeURIComponent(wallet)}`,
  );
  return readBurned(res);
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
