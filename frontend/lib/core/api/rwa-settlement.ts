import { backendFetch, getApiUrl } from "./client";

export type AskSettlementPolicy = "standard" | "self_vault_hold";

export async function getRwaSettlementPolicy(
  tokenId: string | number,
): Promise<{ tokenId: string; settlementPolicy: AskSettlementPolicy }> {
  const tid = encodeURIComponent(String(tokenId).trim());
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/rwa-tokens/${tid}/settlement-policy`,
  );
  if (!res.ok) {
    throw new Error("Failed to load settlement policy");
  }
  return res.json() as Promise<{
    tokenId: string;
    settlementPolicy: AskSettlementPolicy;
  }>;
}

export type SelfVaultSettlementStatus =
  | "pending_confirm"
  | "confirmed"
  | "paid"
  | "rejected";

export type SelfVaultSettlement = {
  id: string;
  orderHash: string;
  tokenContract: string;
  tokenId: string;
  sellerWallet: string;
  buyerWallet: string;
  grossUsdc: string;
  sellerPayoutUsdc: string;
  chainId: number;
  status: SelfVaultSettlementStatus;
  fulfillTxHash: string | null;
  payoutTxHash: string | null;
  confirmedAt: string | null;
  paidAt: string | null;
  createdAt: string;
};

export async function confirmSelfVaultSettlement(
  id: string,
): Promise<SelfVaultSettlement> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/self-vault-settlements/${encodeURIComponent(id)}/confirm`,
    { method: "POST" },
  );
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as {
      message?: string | string[];
    } | null;
    const msg = Array.isArray(body?.message)
      ? body.message.join(", ")
      : body?.message;
    throw new Error(msg || "Failed to confirm settlement");
  }
  return res.json() as Promise<SelfVaultSettlement>;
}

export async function listMySelfVaultSettlements(): Promise<{
  items: SelfVaultSettlement[];
}> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/self-vault-settlements/mine`,
  );
  if (!res.ok) throw new Error("Failed to load settlements");
  return res.json() as Promise<{ items: SelfVaultSettlement[] }>;
}
