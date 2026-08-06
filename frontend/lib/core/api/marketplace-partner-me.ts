import { backendFetch, getApiUrl } from "./client";

export type PartnerCompanyAddress = {
  id: string;
  partnerId: string;
  companyName: string;
  contactName: string;
  phone: string;
  country: string;
  city: string;
  region: string | null;
  postal: string;
  line1: string;
  line2: string | null;
  residential: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PartnerMeSession = {
  isPartner: boolean;
  partnerId: string | null;
  displayName: string | null;
  vaultLabel: string | null;
  hasCompanyAddress: boolean;
  companyAddress: PartnerCompanyAddress | null;
};

export type PartnerCompanyAddressInput = {
  companyName: string;
  contactName: string;
  phone: string;
  country: string;
  city: string;
  region?: string | null;
  postal: string;
  line1: string;
  line2?: string | null;
  residential?: boolean;
};

async function parseError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  const body = err as { message?: string | string[] };
  const msg = Array.isArray(body.message)
    ? body.message.join(", ")
    : body.message;
  throw new Error(msg ?? fallback);
}

/** Active partner status + company Origin address for the signed-in user. */
export async function getPartnerMe(): Promise<PartnerMeSession> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/partners/me`);
  if (!res.ok) await parseError(res, "Failed to load partner status");
  return res.json() as Promise<PartnerMeSession>;
}

export async function putPartnerCompanyAddress(
  body: PartnerCompanyAddressInput,
): Promise<PartnerCompanyAddress> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/partners/me/company-address`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) await parseError(res, "Failed to save company vault address");
  const data = (await res.json()) as { address: PartnerCompanyAddress };
  return data.address;
}
