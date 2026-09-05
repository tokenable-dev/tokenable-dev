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

/** Partner-scoped redeem row — same shape as admin redeems list. */
export type PartnerRedeemRow = {
  id: string;
  status: string;
  paymentBatchId: string | null;
  trackingNumber: string | null;
  trackingCarrier: string | null;
  trackingSetAt: string | null;
  shipTo: {
    name: string;
    line1: string;
    line2: string | null;
    city: string;
    region: string | null;
    postal: string;
    country: string;
    phone: string | null;
  };
  tokenId: string | null;
  certNumber: string | null;
  displayName: string | null;
  imageUrl: string | null;
  shipmentKey: string;
  /** batch + shipmentKey + ship-to — partner tracking write scope. */
  trackingGroupKey: string;
  vaultLabel: string | null;
  requestedAt: string;
  updatedAt: string;
};

export async function listPartnerRedeems(opts?: {
  limit?: number;
}): Promise<{ items: PartnerRedeemRow[] }> {
  const q = new URLSearchParams();
  if (opts?.limit != null) q.set("limit", String(opts.limit));
  const qs = q.toString();
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/partners/me/redeems${qs ? `?${qs}` : ""}`,
  );
  if (!res.ok) await parseError(res, "Failed to load partner shipments");
  return res.json() as Promise<{ items: PartnerRedeemRow[] }>;
}

export async function patchPartnerRedeemBatchTracking(params: {
  batchId: string;
  shipmentKey: string;
  redemptionIds: string[];
  trackingNumber: string;
  trackingCarrier?: string;
}): Promise<{
  paymentBatchId: string;
  shipmentKey: string;
  items: PartnerRedeemRow[];
}> {
  const res = await backendFetch(
    `${getApiUrl()}/marketplace/partners/me/redeems/batches/${encodeURIComponent(params.batchId)}/tracking`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shipmentKey: params.shipmentKey,
        redemptionIds: params.redemptionIds,
        trackingNumber: params.trackingNumber,
        trackingCarrier: params.trackingCarrier,
      }),
    },
  );
  if (!res.ok) await parseError(res, "Failed to save tracking");
  return res.json() as Promise<{
    paymentBatchId: string;
    shipmentKey: string;
    items: PartnerRedeemRow[];
  }>;
}
