import { backendFetch, getApiUrl } from "./client";
import {
  vaultLabelFromPolicy,
  type VaultCustodyPolicy,
} from "@/lib/marketplace/vaultCustodyLabel";

export type AskSettlementPolicy = VaultCustodyPolicy;

export type RwaVaultInfo = {
  tokenId: string;
  known: boolean;
  settlementPolicy: AskSettlementPolicy | null;
  vaultLabel: string | null;
};

function parseVaultInfo(raw: {
  tokenId: string;
  settlementPolicy?: AskSettlementPolicy | null;
  vaultLabel?: string | null;
  known?: boolean;
}): RwaVaultInfo {
  const known = raw.known !== false;
  const settlementPolicy = known ? (raw.settlementPolicy ?? null) : null;
  return {
    tokenId: raw.tokenId,
    known,
    settlementPolicy,
    vaultLabel: known
      ? vaultLabelFromPolicy(settlementPolicy, raw.vaultLabel)
      : null,
  };
}

export async function getRwaSettlementPolicy(
  tokenId: string | number,
): Promise<RwaVaultInfo> {
  const tid = encodeURIComponent(String(tokenId).trim());
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/rwa-tokens/${tid}/settlement-policy`,
  );
  if (res.status === 404) {
    return {
      tokenId: String(tokenId).trim(),
      known: false,
      settlementPolicy: null,
      vaultLabel: null,
    };
  }
  if (!res.ok) {
    throw new Error("Failed to load settlement policy");
  }
  const raw = (await res.json()) as {
    tokenId: string;
    settlementPolicy?: AskSettlementPolicy | null;
    vaultLabel?: string | null;
    known?: boolean;
  };
  return parseVaultInfo(raw);
}

export async function postRwaVaultInfoBatch(tokenIds: Array<string | number>): Promise<{
  items: RwaVaultInfo[];
}> {
  const ids = [...new Set(tokenIds.map((t) => String(t).trim()).filter(Boolean))];
  if (!ids.length) return { items: [] };
  const res = await backendFetch(`${getApiUrl()}/marketplace/rwa-tokens/vault-info/batch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tokenIds: ids }),
  });
  if (!res.ok) {
    throw new Error("Failed to load vault info");
  }
  const body = (await res.json()) as {
    items: Array<{
      tokenId: string;
      settlementPolicy?: AskSettlementPolicy | null;
      vaultLabel?: string | null;
      known?: boolean;
    }>;
  };
  return {
    items: (body.items ?? []).map(parseVaultInfo),
  };
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
