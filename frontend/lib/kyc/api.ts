import { backendFetch, getApiUrl } from "@/lib/core/api/client";
import type { KycStatus } from "@/lib/auth";

export type KycStatusResponse = {
  status: KycStatus;
  provider: string | null;
  verifiedAt: string | null;
  rejectionReason: string | null;
  externalId: string | null;
  sumsubConfigured: boolean;
};

export type KycAccessTokenResponse = {
  token: string;
  userId: string;
};

export async function fetchKycStatus(): Promise<KycStatusResponse> {
  const res = await backendFetch(`${getApiUrl()}/kyc/status`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "KYC status error" }));
    throw new Error((err as { message?: string }).message ?? "KYC status error");
  }
  return res.json() as Promise<KycStatusResponse>;
}

export async function fetchKycAccessToken(): Promise<KycAccessTokenResponse> {
  const res = await backendFetch(`${getApiUrl()}/kyc/access-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "KYC token error" }));
    throw new Error((err as { message?: string }).message ?? "KYC token error");
  }
  return res.json() as Promise<KycAccessTokenResponse>;
}
