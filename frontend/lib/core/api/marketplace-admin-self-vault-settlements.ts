import { backendFetch, getApiUrl } from "./client";
import type {
  SelfVaultSettlement,
  SelfVaultSettlementStatus,
} from "./rwa-settlement";

export type {
  SelfVaultSettlement,
  SelfVaultSettlementStatus,
} from "./rwa-settlement";

function adminErrorMessage(body: unknown, fallback: string): string {
  const msg = (body as { message?: string | string[] } | null)?.message;
  if (Array.isArray(msg)) return msg.join(", ");
  if (typeof msg === "string" && msg.trim()) return msg;
  return fallback;
}

export async function listAdminSelfVaultSettlements(
  status?: SelfVaultSettlementStatus | "open",
): Promise<{ items: SelfVaultSettlement[]; chainId: number }> {
  const sp = new URLSearchParams();
  if (status) sp.set("status", status);
  const q = sp.toString();
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/self-vault-settlements${q ? `?${q}` : ""}`,
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(adminErrorMessage(body, "Failed to load settlements"));
  }
  return res.json() as Promise<{
    items: SelfVaultSettlement[];
    chainId: number;
  }>;
}

export async function adminConfirmSelfVaultSettlement(
  id: string,
): Promise<SelfVaultSettlement> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/self-vault-settlements/${encodeURIComponent(id)}/confirm`,
    { method: "POST" },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(adminErrorMessage(body, "Failed to confirm settlement"));
  }
  return res.json() as Promise<SelfVaultSettlement>;
}

export async function adminRejectSelfVaultSettlement(
  id: string,
): Promise<SelfVaultSettlement> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/self-vault-settlements/${encodeURIComponent(id)}/reject`,
    { method: "POST" },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(adminErrorMessage(body, "Failed to reject settlement"));
  }
  return res.json() as Promise<SelfVaultSettlement>;
}

export async function adminExecuteSelfVaultPayout(
  id: string,
): Promise<SelfVaultSettlement> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/self-vault-settlements/${encodeURIComponent(id)}/execute-payout`,
    { method: "POST" },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(adminErrorMessage(body, "Failed to execute payout"));
  }
  return res.json() as Promise<SelfVaultSettlement>;
}

export async function adminBackfillSelfVaultSettlements(): Promise<{
  created: number;
  skipped: number;
  items: SelfVaultSettlement[];
}> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/self-vault-settlements/backfill-missing`,
    { method: "POST" },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(adminErrorMessage(body, "Failed to backfill settlements"));
  }
  return res.json() as Promise<{
    created: number;
    skipped: number;
    items: SelfVaultSettlement[];
  }>;
}
