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

export type FetchKbwMysteryCardStatusOpts = {
  /** Tokenable session exists — never use wallet-wide email union (false "used"). */
  authenticatedSession?: boolean;
};

/**
 * Prefer session user email (`/status/me`).
 * Wallet lookup is only for anonymous visitors (401 on /status/me).
 */
export async function fetchKbwMysteryCardStatus(
  walletAddress: string,
  opts?: FetchKbwMysteryCardStatusOpts,
): Promise<{ burned: boolean }> {
  const meRes = await backendFetch(
    `${getApiUrl()}/marketplace/portfolio/kbw-mystery-card/status/me`,
  );
  if (meRes.ok) {
    return readBurned(meRes);
  }

  if (opts?.authenticatedSession) {
    return { burned: false };
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
