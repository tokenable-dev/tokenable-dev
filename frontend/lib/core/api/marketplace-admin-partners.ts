import { backendFetch, getApiUrl } from "./client";
import type {
  PartnerCompanyAddress,
  PartnerCompanyAddressInput,
} from "./marketplace-partner-me";

export type AdminMarketplacePartner = {
  id: string;
  displayName: string;
  walletAddress: string;
  isActive: boolean;
  hasPrivateKey: boolean;
  hasCompanyAddress: boolean;
  createdAt: string;
  updatedAt: string;
};

export type {
  PartnerCompanyAddress as AdminPartnerCompanyAddress,
  PartnerCompanyAddressInput as AdminPartnerCompanyAddressInput,
};

async function parseAdminError(res: Response, fallback: string): Promise<never> {
  const err = await res.json().catch(() => ({}));
  const body = err as { message?: string | string[] };
  const msg = Array.isArray(body.message)
    ? body.message.join(", ")
    : body.message;
  throw new Error(msg ?? fallback);
}

export async function listAdminMarketplacePartners(): Promise<
  AdminMarketplacePartner[]
> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/admin/partners`);
  if (!res.ok) await parseAdminError(res, "Failed to list partners");
  return res.json() as Promise<AdminMarketplacePartner[]>;
}

export async function postAdminMarketplacePartner(body: {
  displayName: string;
  walletAddress: string;
  privateKey?: string;
  isActive?: boolean;
}): Promise<AdminMarketplacePartner> {
  const res = await backendFetch(`${getApiUrl()}/marketplace/admin/partners`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) await parseAdminError(res, "Failed to create partner");
  return res.json() as Promise<AdminMarketplacePartner>;
}

export async function patchAdminMarketplacePartner(
  id: string,
  body: {
    displayName?: string;
    privateKey?: string;
    isActive?: boolean;
  },
): Promise<AdminMarketplacePartner> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/partners/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) await parseAdminError(res, "Failed to update partner");
  return res.json() as Promise<AdminMarketplacePartner>;
}

export async function getAdminPartnerCompanyAddress(partnerId: string): Promise<{
  partnerId: string;
  hasCompanyAddress: boolean;
  address: PartnerCompanyAddress | null;
}> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/partners/${encodeURIComponent(partnerId)}/company-address`,
  );
  if (!res.ok) {
    await parseAdminError(res, "Failed to load company Origin address");
  }
  return res.json() as Promise<{
    partnerId: string;
    hasCompanyAddress: boolean;
    address: PartnerCompanyAddress | null;
  }>;
}

export async function putAdminPartnerCompanyAddress(
  partnerId: string,
  body: PartnerCompanyAddressInput,
): Promise<PartnerCompanyAddress> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/admin/partners/${encodeURIComponent(partnerId)}/company-address`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    await parseAdminError(res, "Failed to save company Origin address");
  }
  const data = (await res.json()) as { address: PartnerCompanyAddress };
  return data.address;
}
