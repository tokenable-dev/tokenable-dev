import { backendFetch, getApiUrl } from "../core/api/client";

export interface WalletLinkChallenge {
  message: string;
  challenge: string;
}

export async function fetchWalletLinkChallenge(): Promise<WalletLinkChallenge> {
  const res = await backendFetch(`${getApiUrl()}/auth/wallet/challenge`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Challenge failed" }));
    throw new Error((err as { message?: string }).message ?? "Challenge failed");
  }
  return (await res.json()) as WalletLinkChallenge;
}

export interface LinkWalletPayload {
  address: string;
  signature: string;
  challenge: string;
}

export async function linkWalletToAccount(payload: LinkWalletPayload): Promise<void> {
  const res = await backendFetch(`${getApiUrl()}/auth/wallet`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Link failed" }));
    const raw = (err as { message?: string | string[] }).message;
    const message = Array.isArray(raw) ? raw[0] : raw;
    throw new Error(message ?? "Link failed");
  }
}
