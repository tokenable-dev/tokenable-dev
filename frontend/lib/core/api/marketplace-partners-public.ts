import { backendFetch, getApiUrl } from "./client";

export type SelfVaultPartnerEligibility = {
  eligible: boolean;
  isPartner: boolean;
  hasCompanyAddress: boolean;
  partnerId: string | null;
  displayName: string | null;
  vaultLabel: string | null;
};

/** Whether an active marketplace partner with company Origin may Continue / mint Self vault. */
export async function getSelfVaultPartnerEligibility(
  wallet: string,
): Promise<SelfVaultPartnerEligibility> {
  const q = new URLSearchParams({ wallet: wallet.trim() });
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/partners/self-vault-eligibility?${q}`,
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const body = err as { message?: string | string[] };
    const msg = Array.isArray(body.message)
      ? body.message.join(", ")
      : body.message;
    throw new Error(msg ?? "Failed to check self-vault eligibility");
  }
  return res.json() as Promise<SelfVaultPartnerEligibility>;
}
